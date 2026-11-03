import {
  array, boolean, freeText, integer, number, object, text, unique,
} from "../config/validation";
import { parsePersonalStandPatch } from "../offline/personal-stand-input";
import { MAX_PHOTO_BYTES, validatePhotoDimensions } from "../offline/photo-input";
import { parseProductPatch } from "../offline/product-input";
import { parseQuestionnaireInputs, validateQuestionnaireAnswers } from "../offline/questionnaire-input";
import { applyStandPatch } from "../offline/stand-input";

import type { StandReference } from "../../types/catalog";
import type { OutboxOperation } from "../../types/offline";
import type {
  SyncChange, SyncEntity, PushResult, PullPage,
} from "../../types/sync";

export function identity(value: unknown): string {
  const result = text(value, "id");

  if (result.length > 512 || (/[/\\]/u.test(result) || Array.from(result).some((character) => character.charCodeAt(0) < 32))) {
    throw new Error("Identificativo non valido.");
  }

  return result;
}

function timestamp(value: unknown): string {
  const result = text(value, "timestamp");

  if (!Number.isFinite(Date.parse(result))) {
    throw new Error("Data non valida.");
  }

  return result;
}

function standReference(value: unknown): StandReference {
  const ref = object(value, "standRef", [
    "source", "eventId", "standId",
  ]);

  if (ref.source !== "catalog" && ref.source !== "personal") {
    throw new Error("Origine stand non valida.");
  }

  return {
    source: ref.source,
    eventId: identity(ref.eventId),
    standId: identity(ref.standId),
  };
}

function money(value: unknown): number | null {
  if (value === null) {
    return null;
  }
  const amount = number(value, "amount");

  if (amount < 0 || amount > Number.MAX_SAFE_INTEGER / 100
    || Math.round(amount * 100) / 100 !== amount) {
    throw new Error("Importo non valido.");
  }

  return amount;
}

