import { inTransaction, readRequest } from "./database";
import { notifyLocalChange } from "./events";
import { createLocalId } from "./identity";
import { photoKey } from "./photo-store";
import { parseProductPatch } from "./product-input";
import { readSettings } from "./profile-settings";
import { questionnaireKey } from "./questionnaire-input";

import type {
  LocalProduct, LocalPersonalStand, LocalStandPreferences, OutboxOperation, ProductInput,
} from "../../types/offline";
import type { PhotoAsset, LocalPhoto } from "../../types/photos";
import type {
  SyncChange, PushResult, PullPage, SyncSummary, SyncRecovery,
} from "../../types/sync";

const stores = [
  "app_meta", "products", "personal_stands", "stand_preferences", "photos", "photo_assets", "outbox", "sync_receipts", "sync_recovery",
];

type SyncMeta = {
  key: "sync-state";
  cursor: string | null;
  lastSyncedAt: string | null;
};

export function sameSyncEntity(first: {
  entityType: string;
  profileId: string;
  eventId?: string | null;
  entityId: string;
}, second: {
  entityType: string;
  profileId: string;
  eventId?: string | null;
  entityId: string;
}) {
  return first.entityType === second.entityType && first.profileId === second.profileId
    && (first.eventId ?? null) === (second.eventId ?? null) && first.entityId === second.entityId;
}

export function productInput(data: Extract<SyncChange, {
  entityType: "product";
}>["data"]): ProductInput {
  const input: ProductInput = {
    name: data.name,
    categoryId: data.categoryId,
    standRef: data.standRef,
    description: data.description,
    price: (data.price === null || data.price === undefined) ? "" : String(data.price),
    rating: data.rating ?? null,
    favorite: data.favorite ?? false,
    plannedProductId: data.plannedProductId ?? null,
    questionnaireInputs: data.questionnaireAnswers ?? [],
  };

  parseProductPatch(input);

  return input;
}

