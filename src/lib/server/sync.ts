import { createHash } from "node:crypto";

import { parseEntity, parseOperation, parseChange } from "../sync/contracts";

import { transaction } from "./database";

import type { OutboxOperation } from "../../types/offline";
import type {
  SyncChange, PushResult, PullPage, SyncEntity,
} from "../../types/sync";
import type { Pool, PoolClient } from "pg";

export class SyncRequestError extends Error {
  constructor(readonly code: string, readonly status = 422) {
    super(code);
  }
}

export const entityTables = {
  profile: "profiles",
  budget: "budget_overrides",
  product: "products",
  "personal-stand": "personal_stands",
  "stand-preferences": "stand_preferences",
  photo: "photos",
} as const;

function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry: unknown) => canonical(entry)).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    return `{${Object.entries(value).filter(([, entry]) => entry !== undefined).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(",")}}`;
  }

  return JSON.stringify(value);
}

export function dataHash(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

export function entityWhere(operation: Pick<OutboxOperation, "entityType" | "entityId" | "profileId" | "eventId" | "payload">) {
  switch (operation.entityType) {
    case "profile": return {
      sql: "id=$1",
      values: [operation.profileId],
    };
    case "budget": return {
      sql: "profile_id=$1 AND category_id=$2",
      values: [operation.profileId, operation.entityId],
    };
    case "stand-preferences": {
      const entity = parseEntity(operation.entityType, operation.payload);

      if (entity.entityType !== "stand-preferences") {
        throw new SyncRequestError("invalid_payload");
      }

      return {
        sql: "profile_id=$1 AND event_id=$2 AND stand_source=$3 AND stand_id=$4",
        values: [
          operation.profileId, operation.eventId, entity.data.standRef.source, entity.data.standRef.standId,
        ],
      };
    }
    case "product":
    case "personal-stand":
    case "photo": return {
      sql: "profile_id=$1 AND event_id=$2 AND id=$3",
      values: [
        operation.profileId, operation.eventId, operation.entityId,
      ],
    };
  }
}

export async function currentRecord(client: PoolClient, operation: OutboxOperation): Promise<SyncChange | undefined> {
  const where = entityWhere(operation);
  const result = await client.query<{
    data: unknown;
    revision: number;
    mediaStatus?: string;
  }>(`
    SELECT data,revision::float8 AS revision${operation.entityType === "photo" ? ',media_status AS "mediaStatus"' : ""}
    FROM ${entityTables[operation.entityType]} WHERE ${where.sql}`, where.values);
  const row = result.rows.at(0);

  if (row === undefined || row.revision === 0) {
    return undefined;
  }

  return parseChange({
    ...row,
    entityType: operation.entityType,
    profileId: operation.profileId,
    eventId: operation.eventId ?? null,
    entityId: operation.entityId,
  });
}

class RejectedOperation extends Error {
  constructor(readonly code: string, readonly current?: SyncChange) {
    super(code);
  }
}

function reject(code: string, current?: SyncChange): never {
  throw new RejectedOperation(code, current);
}

async function validateRelationships(client: PoolClient, operation: OutboxOperation, entity: SyncEntity) {
  if (entity.entityType === "profile") {
    const existing = await client.query<{
      origin: string;
    }>("SELECT origin FROM profiles WHERE id=$1", [operation.profileId]);

    if (existing.rows.at(0)?.origin === "json") {
      reject("configured_profile");
    }

    return;
  }
  const profile = await client.query<{
    deleted_at: string | null;
  }>("SELECT deleted_at FROM profiles WHERE id=$1", [operation.profileId]);

  if (profile.rowCount !== 1 || profile.rows[0].deleted_at !== null) {
    reject("profile_deleted");
  }
  if (operation.eventId !== undefined) {
    const event = await client.query("SELECT FROM events WHERE id=$1", [operation.eventId]);

    if (event.rowCount !== 1) {
      reject("event_missing");
    }
  }
  if ((entity.entityType === "product" || entity.entityType === "stand-preferences")
    && entity.data.standRef.source === "personal") {
    const stand = await client.query<{
      deleted_at: string | null;
    }>(`SELECT deleted_at FROM personal_stands
      WHERE profile_id=$1 AND event_id=$2 AND id=$3`, [
      operation.profileId, operation.eventId, entity.data.standRef.standId,
    ]);

    if (stand.rowCount !== 1 || stand.rows[0].deleted_at !== null) {
      reject("stand_deleted");
    }
  }
  if (entity.entityType === "photo") {
    const parent = await client.query<{
      deleted_at: string | null;
    }>(`SELECT deleted_at FROM products
      WHERE profile_id=$1 AND event_id=$2 AND id=$3`, [
      operation.profileId, operation.eventId, entity.data.productId,
    ]);

    if (parent.rowCount !== 1 || parent.rows[0].deleted_at !== null) {
      reject("product_deleted");
    }
  }
  if (entity.entityType === "personal-stand" && operation.action === "delete") {
    const linked = await client.query(`SELECT FROM products WHERE profile_id=$1 AND event_id=$2
      AND stand_source='personal' AND stand_id=$3 AND deleted_at IS NULL LIMIT 1`, [
      operation.profileId, operation.eventId, operation.entityId,
    ]);

    if (linked.rowCount !== 0) {
      reject("stand_has_products");
    }
  }
}

async function writeEntity(client: PoolClient, operation: OutboxOperation, entity: SyncEntity, previous?: SyncChange) {
  if (previous !== undefined && "deletedAt" in previous.data && previous.data.deletedAt !== null) {
    if (operation.action === "delete") {
      return previous;
    }
    reject("deleted", previous);
  }
  await validateRelationships(client, operation, entity);
  if (operation.action === "create" && previous !== undefined
    && entity.entityType !== "budget" && entity.entityType !== "stand-preferences") {
    reject("identity_exists", previous);
  }
  if (operation.action !== "create" && previous === undefined) {
    reject("record_missing");
  }
  if (entity.entityType === "photo") {
    if (previous?.entityType === "photo" && (previous.data.sha256 !== entity.data.sha256
      || previous.data.byteSize !== entity.data.byteSize || previous.data.contentType !== entity.data.contentType
      || previous.data.productId !== entity.data.productId)) {
      reject("photo_integrity", previous);
    }
    if (entity.data.isPrimary && entity.data.deletedAt === null) {
      await client.query(
        `UPDATE photos SET data=jsonb_set(data,'{isPrimary}','false')
        WHERE profile_id=$1 AND event_id=$2 AND product_id=$3 AND id<>$4 AND is_primary AND deleted_at IS NULL`,
        [
          operation.profileId, operation.eventId, entity.data.productId, operation.entityId,
        ],
      );
    }
  }
  if (previous !== undefined) {
    const where = entityWhere(operation);

    await client.query(`UPDATE ${entityTables[operation.entityType]} SET data=$${where.values.length + 1}
      WHERE ${where.sql}`, [...where.values, entity.data]);
  } else {
    switch (entity.entityType) {
      case "profile":
        await client.query("INSERT INTO profiles(id,origin,data) VALUES ($1,'personal',$2)", [operation.profileId, entity.data]);
        break;
      case "budget":
        await client.query("INSERT INTO budget_overrides(profile_id,category_id,data) VALUES ($1,$2,$3)", [
          operation.profileId, operation.entityId, entity.data,
        ]);
        break;
      case "stand-preferences":
        await client.query("INSERT INTO stand_preferences(profile_id,event_id,data) VALUES ($1,$2,$3)", [
          operation.profileId, operation.eventId, entity.data,
        ]);
        break;
      case "personal-stand":
      case "product":
      case "photo":
        await client.query(
          `INSERT INTO ${entityTables[entity.entityType]}(profile_id,event_id,id,data) VALUES ($1,$2,$3,$4)`,
          [
            operation.profileId, operation.eventId, operation.entityId, entity.data,
          ],
        );
        break;
    }
  }
  if (entity.entityType === "product" && operation.action === "delete") {
    await client.query(
      `UPDATE photos SET data=data || jsonb_build_object('deletedAt',$4::text,'isPrimary',false)
      WHERE profile_id=$1 AND event_id=$2 AND product_id=$3 AND deleted_at IS NULL`,
      [
        operation.profileId, operation.eventId, operation.entityId, entity.data.deletedAt,
      ],
    );
  }
  const current = await currentRecord(client, operation);

  if (current === undefined) {
    throw new Error("Conferma record non disponibile.");
  }

  return current;
}

export class ServerSync {
  constructor(readonly pool: Pool) {}

  async push(value: unknown): Promise<PushResult> {
    let operation: OutboxOperation;

    try {
      operation = parseOperation(value);
    } catch {
      throw new SyncRequestError("invalid_payload");
    }
    const hash = dataHash(operation);

    return transaction(this.pool, async (client) => {
      await client.query("SELECT revision FROM server_state WHERE singleton FOR UPDATE");
      const replay = await client.query<{
        payload_hash: string;
        response: PushResult;
      }>("SELECT payload_hash,response FROM server_operations WHERE operation_id=$1", [operation.operationId]);
      const accepted = replay.rows.at(0);

      if (accepted !== undefined) {
        if (accepted.payload_hash !== hash) {
          throw new SyncRequestError("operation_id_reused", 409);
        }

        return accepted.response;
      }
      for (const dependency of operation.dependsOn) {
        const result = await client.query<{
          response: PushResult;
        }>("SELECT response FROM server_operations WHERE operation_id=$1", [dependency]);
        const receipt = result.rows.at(0)?.response;

        if (receipt?.status !== "accepted") {
          return {
            operationId: operation.operationId,
            status: "retry",
            code: "dependency_pending",
          };
        }
      }
      const previous = await currentRecord(client, operation);
      let response: PushResult;

      await client.query("SAVEPOINT mutation");
      try {
        const entity = parseEntity(operation.entityType, operation.payload);
        const current = await writeEntity(client, operation, entity, previous);

        response = {
          operationId: operation.operationId,
          status: "accepted",
          current,
        };
        await client.query("RELEASE SAVEPOINT mutation");
      } catch (error) {
        await client.query("ROLLBACK TO SAVEPOINT mutation");
        if (!(error instanceof RejectedOperation)
          && !(typeof error === "object" && error !== null && "code" in error
            && typeof error.code === "string" && [
            "23503", "23505", "23514", "P0001", "22P02",
          ].includes(error.code))) {
          throw error;
        }
        response = {
          operationId: operation.operationId,
          status: "rejected",
          code: error instanceof RejectedOperation ? error.code : "domain_constraint",
          ...(previous === undefined ? {} : {
            current: previous,
          }),
        };
      }
      await client.query(`INSERT INTO server_operations(operation_id,profile_id,event_id,entity_type,entity_id,payload_hash,response)
        VALUES ($1,$2,$3,$4,$5,$6,$7)`, [
        operation.operationId,
        operation.profileId,
        operation.eventId ?? null,
        operation.entityType,
        operation.entityId,
        hash,
        response,
      ]);

      return response;
    });
  }

  async pull(cursor: string | null, limit = 100): Promise<PullPage> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200) {
      throw new SyncRequestError("invalid_limit", 400);
    }

    return transaction(this.pool, async (client) => {
      const state = (await client.query<{
        epoch: string;
        revision: string;
      }>(
        "SELECT epoch::text,revision::text FROM server_state WHERE singleton",
      )).rows[0];
      let after = 0;

      if (cursor !== null) {
        try {
          const decoded = Buffer.from(cursor, "base64url").toString("utf8").split(":");

          after = Number(decoded[1]);
          if (decoded.length !== 2 || decoded[0] !== state.epoch || !Number.isSafeInteger(after)
            || after < 0 || after > Number(state.revision)) {
            throw new Error("cursor");
          }
        } catch {
          throw new SyncRequestError("cursor_expired", 410);
        }
      }
      const records = await client.query<{
        entityType: string;
        data: unknown;
        profileId: string;
        eventId: string | null;
        entityId: string;
        revision: number;
        mediaStatus: string | null;
      }>(`
        SELECT entity_type AS "entityType",data,profile_id AS "profileId",event_id AS "eventId",
        entity_id AS "entityId",revision::float8 AS revision,media_status AS "mediaStatus"
        FROM server_changes WHERE revision>$1 ORDER BY revision LIMIT $2`, [after, limit + 1]);
      const changes = records.rows.slice(0, limit).map((row) => parseChange({
        ...row,
        entityId: row.entityType === "stand-preferences" ? JSON.stringify([
          (row.data as {
            standRef: {
              source: string;
            };
          }).standRef.source,
          (row.data as {
            standRef: {
              standId: string;
            };
          }).standRef.standId,
        ]) : row.entityId,
        ...(row.mediaStatus === null ? {
          mediaStatus: undefined,
        } : {}),
      }));
      const hasMore = records.rows.length > limit;
      const next = hasMore ? changes.at(-1)?.revision ?? after : Number(state.revision);

      return {
        changes,
        hasMore,
        cursor: Buffer.from(`${state.epoch}:${next}`).toString("base64url"),
      };
    }, true);
  }
}
