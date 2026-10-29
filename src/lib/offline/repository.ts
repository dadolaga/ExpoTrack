import { validateReferences } from "../config/validate-references";

import { inTransaction, openLocalDatabase, readRequest } from "./database";
import { createLocalId } from "./identity";
import {
  LocalInputError,
  nextProductData,
  parseProductPatch,
  sameProduct,
  validateContext,
  validateIdentity,
  validateProduct,
} from "./product-input";
import { profileContextForSelection, resolveProfileSession } from "./profile-session";

import type { LocalDatabaseOptions } from "./database";
import type { CatalogSnapshot } from "../../types/catalog";
import type {
  LocalContext, LocalProduct, OutboxOperation, ProductInput,
} from "../../types/offline";
import type { ProfileSession } from "../../types/profiles";

type StoredCatalog = {
  id: string;
  data: CatalogSnapshot;
  createdAt: string;
};

type ActiveCatalog = {
  key: "active-catalog";
  snapshotId: string;
};

async function readCatalog(transaction: IDBTransaction): Promise<CatalogSnapshot | null> {
  const active = await readRequest<ActiveCatalog | undefined>(
    transaction.objectStore("app_meta").get("active-catalog"),
  );

  if (active === undefined) {
    return null;
  }
  const stored = await readRequest<StoredCatalog | undefined>(
    transaction.objectStore("config_snapshots").get(active.snapshotId),
  );

  if (stored === undefined) {
    throw new Error("Snapshot locale attivo non disponibile: ricarica il catalogo.");
  }

  return stored.data;
}

function activateCatalog(transaction: IDBTransaction, data: CatalogSnapshot, snapshotId: string) {
  transaction.objectStore("config_snapshots").add({
    id: snapshotId,
    data,
    createdAt: new Date().toISOString(),
  } satisfies StoredCatalog);
  transaction.objectStore("app_meta").put({
    key: "active-catalog",
    snapshotId,
  } satisfies ActiveCatalog);
}

export class LocalRepository {
  private readonly database: IDBDatabase;

  constructor(database: IDBDatabase) {
    this.database = database;
  }

  close(): void {
    this.database.close();
  }

  async saveCatalog(catalog: CatalogSnapshot, snapshotId: string = createLocalId()): Promise<void> {
    if (snapshotId.trim().length === 0) {
      throw new LocalInputError("Identificativo snapshot obbligatorio.");
    }
    const data = structuredClone(catalog);

    validateReferences(data);
    await inTransaction(this.database, ["config_snapshots", "app_meta"], "readwrite", (transaction) => {
      activateCatalog(transaction, data, snapshotId);
    });
  }

  async getCatalog(): Promise<CatalogSnapshot | null> {
    return inTransaction(this.database, ["config_snapshots", "app_meta"], "readonly", readCatalog);
  }

  async initializeProfileSession(catalog: CatalogSnapshot): Promise<ProfileSession> {
    const data = structuredClone(catalog);

    validateReferences(data);

    return inTransaction(this.database, [
      "config_snapshots", "app_meta", "products", "outbox",
    ], "readwrite", async (transaction) => {
      const current = await readCatalog(transaction);

      if (JSON.stringify(current) !== JSON.stringify(data)) {
        activateCatalog(transaction, data, createLocalId());
      }
      const stored = await readRequest<unknown>(transaction.objectStore("app_meta").get("active-context"));

      return resolveProfileSession(data, stored);
    });
  }

  async getProfileSession(): Promise<ProfileSession | null> {
    return inTransaction(this.database, ["config_snapshots", "app_meta"], "readonly", async (transaction) => {
      const catalog = await readCatalog(transaction);

      if (catalog === null) {
        return null;
      }
      const stored = await readRequest<unknown>(transaction.objectStore("app_meta").get("active-context"));

      return resolveProfileSession(catalog, stored);
    });
  }

  async selectProfile(profileId: string): Promise<ProfileSession> {
    // Sharing the write scope waits for previously started product/outbox commits.
    return inTransaction(this.database, [
      "config_snapshots", "app_meta", "products", "outbox",
    ], "readwrite", async (transaction) => {
      const catalog = await readCatalog(transaction);

      if (catalog === null) {
        throw new LocalInputError("Carica un catalogo valido prima di scegliere il profilo.");
      }
      const store = transaction.objectStore("app_meta");
      const stored = await readRequest<unknown>(store.get("active-context"));
      const selected = {
        key: "active-context",
        ...profileContextForSelection(catalog, stored, profileId),
      };

      store.put(selected);

      return resolveProfileSession(catalog, selected);
    });
  }

