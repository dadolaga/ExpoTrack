export type LocalDatabaseOptions = {
  name?: string;
  factory?: IDBFactory;
};

export function openLocalDatabase(options: LocalDatabaseOptions = {}): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // Browser APIs are accessed only on opening, never while importing on the server.
    const factory = options.factory ?? (typeof indexedDB === "undefined" ? undefined : indexedDB);

    if (factory === undefined) {
      reject(new Error("IndexedDB non disponibile: impossibile aprire l’archivio locale."));

      return;
    }
    const request = factory.open(options.name ?? "expotrack-local", 3);
    let blocked = false;

    request.onblocked = () => {
      blocked = true;
      reject(new Error("Archivio occupato da un’altra scheda: chiudila e riprova."));
    };
    request.onerror = () => {
      reject(request.error ?? new Error("Impossibile aprire l’archivio locale."));
    };
    request.onupgradeneeded = (event) => {
      const database = request.result;

      if (event.oldVersion < 1) {
        database.createObjectStore("config_snapshots", {
          keyPath: "id",
        });
        database.createObjectStore("app_meta", {
          keyPath: "key",
        });
        const products = database.createObjectStore("products", {
          keyPath: [
            "profileId", "eventId", "id",
          ],
        });
        const outbox = database.createObjectStore("outbox", {
          keyPath: "operationId",
        });

        products.createIndex("by_context", ["profileId", "eventId"]);
        outbox.createIndex("by_context", ["profileId", "eventId"]);
        outbox.createIndex("by_entity_sequence", [
          "profileId", "eventId", "entityId", "localSequence",
        ], {
          unique: true,
        });
      }
      if (event.oldVersion < 2) {
        const preferences = database.createObjectStore("stand_preferences", {
          keyPath: [
            "profileId", "eventId", "standRef.source", "standRef.standId",
          ],
        });
        const outbox = request.transaction?.objectStore("outbox");

        preferences.createIndex("by_context", ["profileId", "eventId"]);
        if (outbox === undefined) {
          throw new Error("Transazione di migrazione non disponibile.");
        }
        outbox.deleteIndex("by_entity_sequence");
        outbox.createIndex("by_entity_sequence", [
          "profileId", "eventId", "entityType", "entityId", "localSequence",
        ], {
          unique: true,
        });
      }
      if (event.oldVersion < 3) {
        const personalStands = database.createObjectStore("personal_stands", {
          keyPath: [
            "profileId", "eventId", "id",
          ],
        });

        personalStands.createIndex("by_context", ["profileId", "eventId"]);
      }
    };
    request.onsuccess = () => {
      const database = request.result;

      if (blocked) {
        database.close();

        return;
      }
      database.onversionchange = () => {
        database.close();
      };
      resolve(database);
    };
  });
}

// Stores are owned by this schema. The cast is confined to the IndexedDB read boundary.
export function readRequest<T>(request: EventTarget & {
  readonly result: unknown;
  readonly error: DOMException | null;
}): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => {
      resolve(request.result as T);
    }, {
      once: true,
    });
    request.addEventListener("error", () => {
      reject(request.error ?? new Error("Lettura locale non riuscita."));
    }, {
      once: true,
    });
  });
}

export async function inTransaction<T>(
  database: IDBDatabase,
  stores: string[],
  mode: IDBTransactionMode,
  work: (transaction: IDBTransaction) => T | Promise<T>,
): Promise<T> {
  const transaction = database.transaction(stores, mode);
  const completion = new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => {
      resolve();
    };
    transaction.onabort = () => {
      reject(transaction.error
      ?? new DOMException("Transazione locale annullata.", "AbortError"));
    };
  });

  // Observe aborts immediately while work is waiting on a native IndexedDB request.
  void completion.catch(() => undefined);

  try {
    // Work must await only IndexedDB requests, never network or unrelated tasks.
    const result = await work(transaction);

    await completion;

    return result;
  } catch (error) {
    try {
      transaction.abort();
    } catch {
      // A failed transaction may already be aborted or complete.
    }
    await completion.catch(() => undefined);

    throw error;
  }
}