async function applyChange(transaction: IDBTransaction, change: SyncChange, pending: OutboxOperation[]) {
  if (pending.some((operation) => sameSyncEntity(operation, change))) {
    return false;
  }
  const metadata = {
    serverRevision: change.revision,
    latestOperationId: `remote:${change.revision}`,
  };

  if (change.entityType === "profile" || change.entityType === "budget") {
    const settings = await readSettings(transaction);
    const profiles = settings.profiles;
    const budgets = settings.budgets;

    if (change.entityType === "profile") {
      const previous = profiles.find((entry) => entry.id === change.entityId);

      if ((previous?.serverRevision ?? 0) >= change.revision) {
        return false;
      }
      settings.profiles = [
        ...profiles.filter((entry) => entry.id !== change.entityId), {
          ...change.data,
          ...metadata,
          enabled: change.data.deletedAt === null && change.data.enabled,
          localSequence: previous?.localSequence ?? 0,
        },
      ];
    } else {
      const previous = budgets.find((entry) => entry.profileId === change.profileId
        && entry.categoryId === change.entityId);

      if ((previous?.serverRevision ?? 0) >= change.revision) {
        return false;
      }
      settings.budgets = [
        ...budgets.filter((entry) => !(entry.profileId === change.profileId && entry.categoryId === change.entityId)), {
          ...change.data,
          ...metadata,
          localSequence: previous?.localSequence ?? 0,
        },
      ];
    }
    transaction.objectStore("app_meta").put(settings);

    return true;
  }
  const scope = {
    profileId: change.profileId,
    eventId: change.eventId ?? "",
  };
  const key = photoKey(scope, change.entityId);

  if (change.entityType === "stand-preferences") {
    const store = transaction.objectStore("stand_preferences");
    const preferenceKey = [
      scope.profileId, scope.eventId, change.data.standRef.source, change.data.standRef.standId,
    ];
    const previous = await readRequest<LocalStandPreferences | undefined>(store.get(preferenceKey));

    if ((previous?.serverRevision ?? 0) >= change.revision) {
      return false;
    }
    store.put({
      ...change.data,
      ...metadata,
      updatedAt: new Date().toISOString(),
      localSequence: previous?.localSequence ?? 0,
    } satisfies LocalStandPreferences);
  } else if (change.entityType === "photo") {
    const store = transaction.objectStore("photos");
    const previous = await readRequest<LocalPhoto | undefined>(store.get(key));

    if ((previous?.serverRevision ?? 0) >= change.revision) {
      return false;
    }
    store.put({
      ...change.data,
      ...metadata,
      remoteMediaStatus: change.mediaStatus ?? "pending",
      localSequence: previous?.localSequence ?? 0,
    } satisfies LocalPhoto);
  } else if (change.entityType === "product") {
    const store = transaction.objectStore("products");
    const previous = await readRequest<LocalProduct | undefined>(store.get(key));

    if ((previous?.serverRevision ?? 0) >= change.revision || previous?.lastValid === null) {
      return false;
    }
    const input = productInput(change.data);
    const preserveInput = previous !== undefined && Object.keys(previous.issues).length > 0;

    store.put({
      ...change.data,
      ...metadata,
      input: preserveInput ? {
        ...previous.input,
        questionnaireInputs: [
          ...previous.input.questionnaireInputs ?? [],
          ...input.questionnaireInputs?.filter((entry) => !(previous.input.questionnaireInputs ?? [])
            .some((saved) => questionnaireKey(saved.definitionSnapshot)
              === questionnaireKey(entry.definitionSnapshot))) ?? [],
        ],
      } : input,
      lastValid: change.data,
      issues: preserveInput ? previous.issues : {},
      localSequence: previous?.localSequence ?? 0,
    } satisfies LocalProduct);
  } else {
    const store = transaction.objectStore("personal_stands");
    const previous = await readRequest<LocalPersonalStand | undefined>(store.get(key));

    if ((previous?.serverRevision ?? 0) >= change.revision || previous?.lastValid === null) {
      return false;
    }
    const {
      name, description, categoryIds, hall, booth,
    } = change.data;

    store.put({
      ...change.data,
      ...metadata,
      input: previous?.input.name.trim() === "" ? previous.input
        : {
          name,
          description,
          categoryIds,
          hall,
          booth,
        },
      lastValid: change.data,
      localSequence: previous?.localSequence ?? 0,
    } satisfies LocalPersonalStand);
  }

  return true;
}

function operationRecord(transaction: IDBTransaction, operation: OutboxOperation) {
  switch (operation.entityType) {
    case "profile":
    case "budget": return null;
    case "stand-preferences": return {
      store: transaction.objectStore("stand_preferences"),
      key: [
        operation.profileId, operation.eventId, operation.payload.standRef.source, operation.payload.standRef.standId,
      ],
    };
    case "photo": return {
      store: transaction.objectStore("photos"),
      key: photoKey(operation, operation.entityId),
    };
    case "product": return {
      store: transaction.objectStore("products"),
      key: photoKey(operation, operation.entityId),
    };
    case "personal-stand": return {
      store: transaction.objectStore("personal_stands"),
      key: photoKey(operation, operation.entityId),
    };
  }
}

export class LocalSyncStore {
  constructor(private readonly database: IDBDatabase) {}

  async cursor() {
    return inTransaction(this.database, ["app_meta"], "readonly", async (transaction) => {
      const state = await readRequest<SyncMeta | undefined>(transaction.objectStore("app_meta").get("sync-state"));

      return state?.cursor ?? null;
    });
  }

  async summary(): Promise<SyncSummary> {
    return inTransaction(this.database, stores, "readonly", async (transaction) => {
      const pending = await readRequest<OutboxOperation[]>(transaction.objectStore("outbox").getAll());
      const recoveries = await readRequest<SyncRecovery[]>(transaction.objectStore("sync_recovery").getAll());
      const photos = await readRequest<LocalPhoto[]>(transaction.objectStore("photos").getAll());
      const assetKeys = new Set((await readRequest<IDBValidKey[]>(transaction.objectStore("photo_assets").getAllKeys())).map((key) => JSON.stringify(key)));
      const state = await readRequest<SyncMeta | undefined>(transaction.objectStore("app_meta").get("sync-state"));

      return {
        pending,
        recoveries: recoveries.filter((entry) => entry.resolved !== true),
        localPhotos: photos.filter((photo) => photo.deletedAt === null && photo.latestOperationId === null).length,
        missingPhotos: photos.filter((photo) => photo.deletedAt === null
          && !assetKeys.has(JSON.stringify(photoKey(photo, photo.id)))).length,
        lastSyncedAt: state?.lastSyncedAt ?? null,
      };
    });
  }

