import { createHash } from "node:crypto";
import {
  mkdir, mkdtemp, open, readFile, rename, rm,
} from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { inspectPhoto, MAX_PHOTO_BYTES, MAX_PHOTO_PIXELS } from "../offline/photo-input";
import { parseChange } from "../sync/contracts";

import { transaction } from "./database";
import { SyncRequestError } from "./sync";

import type { LocalContext } from "../../types/offline";
import type { PhotoData } from "../../types/photos";
import type { SyncChange } from "../../types/sync";
import type { Pool, PoolClient } from "pg";

type PhotoRecord = {
  data: PhotoData;
  revision: number;
  mediaStatus: "pending" | "ready";
  storageKey: string | null;
};

export class ServerMedia {
  constructor(private readonly pool: Pool, private readonly root: string) {}

  private async record(client: Pool | PoolClient, scope: LocalContext, id: string): Promise<PhotoRecord> {
    const result = await client.query<PhotoRecord>(`SELECT f.data,f.revision::float8 AS revision,
      f.media_status AS "mediaStatus",f.storage_key AS "storageKey" FROM photos f
      JOIN products p ON p.profile_id=f.profile_id AND p.event_id=f.event_id AND p.id=f.product_id
      JOIN profiles u ON u.id=f.profile_id
      WHERE f.profile_id=$1 AND f.event_id=$2 AND f.id=$3 AND f.deleted_at IS NULL
        AND p.deleted_at IS NULL AND u.deleted_at IS NULL`, [
      scope.profileId, scope.eventId, id,
    ]);
    const row = result.rows.at(0);

    if (row === undefined) {
      throw new SyncRequestError("photo_unavailable", 410);
    }

    return row;
  }

  async upload(scope: LocalContext, id: string, request: Request): Promise<SyncChange> {
    const photo = await this.record(this.pool, scope, id);
    const key = createHash("sha256").update(JSON.stringify([
      scope.profileId, scope.eventId, id, photo.data.sha256,
    ])).digest("hex");

    await mkdir(this.root, {
      recursive: true,
    });
    const temporary = await mkdtemp(path.join(this.root, ".upload-"));

    try {
      if (request.body === null) {
        throw new SyncRequestError("empty_photo");
      }
      const original = await open(path.join(temporary, "original"), "wx");
      const hash = createHash("sha256");
      const reader = request.body.getReader();
      let size = 0;

      try {
        for (;;) {
          const chunk = await reader.read();

          if (chunk.done) {
            break;
          }
          size += chunk.value.byteLength;
          if (size > MAX_PHOTO_BYTES || size > photo.data.byteSize) {
            await reader.cancel();

            throw new SyncRequestError("photo_size", 413);
          }
          hash.update(chunk.value);
          await original.writeFile(chunk.value);
        }
        await original.sync();
      } finally {
        reader.releaseLock();
        await original.close();
      }
      if (size !== photo.data.byteSize || hash.digest("hex") !== photo.data.sha256) {
        throw new SyncRequestError("photo_integrity");
      }
      const bytes = await readFile(path.join(temporary, "original"));
      let inspected: ReturnType<typeof inspectPhoto>;

      try {
        inspected = inspectPhoto(bytes);
      } catch {
        throw new SyncRequestError("photo_integrity");
      }
      const image = sharp(bytes, {
        limitInputPixels: MAX_PHOTO_PIXELS,
        failOn: "error",
      });
      const metadata = await image.metadata().catch(() => {
        throw new SyncRequestError("photo_integrity");
      });
      const oriented = metadata.autoOrient;
      const width = oriented.width;
      const height = oriented.height;

      if (inspected.contentType !== photo.data.contentType || width !== photo.data.width
        || height !== photo.data.height || (metadata.pages ?? 1) !== 1) {
        throw new SyncRequestError("photo_integrity");
      }
      // Decode the image, not just its header. Derivatives never replace the original.
      const preview = await image.clone().autoOrient().resize({
        width: 2048,
        height: 2048,
        fit: "inside",
        withoutEnlargement: true,
      }).jpeg({
        quality: 90,
      }).toBuffer().catch(() => {
        throw new SyncRequestError("photo_integrity");
      });
      const thumbnail = await image.clone().autoOrient().resize({
        width: 480,
        height: 480,
        fit: "inside",
        withoutEnlargement: true,
      }).jpeg({
        quality: 82,
      }).toBuffer().catch(() => {
        throw new SyncRequestError("photo_integrity");
      });

      await durableFile(path.join(temporary, "preview"), preview);
      await durableFile(path.join(temporary, "thumbnail"), thumbnail);
      await syncDirectory(temporary);
      try {
        await rename(temporary, path.join(this.root, key));
      } catch (error) {
        if (!(typeof error === "object" && error !== null && "code" in error
          && (error.code === "EEXIST" || error.code === "ENOTEMPTY"))) {
          throw error;
        }
        const existing = await readFile(path.join(this.root, key, "original"));

        if (createHash("sha256").update(existing).digest("hex") !== photo.data.sha256) {
          throw new SyncRequestError("photo_integrity");
        }
      }
      await syncDirectory(this.root);

      return await transaction(this.pool, async (client) => {
        await client.query("SELECT revision FROM server_state WHERE singleton FOR UPDATE");
        const latest = await this.record(client, scope, id);

        if (latest.data.sha256 !== photo.data.sha256) {
          throw new SyncRequestError("photo_integrity");
        }
        if (latest.mediaStatus !== "ready") {
          await client.query(`UPDATE photos SET storage_key=$4,media_status='ready'
            WHERE profile_id=$1 AND event_id=$2 AND id=$3`, [
            scope.profileId, scope.eventId, id, key,
          ]);
        }
        const ready = await this.record(client, scope, id);

        return parseChange({
          entityType: "photo",
          data: ready.data,
          revision: ready.revision,
          profileId: scope.profileId,
          eventId: scope.eventId,
          entityId: id,
          mediaStatus: "ready",
        });
      });
    } catch (error) {
      if (error instanceof SyncRequestError) {
        throw error;
      }
      if (typeof error === "object" && error !== null && "code" in error
        && (error.code === "ENOSPC" || error.code === "EDQUOT")) {
        throw new SyncRequestError("storage_full", 507);
      }

      throw error;
    } finally {
      await rm(temporary, {
        recursive: true,
        force: true,
      });
    }
  }

  async download(scope: LocalContext, id: string, variant: string): Promise<Response> {
    if (![
      "original", "preview", "thumbnail",
    ].includes(variant)) {
      throw new SyncRequestError("invalid_variant", 400);
    }
    const record = await this.record(this.pool, scope, id);

    if (record.mediaStatus !== "ready" || record.storageKey === null) {
      throw new SyncRequestError("photo_pending", 404);
    }
    if (!/^[a-f0-9]{64}$/u.test(record.storageKey)) {
      throw new Error("Riferimento media non valido.");
    }
    const bytes = await readFile(path.join(this.root, record.storageKey, variant));
    const contentType = variant === "original" ? record.data.contentType : "image/jpeg";

    const extension = contentType === "image/jpeg" ? "jpg" : contentType.slice(6);

    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(bytes.length),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": `inline; filename="foto.${extension}"`,
      },
    });
  }
}

async function durableFile(file: string, data: Uint8Array) {
  const handle = await open(file, "wx");

  try {
    await handle.writeFile(data);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function syncDirectory(directory: string) {
  const handle = await open(directory, "r");

  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}
