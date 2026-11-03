import { createLocalId } from "../offline/identity";
import { hashPhoto } from "../offline/photo-hash";

import { parsePushResult, parseChange, parsePullPage } from "./contracts";

import type { OutboxOperation } from "../../types/offline";
import type { LocalPhoto } from "../../types/photos";
import type { SyncStatus, SyncSummary } from "../../types/sync";
import type { LocalRepository } from "../offline/repository";

export const emptySummary: SyncSummary = {
  pending: [],
  recoveries: [],
  localPhotos: 0,
  missingPhotos: 0,
  lastSyncedAt: null,
};

class HttpSyncError extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(code);
  }
}

export function photoUrl(photo: Pick<LocalPhoto, "profileId" | "eventId" | "id">) {
  return `/api/v1/profiles/${encodeURIComponent(photo.profileId)}/events/${encodeURIComponent(photo.eventId)}/photos/${encodeURIComponent(photo.id)}/original`;
}

export class SyncEngine {
  private state: SyncStatus = {
    phase: "idle",
    reachable: null,
    message: null,
    progress: null,
    summary: emptySummary,
  };

  private readonly listeners = new Set<() => void>();

  private running: Promise<void> | null = null;

  private controller: AbortController | null = null;

  private timer: ReturnType<typeof setTimeout> | undefined;

  private failures = 0;

  private stopped = true;

  private unsubscribe: (() => void) | undefined;

  constructor(readonly repository: LocalRepository, private readonly request: typeof fetch = fetch) {}