  async acknowledge(operation: OutboxOperation, result: PushResult) {
    if (result.operationId !== operation.operationId || result.status !== "accepted" || result.current === undefined
      || !sameSyncEntity(operation, result.current)) {
      throw new Error("Conferma server non valida.");
    }
    const revision = result.current.revision;

    await inTransaction(this.database, stores, "readwrite", async (transaction) => {
      const queued = await readRequest<OutboxOperation | undefined>(transaction.objectStore("outbox").get(operation.operationId));

      if (queued === undefined) {
        return;
      }
      transaction.objectStore("outbox").delete(operation.operationId);
      const remaining = await readRequest<OutboxOperation[]>(transaction.objectStore("outbox").getAll());
      const target = operationRecord(transaction, operation);

      if (target !== null) {
        const record = await readRequest<{
          serverRevision: number | null;
          localSequence: number;
        } | undefined>(target.store.get(target.key));

        if (record !== undefined) {
          if (record.localSequence === operation.localSequence && result.current !== undefined) {
            await applyChange(transaction, result.current, remaining);
          } else {
            target.store.put({
              ...record,
              serverRevision: Math.max(record.serverRevision ?? 0, revision),
            });
          }
        }
      } else {
        const settings = await readSettings(transaction);

        if (operation.entityType === "profile") {
          settings.profiles = settings.profiles.map((profile) => profile.id === operation.entityId
            ? {
              ...profile,
              serverRevision: Math.max(profile.serverRevision ?? 0, revision),
            } : profile);
        } else {
          settings.budgets = settings.budgets.map((budget) => budget.profileId === operation.profileId
            && budget.categoryId === operation.entityId
            ? {
              ...budget,
              serverRevision: Math.max(budget.serverRevision ?? 0, revision),
            } : budget);
        }
        transaction.objectStore("app_meta").put(settings);
      }
      transaction.objectStore("sync_receipts").put({
        operationId: operation.operationId,
        revision,
        confirmedAt: new Date().toISOString(),
      });
      transaction.objectStore("outbox").delete(operation.operationId);
    }, false);
  }

  async reject(operation: OutboxOperation, code: string, current?: SyncChange) {
    await inTransaction(this.database, stores, "readwrite", async (transaction) => {
      const operations = await readRequest<OutboxOperation[]>(transaction.objectStore("outbox").getAll());
      const blocked = new Set([operation.operationId]);
      let expanded = true;

      while (expanded) {
        expanded = false;
        for (const entry of operations) {
          if (!blocked.has(entry.operationId) && entry.dependsOn.some((dependency) => blocked.has(dependency))) {
            blocked.add(entry.operationId);
            expanded = true;
          }
        }
      }
      for (const entry of operations.filter((candidate) => blocked.has(candidate.operationId))) {
        const productId = entry.entityType === "photo" ? entry.payload.productId : entry.entityId;
        const product = entry.eventId === undefined ? undefined : await readRequest<LocalProduct | undefined>(
          transaction.objectStore("products").get(photoKey(entry, productId)),
        );
        const standId = entry.entityType === "personal-stand" ? entry.entityId : product?.lastValid?.standRef.standId;
        const noStand = entry.eventId === undefined || standId === undefined;
        const stand = noStand ? undefined : await readRequest<LocalPersonalStand | undefined>(
          transaction.objectStore("personal_stands").get([
            entry.profileId, entry.eventId, standId,
          ]),
        );

        const photos = entry.eventId === undefined ? [] : await readRequest<LocalPhoto[]>(
          transaction.objectStore("photos").index("by_product").getAll([
            entry.profileId, entry.eventId, productId,
          ]),
        );

        transaction.objectStore("sync_recovery").put({
          operationId: entry.operationId,
          operation: entry,
          code: entry.operationId === operation.operationId ? code : "dependency_rejected",
          product,
          stand,
          photos,
        } satisfies SyncRecovery);
        transaction.objectStore("outbox").delete(entry.operationId);
      }
      if (current !== undefined) {
        await applyChange(transaction, current, operations.filter((entry) => !blocked.has(entry.operationId)));
      }
    }, false);
    notifyLocalChange(this.database.name, "remote");
  }