export function parseEntity(kind: unknown, value: unknown): SyncEntity {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Dati non validi.");
  }
  const data: Record<string, unknown> = {
    ...value,
  };

  // Device bookkeeping is never stored as domain data on the server.
  delete data.localSequence;
  delete data.serverRevision;
  delete data.latestOperationId;
  if (kind === "profile") {
    object(data, "profile", [
      "id", "origin", "name", "color", "icon", "enabled", "budgets", "deletedAt",
    ]);
    if (data.origin !== "personal" || !/^#[\da-f]{6}$/iu.test(text(data.color, "color"))
      || !Array.isArray(data.budgets) || data.budgets.length !== 0) {
      throw new Error("Profilo personale non valido.");
    }

    return {
      entityType: kind,
      data: {
        id: identity(data.id),
        origin: "personal",
        name: text(data.name, "name"),
        color: String(data.color),
        icon: "user-round",
        enabled: boolean(data.enabled, "enabled"),
        budgets: [],
        deletedAt: data.deletedAt === null ? null : timestamp(data.deletedAt),
      },
    };
  }
  const profileId = identity(data.profileId);

  if (kind === "budget") {
    object(data, "budget", [
      "profileId", "categoryId", "amount", "currency", "removed",
    ]);
    if (data.currency !== "EUR") {
      throw new Error("Valuta non valida.");
    }

    return {
      entityType: kind,
      data: {
        profileId,
        categoryId: identity(data.categoryId),
        amount: money(data.amount),
        currency: "EUR",
        removed: boolean(data.removed, "removed"),
      },
    };
  }
  const eventId = identity(data.eventId);
  const scope = {
    profileId,
    eventId,
  };

  if (kind === "stand-preferences") {
    object(data, "preferences", [
      "profileId", "eventId", "standRef",
    ], [
      "interested", "priority", "visitStatus", "checklist", "checklistDone", "notes",
    ]);
    const standRef = standReference(data.standRef);
    const base = {
      ...scope,
      standRef,
    };
    const patch = Object.fromEntries(Object.entries(data).filter(([key]) => [
      "interested", "priority", "visitStatus", "notes",
    ].includes(key)));
    const parsed = Object.keys(patch).length === 0 ? base : applyStandPatch(base, [], patch);

    return {
      entityType: kind,
      data: {
        ...parsed,
        ...(data.checklist === undefined ? {} : {
          checklist: unique(array(data.checklist, "checklist", (entry) => {
            const item = object(entry, "checklist", ["id", "text"]);

            return {
              id: identity(item.id),
              text: text(item.text, "text"),
            };
          }), "checklist", (item) => item.id),
        }),
        ...(data.checklistDone === undefined ? {} : {
          checklistDone: Object.fromEntries(
            Object.entries(objectRecord(data.checklistDone)).map(([key, checked]) =>
              [identity(key), boolean(checked, key)]),
          ),
        }),
      },
    };
  }
  const id = identity(data.id);
  const createdAt = timestamp(data.createdAt);
  const updatedAt = timestamp(data.updatedAt);
  const deletedAt = (data.deletedAt === null || data.deletedAt === undefined) ? null : timestamp(data.deletedAt);
  const base = {
    ...scope,
    id,
    createdAt,
    updatedAt,
    deletedAt,
  };

  if (kind === "personal-stand") {
    object(data, "stand", [
      "profileId", "eventId", "id", "name", "description", "categoryIds", "hall", "booth", "createdAt", "updatedAt", "deletedAt",
    ]);
    const input = {
      name: text(data.name, "name"),
      description: freeText(data.description, "description"),
      categoryIds: array(data.categoryIds, "categories", (entry) => identity(entry)),
      hall: data.hall === null ? null : identity(data.hall),
      booth: freeText(data.booth, "booth"),
    };

    parsePersonalStandPatch(input);

    return {
      entityType: kind,
      data: {
        ...base,
        ...input,
      },
    };
  }
  if (kind === "product") {
    object(data, "product", [
      "profileId", "eventId", "id", "name", "description", "categoryId", "standRef", "createdAt", "updatedAt",
    ], [
      "deletedAt", "price", "rating", "favorite", "plannedProductId", "questionnaireAnswers",
    ]);
    const answers = parseQuestionnaireInputs(data.questionnaireAnswers ?? []);
    const categoryId = identity(data.categoryId);
    const checked = validateQuestionnaireAnswers(answers, [], categoryId);
    const rating = (data.rating === null || data.rating === undefined) ? null : integer(data.rating, "rating");

    if (rating !== null && (rating < 1 || rating > 10)) {
      throw new Error("Voto non valido.");
    }
    if (Object.keys(checked.issues).length > 0 || answers.some((entry) =>
      entry.definitionSnapshot.profileId !== profileId || entry.definitionSnapshot.categoryId !== categoryId)) {
      throw new Error("Risposte questionario non valide.");
    }
    const result = {
      ...base,
      name: text(data.name, "name"),
      description: freeText(data.description, "description"),
      categoryId,
      standRef: standReference(data.standRef),
      price: money(data.price ?? null),
      rating,
      favorite: data.favorite === undefined ? false : boolean(data.favorite, "favorite"),
      plannedProductId: (data.plannedProductId === null || data.plannedProductId === undefined)
        ? null : identity(data.plannedProductId),
      questionnaireAnswers: answers,
    };

    parseProductPatch({
      name: result.name,
      standRef: result.standRef,
      categoryId,
    });

    return {
      entityType: kind,
      data: result,
    };
  }
  if (kind === "photo") {
    object(data, "photo", [
      "profileId", "eventId", "id", "productId", "filename", "contentType", "byteSize", "sha256", "width", "height", "isPrimary", "addedOrder", "createdAt", "updatedAt", "deletedAt",
    ]);
    const contentType = data.contentType;
    const byteSize = integer(data.byteSize, "byteSize");
    const width = integer(data.width, "width");
    const height = integer(data.height, "height");
    const sha256 = text(data.sha256, "sha256");

    if (![
      "image/jpeg", "image/png", "image/webp",
    ].includes(String(contentType))
      || byteSize < 1 || byteSize > MAX_PHOTO_BYTES || !/^[a-f0-9]{64}$/u.test(sha256)) {
      throw new Error("Metadati foto non validi.");
    }
    validatePhotoDimensions(width, height);
    if (contentType !== "image/jpeg" && contentType !== "image/png" && contentType !== "image/webp") {
      throw new Error("Formato foto non valido.");
    }

    return {
      entityType: kind,
      data: {
        ...base,
        productId: identity(data.productId),
        filename: text(data.filename, "filename"),
        contentType,
        byteSize,
        sha256,
        width,
        height,
        isPrimary: boolean(data.isPrimary, "isPrimary"),
        addedOrder: integer(data.addedOrder, "addedOrder"),
      },
    };
  }

  throw new Error("Tipo di entità non supportato.");
}

function objectRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Atteso un oggetto.");
  }

  return {
    ...value,
  };
}

function entityIdentity(entity: SyncEntity) {
  if (entity.entityType === "stand-preferences") {
    return JSON.stringify([entity.data.standRef.source, entity.data.standRef.standId]);
  }

  return entity.entityType === "budget" ? entity.data.categoryId : entity.data.id;
}

export function parseOperation(value: unknown): OutboxOperation {
  const operation = object(value, "operation", [
    "operationId",
    "profileId",
    "entityType",
    "entityId",
    "action",
    "localSequence",
    "baseRevision",
    "dependsOn",
    "payload",
    "status",
    "queuedAt",
  ], ["eventId"]);
  const entity = parseEntity(operation.entityType, operation.payload);
  const profileId = identity(operation.profileId);
  const expectedProfile = entity.entityType === "profile" ? entity.data.id : entity.data.profileId;
  const entityId = entityIdentity(entity);
  const eventId = "eventId" in entity.data ? entity.data.eventId : undefined;

  identity(operation.operationId);
  integer(operation.localSequence, "localSequence");
  if (operation.baseRevision !== null) {
    integer(operation.baseRevision, "baseRevision");
  }
  array(operation.dependsOn, "dependsOn", (entry) => identity(entry));
  timestamp(operation.queuedAt);
  if (profileId !== expectedProfile || operation.entityId !== entityId || operation.eventId !== eventId
    || operation.status !== "pending" || ![
    "create", "update", "delete",
  ].includes(String(operation.action))
    || (entity.entityType === "stand-preferences" || entity.entityType === "budget"
      ? operation.action === "delete"
      : (operation.action === "delete") !== (entity.data.deletedAt !== null))) {
    throw new Error("Proprietà, identità o azione dell’operazione non valida.");
  }

  // The envelope and every entity payload have been validated above.
  return value as OutboxOperation;
}

export function parseChange(value: unknown): SyncChange {
  const change = object(value, "change", [
    "entityType", "data", "profileId", "eventId", "entityId", "revision",
  ], ["mediaStatus"]);
  const entity = parseEntity(change.entityType, change.data);
  const profileId = identity(change.profileId);
  const eventId = change.eventId === null ? null : identity(change.eventId);
  const revision = integer(change.revision, "revision");
  const expectedId = entityIdentity(entity);

  if (revision < 1 || change.entityId !== expectedId
    || (entity.entityType === "profile" ? entity.data.id : entity.data.profileId) !== profileId
    || ("eventId" in entity.data ? entity.data.eventId : null) !== eventId
    || (change.mediaStatus !== undefined && change.mediaStatus !== "ready" && change.mediaStatus !== "pending")) {
    throw new Error("Record server non valido.");
  }

  return {
    ...entity,
    profileId,
    eventId,
    entityId: String(change.entityId),
    revision,
    ...(change.mediaStatus === undefined ? {} : {
      mediaStatus: change.mediaStatus,
    }),
  };
}

export function parsePushResult(value: unknown): PushResult {
  const result = object(value, "result", ["operationId", "status"], ["code", "current"]);

  if (result.status !== "accepted" && result.status !== "rejected" && result.status !== "retry") {
    throw new Error("Conferma server non valida.");
  }

  return {
    operationId: identity(result.operationId),
    status: result.status,
    ...(result.code === undefined ? {} : {
      code: text(result.code, "code"),
    }),
    ...(result.current === undefined ? {} : {
      current: parseChange(result.current),
    }),
  };
}

export function parsePullPage(value: unknown): PullPage {
  const page = object(value, "pull", [
    "changes", "cursor", "hasMore",
  ]);

  return {
    changes: array(page.changes, "changes", (entry) => parseChange(entry)),
    cursor: text(page.cursor, "cursor"),
    hasMore: boolean(page.hasMore, "hasMore"),
  };
}