  snapshot = () => this.state;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  };

  private publish(changes: Partial<SyncStatus>) {
    this.state = {
      ...this.state,
      ...changes,
    };
    for (const listener of this.listeners) {
      listener();
    }
  }

  private readonly schedule = (delay = 800) => {
    if (this.stopped) {
      return;
    }
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.run();
    }, delay);
  };

  start() {
    this.stopped = false;
    this.unsubscribe = this.repository.subscribe((kind) => {
      if (kind === "local") {
        void this.repository.sync.summary().then((summary) => {
          this.publish({
            summary,
          });
        }).catch(() => undefined);
        this.schedule();
      }
    });
    if (typeof window !== "undefined") {
      window.addEventListener("online", this.wake);
      window.addEventListener("offline", this.wake);
      document.addEventListener("visibilitychange", this.visible);
    }
    this.schedule(0);

    return () => {
      this.stop();
    };
  }

  private readonly wake = () => {
    this.schedule(0);
  };

  private readonly visible = () => {
    if (document.visibilityState === "visible") {
      this.schedule(0);
    }
  };

  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    this.controller?.abort();
    this.unsubscribe?.();
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.wake);
      window.removeEventListener("offline", this.wake);
      document.removeEventListener("visibilitychange", this.visible);
    }
  }

  run = (): Promise<void> => {
    if (this.running !== null) {
      return this.running;
    }
    this.running = this.coordinate().finally(() => {
      this.running = null;
      const backoff = Math.min(60000, 2000 * (2 ** Math.min(this.failures, 5))) + (Math.random() * 1000);
      const delay = this.state.summary.pending.length > 0 && this.state.phase !== "offline" ? 800 : 30000;

      this.schedule(this.failures === 0 ? delay : backoff);
    });

    return this.running;
  };

  private async coordinate() {
    try {
      this.publish({
        summary: await this.repository.sync.summary(),
      });
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        this.publish({
          phase: "offline",
          reachable: false,
          message: "Sei offline. Le modifiche restano sul dispositivo e saranno inviate al ritorno della rete.",
          progress: null,
        });

        return;
      }
      if (typeof navigator !== "undefined" && "locks" in navigator) {
        await navigator.locks.request("expotrack-sync", {
          ifAvailable: true,
        }, async (lock) => {
          if (lock !== null) {
            await this.cycle();
          }
        });
      } else {
        const owner = createLocalId();

        if (!await this.repository.sync.lease(owner)) {
          return;
        }
        const heartbeat = setInterval(() => {
          void this.repository.sync.lease(owner).catch(() => undefined);
        }, 10000);

        try {
          await this.cycle();
        } finally {
          clearInterval(heartbeat);
          await this.repository.sync.lease(owner, true);
        }
      }
    } catch (error) {
      this.failures += 1;
      let message = "Sincronizzazione interrotta. Le modifiche già salvate restano sul dispositivo; il trasferimento riprenderà con l’app aperta.";
      let reachable = this.state.reachable;

      if (error instanceof HttpSyncError) {
        reachable = true;
        if (error.code === "storage_full") {
          message = "Spazio insufficiente sul server. Gli originali restano sul dispositivo: libera spazio sul server e riprova.";
        }
      } else if (error instanceof DOMException && error.name === "QuotaExceededError") {
        message = "Spazio sul dispositivo insufficiente per scaricare le foto. I file già inviati restano sul server: libera spazio e riprova.";
      } else if (error instanceof TypeError || (error instanceof DOMException
        && (error.name === "AbortError" || error.name === "TimeoutError"))) {
        reachable = false;
      }
      this.publish({
        phase: "error",
        reachable,
        message,
        progress: null,
      });
    }
  }

  private async http(url: string, init: RequestInit = {}, photo = false): Promise<Response> {
    const timeout = AbortSignal.timeout(photo ? 120000 : 20000);
    const signal = this.controller === null ? timeout : AbortSignal.any([this.controller.signal, timeout]);
    const request = this.request;
    const response = await request(url, {
      ...init,
      cache: "no-store",
      signal,
    });

    this.publish({
      reachable: true,
    });
    if (!response.ok) {
      let code = "server_unavailable";

      try {
        const body: unknown = await response.json();

        if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "string") {
          code = body.error;
        }
      } catch { /* A proxy can return an HTML error page. Keep the original status. */ }

      throw new HttpSyncError(code, response.status);
    }

    return response;
  }

  private async send(operation: OutboxOperation) {
    try {
      const wire = {
        ...operation,
        dependsOn: operation.dependsOn.filter((id) => !id.startsWith("remote:")),
      };
      const response = await this.http("/api/v1/sync/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(wire),
      });
      let result = parsePushResult(await response.json());

      if (result.operationId !== operation.operationId) {
        throw new Error("Conferma di un’altra operazione.");
      }
      if (result.status === "retry") {
        throw new Error("Dipendenza non ancora disponibile sul server.");
      }
      if (result.status === "rejected") {
        await this.repository.sync.reject(operation, result.code ?? "rejected", result.current);

        return;
      }
      const deletedLocally = operation.entityType === "photo"
        && (await this.repository.listPhotos(operation)).some((photo) =>
          photo.id === operation.entityId && photo.deletedAt !== null);

      if (operation.entityType === "photo" && operation.action !== "delete" && !deletedLocally) {
        const asset = await this.repository.getPhotoAsset(operation, operation.entityId);

        if (asset === undefined) {
          throw new Error("Originale locale non disponibile.");
        }
        this.publish({
          progress: `Invio foto: ${operation.payload.filename}`,
        });
        const uploaded = await this.http(photoUrl({
          ...operation,
          id: operation.entityId,
        }), {
          method: "PUT",
          headers: {
            "Content-Type": asset.contentType,
          },
          body: asset.original,
        }, true);
        const current = parseChange(await uploaded.json());

        if (current.entityType !== "photo" || current.mediaStatus !== "ready"
          || current.data.sha256 !== asset.sha256) {
          throw new Error("Originale non confermato dal server.");
        }
        result = {
          ...result,
          current,
        };
      }
      await this.repository.sync.acknowledge(operation, result);
    } catch (error) {
      if (error instanceof HttpSyncError && [
        400, 409, 410, 413, 422,
      ].includes(error.status)) {
        await this.repository.sync.reject(operation, error.code);

        return;
      }

      throw error;
    }
  }

  private async cycle() {
    this.controller = new AbortController();
    this.publish({
      phase: "syncing",
      message: null,
      progress: "Invio modifiche…",
    });
    let processed = 0;

    while (processed < 1000) {
      const summary = await this.repository.sync.summary();
      const pendingIds = new Set(summary.pending.map((entry) => entry.operationId));
      const failedIds = new Set(summary.recoveries.map((entry) => entry.operationId));
      const operation = summary.pending.sort((a, b) => {
        const rank = (entry: OutboxOperation) => entry.entityType === "photo" && entry.action !== "delete" ? 1 : 0;
        const byRank = rank(a) - rank(b);
        const byTime = a.queuedAt.localeCompare(b.queuedAt);

        if (byRank !== 0) {
          return byRank;
        }

        return byTime === 0 ? a.localSequence - b.localSequence : byTime;
      })
        .find((entry) => !entry.dependsOn.some((dependency) => pendingIds.has(dependency)));

      this.publish({
        summary,
      });
      if (operation === undefined) {
        if (summary.pending.length !== 0) {
          throw new Error("Dipendenze della coda non risolte.");
        }
        break;
      }
      if (operation.dependsOn.some((dependency) => failedIds.has(dependency))) {
        await this.repository.sync.reject(operation, "dependency_rejected");
      } else {
        await this.send(operation);
      }
      processed += 1;
    }
    this.publish({
      progress: "Ricezione modifiche…",
    });
    let more = true;
    let reset = false;

    while (more) {
      const cursor = await this.repository.sync.cursor();
      let response: Response;

      try {
        response = await this.http(`/api/v1/sync/pull${cursor === null ? "" : `?cursor=${encodeURIComponent(cursor)}`}`);
      } catch (error) {
        if (error instanceof HttpSyncError && error.status === 410 && !reset) {
          await this.repository.sync.resetCursor();
          reset = true;
          continue;
        }

        throw error;
      }
      const page = parsePullPage(await response.json());

      await this.repository.sync.applyPage(page);
      more = page.hasMore;
    }
    const photos = await this.repository.sync.photosToDownload();

    for (const photo of photos) {
      this.publish({
        progress: `Scaricamento foto: ${photo.filename}`,
      });
      await this.download(photo);
    }
    await this.repository.sync.finish();
    this.failures = 0;
    const summary = await this.repository.sync.summary();

    this.publish({
      phase: summary.recoveries.length === 0 ? "idle" : "error",
      reachable: true,
      message: summary.recoveries.length === 0 ? null : "Alcune modifiche richiedono un recupero. I dati e gli allegati sono conservati sul dispositivo.",
      progress: null,
      summary,
    });
    this.controller = null;
    if (summary.pending.length > 0) {
      this.schedule(800);
    }
  }

  private async download(photo: LocalPhoto) {
    const original = await (await this.http(photoUrl(photo), {}, true)).blob();

    if (original.size !== photo.byteSize || await hashPhoto(await original.arrayBuffer()) !== photo.sha256) {
      throw new Error("Originale scaricato non integro.");
    }
    const thumbnail = await (await this.http(`${photoUrl(photo)}?variant=thumbnail`, {}, true)).blob();
    const preview = await (await this.http(`${photoUrl(photo)}?variant=preview`, {}, true)).blob();

    if (thumbnail.size === 0 || preview.size === 0) {
      throw new Error("Anteprime non disponibili.");
    }
    await this.repository.sync.storeDownloadedPhoto({
      ...photo,
      original,
      thumbnail,
      preview,
    });
  }
}