  async applyPage(page: PullPage) {
    const changed = await inTransaction(this.database, stores, "readwrite", async (transaction) => {
      let applied = false;
      const operations = await readRequest<OutboxOperation[]>(transaction.objectStore("outbox").getAll());

      for (const change of page.changes) {
        applied = await applyChange(transaction, change, operations) || applied;
      }
      const store = transaction.objectStore("app_meta");
      const previous = await readRequest<SyncMeta | undefined>(store.get("sync-state"));

      store.put({
        key: "sync-state",
        cursor: page.cursor,
        lastSyncedAt: previous?.lastSyncedAt ?? null,
      } satisfies SyncMeta);

      return applied;
    }, false);

    if (changed) {
      notifyLocalChange(this.database.name, "remote");
    }
  }

  async finish() {
    await inTransaction(this.database, ["app_meta"], "readwrite", async (transaction) => {
      const store = transaction.objectStore("app_meta");
      const previous = await readRequest<SyncMeta | undefined>(store.get("sync-state"));

      store.put({
        key: "sync-state",
        cursor: previous?.cursor ?? null,
        lastSyncedAt: new Date().toISOString(),
      } satisfies SyncMeta);
    }, false);
  }

  async resetCursor() {
    await inTransaction(this.database, stores, "readwrite", async (transaction) => {
      transaction.objectStore("app_meta").put({
        key: "sync-state",
        cursor: null,
        lastSyncedAt: null,
      } satisfies SyncMeta);
      for (const name of [
        "products", "personal_stands", "stand_preferences", "photos",
      ]) {
        const store = transaction.objectStore(name);
        const records = await readRequest<{
          serverRevision: number | null;
        }[]>(store.getAll());

        for (const record of records) {
          store.put({
            ...record,
            serverRevision: null,
          });
        }
      }
      const settings = await readSettings(transaction);

      settings.profiles = settings.profiles.map((entry) => ({
        ...entry,
        serverRevision: null,
      }));
      settings.budgets = settings.budgets.map((entry) => ({
        ...entry,
        serverRevision: null,
      }));
      transaction.objectStore("app_meta").put(settings);
    }, false);
  }

  async photosToDownload(): Promise<LocalPhoto[]> {
    return inTransaction(this.database, ["photos", "photo_assets"], "readonly", async (transaction) => {
      const photos = await readRequest<LocalPhoto[]>(transaction.objectStore("photos").getAll());
      const keys = new Set((await readRequest<IDBValidKey[]>(transaction.objectStore("photo_assets").getAllKeys())).map((key) => JSON.stringify(key)));

      return photos.filter((photo) => photo.deletedAt === null && photo.remoteMediaStatus === "ready"
        && !keys.has(JSON.stringify(photoKey(photo, photo.id))));
    });
  }

  async storeDownloadedPhoto(asset: PhotoAsset) {
    await inTransaction(this.database, ["photos", "photo_assets"], "readwrite", async (transaction) => {
      const photo = await readRequest<LocalPhoto | undefined>(transaction.objectStore("photos").get(photoKey(asset, asset.id)));

      if (photo?.deletedAt === null && photo.sha256 === asset.sha256) {
        transaction.objectStore("photo_assets").put(asset);
      }
    }, false);
    notifyLocalChange(this.database.name, "remote");
  }

  async recovery(id: string): Promise<SyncRecovery | undefined> {
    return inTransaction(this.database, ["sync_recovery"], "readonly", (transaction) => readRequest<SyncRecovery | undefined>(transaction.objectStore("sync_recovery").get(id)));
  }

  async saveRecovery(entry: SyncRecovery) {
    await inTransaction(this.database, ["sync_recovery"], "readwrite", (transaction) => {
      transaction.objectStore("sync_recovery").put(entry);
    });
  }