  async getProduct(context: LocalContext, id: string): Promise<LocalProduct | undefined> {
    const scope = validateContext(context);
    const identity = validateIdentity(id);

    return inTransaction(this.database, ["products"], "readonly", (transaction) => {
      return readRequest<LocalProduct | undefined>(
        transaction.objectStore("products").get([
          scope.profileId, scope.eventId, identity,
        ]),
      );
    });
  }

  async listProducts(context: LocalContext): Promise<LocalProduct[]> {
    const scope = validateContext(context);

    return inTransaction(this.database, ["products"], "readonly", (transaction) => {
      return readRequest<LocalProduct[]>(transaction.objectStore("products")
        .index("by_context").getAll([scope.profileId, scope.eventId]));
    });
  }

  async listRegisteredProducts(context: LocalContext) {
    const records = await this.listProducts(context);

    return records.flatMap((record) => record.lastValid === null ? [] : [record.lastValid]);
  }

  async listOutbox(context: LocalContext): Promise<OutboxOperation[]> {
    const scope = validateContext(context);
    const operations = await inTransaction(this.database, ["outbox"], "readonly", (transaction) => {
      return readRequest<OutboxOperation[]>(transaction.objectStore("outbox")
        .index("by_context").getAll([scope.profileId, scope.eventId]));
    });

    return operations.sort((first, second) => {
      const entityOrder = first.entityId.localeCompare(second.entityId);

      return entityOrder !== 0 ? entityOrder : first.localSequence - second.localSequence;
    });
  }

  async saveProduct(context: LocalContext, id: string, changes: Partial<ProductInput>): Promise<LocalProduct> {
    const scope = validateContext(context);
    const identity = validateIdentity(id);
    const patch = parseProductPatch(changes);

    return inTransaction(this.database, [
      "config_snapshots", "app_meta", "products", "outbox",
    ], "readwrite", async (transaction) => {
      const catalog = await readCatalog(transaction);

      if (catalog === null) {
        throw new LocalInputError("Carica un catalogo valido prima di registrare dati personali.");
      }
      if (!catalog.profiles.some((profile) => profile.id === scope.profileId && profile.enabled)
        || !catalog.config.events.some((event) => event.id === scope.eventId && event.enabled)) {
        throw new LocalInputError("Seleziona un profilo e un evento disponibili.");
      }
      const store = transaction.objectStore("products");
      const previous = await readRequest<LocalProduct | undefined>(
        store.get([
          scope.profileId, scope.eventId, identity,
        ]),
      );
      const input: ProductInput = {
        name: "",
        categoryId: null,
        standRef: null,
        description: "",
        ...previous?.input,
        ...patch,
      };
      const now = new Date().toISOString();
      const issues = validateProduct(input, scope, catalog);
      const candidate = nextProductData(previous, input, issues, scope, identity, now);
      const lastValid = previous?.lastValid ?? null;
      const changed = candidate !== null && !sameProduct(lastValid, candidate);
      const operationId = changed ? createLocalId() : previous?.latestOperationId ?? null;
      const record: LocalProduct = {
        ...scope,
        id: identity,
        input,
        lastValid: changed ? candidate : lastValid,
        issues,
        localSequence: (previous?.localSequence ?? 0) + 1,
        serverRevision: previous?.serverRevision ?? null,
        latestOperationId: operationId,
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
      };

      store.put(record);

      if (changed && operationId !== null) {
        transaction.objectStore("outbox").add({
          operationId,
          ...scope,
          entityType: "product",
          entityId: identity,
          action: lastValid === null ? "create" : "update",
          localSequence: record.localSequence,
          baseRevision: record.serverRevision,
          dependsOn: previous?.latestOperationId === undefined || previous.latestOperationId === null
            ? []
            : [previous.latestOperationId],
          payload: candidate,
          status: "pending",
          queuedAt: now,
        } satisfies OutboxOperation);
      }

      return record;
    });
  }
}

export async function openLocalRepository(options: LocalDatabaseOptions = {}): Promise<LocalRepository> {
  return new LocalRepository(await openLocalDatabase(options));
}