  async existingMapping(key: string) {
    return inTransaction(this.database, ["app_meta"], "readonly", async (transaction) => {
      const entry = await readRequest<{
        value: string;
      } | undefined>(
        transaction.objectStore("app_meta").get(key),
      );

      return entry?.value;
    });
  }

  async mappedId(key: string, prefix = "") {
    return inTransaction(this.database, ["app_meta"], "readwrite", async (transaction) => {
      const store = transaction.objectStore("app_meta");
      const previous = await readRequest<{
        value: string;
      } | undefined>(store.get(key));
      const value = previous?.value ?? `${prefix}${createLocalId()}`;

      store.put({
        key,
        value,
      });

      return value;
    }, false);
  }

  async resolveRecovery(operation: OutboxOperation, includePhotos = false) {
    await inTransaction(this.database, ["sync_recovery"], "readwrite", async (transaction) => {
      const store = transaction.objectStore("sync_recovery");
      const entries = await readRequest<SyncRecovery[]>(store.getAll());

      for (const entry of entries) {
        if (sameSyncEntity(entry.operation, operation) || (includePhotos
          && entry.operation.entityType === "photo" && entry.operation.profileId === operation.profileId
          && entry.operation.eventId === operation.eventId
          && entry.operation.payload.productId === operation.entityId)) {
          store.put({
            ...entry,
            resolved: true,
          });
        }
      }
    });
  }

  async retryOperation(id: string) {
    await inTransaction(this.database, stores, "readwrite", async (transaction) => {
      const store = transaction.objectStore("sync_recovery");
      const entry = await readRequest<SyncRecovery | undefined>(store.get(id));

      if (entry === undefined || entry.resolved === true) {
        return;
      }
      const operation = entry.operation;
      const all = await readRequest<SyncRecovery[]>(store.getAll());
      const rejected = new Set(all.map((recovery) => recovery.operationId));

      const operationId = createLocalId();
      const target = operationRecord(transaction, operation);
      const current = target === null ? undefined : await readRequest<{
        localSequence: number;
      } | undefined>(target.store.get(target.key));
      const queued = await readRequest<OutboxOperation[]>(transaction.objectStore("outbox").getAll());
      const localSequence = Math.max(
        operation.localSequence,
        current?.localSequence ?? 0,
        ...queued.filter((item) => sameSyncEntity(item, operation)).map((item) => item.localSequence),
      ) + 1;

      if (target !== null && current !== undefined) {
        target.store.put({
          ...current,
          localSequence,
          latestOperationId: operationId,
        });
      } else {
        const settings = await readSettings(transaction);

        if (operation.entityType === "profile") {
          settings.profiles = settings.profiles.map((profile) => profile.id === operation.entityId
            ? {
              ...profile,
              ...operation.payload,
              localSequence,
              latestOperationId: operationId,
            } : profile);
        }
        settings.budgets = settings.budgets.map((budget) => sameSyncEntity({
          entityType: "budget",
          profileId: budget.profileId,
          entityId: budget.categoryId,
        }, operation) ? {
            ...budget,
            localSequence,
            latestOperationId: operationId,
          } : budget);
        transaction.objectStore("app_meta").put(settings);
      }
      transaction.objectStore("outbox").add({
        ...operation,
        operationId,
        localSequence,
        dependsOn: operation.dependsOn.filter((dependency) => !rejected.has(dependency)),
        queuedAt: new Date().toISOString(),
      });
      store.put({
        ...entry,
        resolved: true,
      });
    });
  }

  async lease(owner: string, release = false): Promise<boolean> {
    return inTransaction(this.database, ["app_meta"], "readwrite", async (transaction) => {
      const store = transaction.objectStore("app_meta");
      const current = await readRequest<{
        owner: string;
        expires: number;
      } | undefined>(store.get("sync-lease"));

      if (current !== undefined && current.owner !== owner && current.expires > Date.now()) {
        return false;
      }
      store.put({
        key: "sync-lease",
        owner,
        expires: release ? 0 : Date.now() + 30000,
      });

      return true;
    }, false);
  }
}
