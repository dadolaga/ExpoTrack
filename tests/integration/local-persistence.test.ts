import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { IDBFactory, IDBObjectStore } from "fake-indexeddb";

import { loadCatalog } from "../../src/lib/config/load-catalog";
import { openLocalDatabase, readRequest } from "../../src/lib/offline/database";
import { LocalInputError } from "../../src/lib/offline/product-input";
import { openLocalRepository } from "../../src/lib/offline/repository";

import type { LocalRepository } from "../../src/lib/offline/repository";
import type { LocalContext, ProductInput } from "../../src/types/offline";
import type { TestContext } from "node:test";

const firstContext: LocalContext = {
  profileId: "me",
  eventId: "fiera-demo-2026",
};
const secondEvent = "second-demo";

function productInput(context: LocalContext, name = "Prodotto di prova"): ProductInput {
  return {
    name,
    categoryId: "bags",
    standRef: {
      source: "catalog",
      eventId: context.eventId,
      standId: "demo-bags",
    },
    description: "",
  };
}

async function fixture(context: TestContext) {
  const catalog = await loadCatalog(path.join(process.cwd(), "tests/fixtures/catalog"));

  catalog.config.events.push({
    id: secondEvent,
    name: "Secondo evento fittizio",
    enabled: true,
    standsFile: "events/second-demo.json",
  });
  catalog.stands.push(...catalog.stands.map((stand) => ({
    ...stand,
    eventId: secondEvent,
  })));
  catalog.pavilions.push(...catalog.pavilions.map((pavilion) => ({
    ...pavilion,
    eventId: secondEvent,
  })));

  const factory = new IDBFactory();
  const name = `expotrack-test-${crypto.randomUUID()}`;
  const connections: LocalRepository[] = [];

  async function connect() {
    const connection = await openLocalRepository({
      name,
      factory,
    });

    connections.push(connection);

    return connection;
  }

  context.after(async () => {
    for (const connection of connections) {
      connection.close();
    }
    await readRequest<void>(factory.deleteDatabase(name));
  });

  const repository = await connect();

  await repository.saveCatalog(catalog, "initial");

  return {
    repository,
    catalog,
    factory,
    name,
    connect,
  };
}

void test("input incompleti si recuperano alla riapertura e solo il minimo valido entra in outbox", async (context) => {
  const { repository, connect } = await fixture(context);
  const longText = "Descrizione senza troncamento. ".repeat(1000);

  assert.equal(await repository.getProduct(firstContext, "product"), undefined);
  assert.deepEqual(await repository.listProducts(firstContext), []);
  const partial = await repository.saveProduct(firstContext, "product", {
    name: "  ",
    description: longText,
  });

  assert.equal(partial.lastValid, null);
  assert.notEqual(partial.issues.name, undefined);
  assert.deepEqual(await repository.listRegisteredProducts(firstContext), []);
  assert.deepEqual(await repository.listOutbox(firstContext), []);
  await repository.saveProduct(firstContext, "product", {
    categoryId: "lights",
  });
  repository.close();

  const reopened = await connect();
  const recovered = await reopened.getProduct(firstContext, "product");

  assert.ok(recovered);
  assert.equal(recovered.input.description, longText);
  assert.equal(recovered.input.name, "  ");
  assert.equal(recovered.input.categoryId, "lights");
  assert.equal(recovered.lastValid, null);

  const saved = await reopened.saveProduct(firstContext, "product", productInput(firstContext));
  const pending = await reopened.listOutbox(firstContext);

  assert.equal(saved.lastValid?.name, "Prodotto di prova");
  assert.equal((await reopened.listRegisteredProducts(firstContext)).length, 1);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].action, "create");
  assert.equal(pending[0].status, "pending");
  assert.equal(pending[0].baseRevision, null);
  assert.equal(Object.hasOwn(pending[0].payload, "input"), false);
  assert.equal(Object.hasOwn(pending[0].payload, "issues"), false);
  assert.equal(saved.serverRevision, null);
});

void test("input invalido resta locale, altri campi validi avanzano e categoria/stand restano bloccati", async (context) => {
  const { repository, connect } = await fixture(context);
  const initial = await repository.saveProduct(firstContext, "product", productInput(firstContext));
  const invalid = await repository.saveProduct(firstContext, "product", {
    name: "",
  });

  assert.deepEqual(invalid.lastValid, initial.lastValid);
  assert.equal((await repository.listOutbox(firstContext)).length, 1);
  const updated = await repository.saveProduct(firstContext, "product", {
    description: "Nuova descrizione valida",
  });

  assert.notEqual(updated.issues.name, undefined);
  assert.equal(updated.input.name, "");
  assert.equal(updated.lastValid?.name, initial.lastValid?.name);
  assert.equal(updated.lastValid?.description, "Nuova descrizione valida");
  const operations = await repository.listOutbox(firstContext);

  assert.equal(operations.length, 2);
  assert.ok(operations.every((operation) => operation.entityType === "product" && operation.payload.name.trim().length > 0));
  await assert.rejects(repository.saveProduct(firstContext, "product", {
    categoryId: "lights",
  }), LocalInputError);
  await assert.rejects(repository.saveProduct(firstContext, "product", {
    standRef: {
      source: "catalog",
      eventId: firstContext.eventId,
      standId: "demo-lights",
    },
  }), LocalInputError);
  assert.deepEqual(await repository.getProduct(firstContext, "product"), updated);
  assert.deepEqual(await repository.listOutbox(firstContext), operations);
  repository.close();

  const reopened = await connect();

  assert.equal((await reopened.getProduct(firstContext, "product"))?.input.name, "");
  await reopened.saveProduct(firstContext, "product", {
    name: "Nome corretto",
  });
  await reopened.saveProduct(firstContext, "product", {
    name: "Nome corretto",
  });
  assert.equal((await reopened.listOutbox(firstContext)).length, 3);
  assert.deepEqual((await reopened.getProduct(firstContext, "product"))?.issues, {});
});

void test("due profili e due eventi isolano record e code, anche con ID uguali", async (context) => {
  const { repository, catalog } = await fixture(context);
  const scopes = [
    firstContext,
    {
      profileId: "father",
      eventId: firstContext.eventId,
    },
    {
      profileId: "me",
      eventId: secondEvent,
    },
    {
      profileId: "father",
      eventId: secondEvent,
    },
  ];

  for (const scope of scopes) {
    const name = `${scope.profileId} / ${scope.eventId}`;

    await repository.saveProduct(scope, "same-id", productInput(scope, name));
  }
  for (const scope of scopes) {
    const products = await repository.listRegisteredProducts(scope);
    const operations = await repository.listOutbox(scope);

    assert.equal(products.length, 1);
    assert.equal(products[0].name, `${scope.profileId} / ${scope.eventId}`);
    assert.equal(operations.length, 1);
    assert.equal(operations[0].profileId, scope.profileId);
    assert.equal(operations[0].eventId, scope.eventId);
    assert.deepEqual(operations[0].payload, products[0]);
  }

  await repository.saveProduct(firstContext, "wrong-reference", {
    ...productInput(firstContext),
    standRef: {
      source: "catalog",
      eventId: secondEvent,
      standId: "demo-bags",
    },
  });
  await repository.saveProduct(firstContext, "unknown-category", {
    ...productInput(firstContext),
    categoryId: "missing",
  });
  await repository.saveProduct(firstContext, "private-stand", {
    ...productInput(firstContext),
    standRef: {
      source: "personal",
      eventId: firstContext.eventId,
      standId: "demo-bags",
    },
  });
  assert.equal((await repository.listOutbox(firstContext)).length, 1);
  assert.equal((await repository.listRegisteredProducts(firstContext)).length, 1);
  assert.equal((await repository.getProduct(firstContext, "wrong-reference"))?.lastValid, null);
  assert.equal((await repository.getProduct(firstContext, "unknown-category"))?.lastValid, null);
  assert.equal((await repository.getProduct(firstContext, "private-stand"))?.lastValid, null);
  await assert.rejects(repository.listProducts({
    profileId: "me",
    eventId: "",
  }), LocalInputError);
  await assert.rejects(repository.saveProduct(
    {
      profileId: "missing",
      eventId: firstContext.eventId,
    },
    "product",
    productInput(firstContext),
  ), LocalInputError);
  assert.deepEqual(await repository.getCatalog(), catalog);
});

void test("errore quota nel secondo store annulla anche la scrittura del record", async (context) => {
  const { repository } = await fixture(context);

  await repository.saveProduct(firstContext, "product", productInput(firstContext));
  const before = await repository.getProduct(firstContext, "product");
  const queue = await repository.listOutbox(firstContext);
  // Retain the native function for deliberate fault injection, invoked with call(this).
  const add = Reflect.get(IDBObjectStore.prototype, "add");
  const mocked = context.mock.method(IDBObjectStore.prototype, "add", function(this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
    if (this.name === "outbox") {
      throw new DOMException("Quota simulata nel test isolato.", "QuotaExceededError");
    }

    return add.call(this, value, key);
  });

  await assert.rejects(
    repository.saveProduct(firstContext, "product", {
      description: "Da ritentare",
    }),
    {
      name: "QuotaExceededError",
    },
  );
  await assert.rejects(
    repository.saveProduct(firstContext, "new-product", productInput(firstContext)),
    {
      name: "QuotaExceededError",
    },
  );
  mocked.mock.restore();

  assert.deepEqual(await repository.getProduct(firstContext, "product"), before);
  assert.equal(await repository.getProduct(firstContext, "new-product"), undefined);
  assert.deepEqual(await repository.listOutbox(firstContext), queue);
  const recovered = await repository.saveProduct(firstContext, "product", {
    description: "Da ritentare",
  });

  assert.equal(recovered.lastValid?.description, "Da ritentare");
  assert.equal((await repository.listOutbox(firstContext)).length, queue.length + 1);
});

void test("successo delle richieste seguito da abort non viene dichiarato come commit", async (context) => {
  const { repository } = await fixture(context);
  const before = await repository.saveProduct(firstContext, "product", {
    name: "Input parziale",
  });
  const add = Reflect.get(IDBObjectStore.prototype, "add");
  const mocked = context.mock.method(IDBObjectStore.prototype, "add", function(this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
    const request = add.call(this, value, key);

    if (this.name === "outbox") {
      const transaction = this.transaction;

      request.addEventListener("success", () => {
        transaction.abort();
      });
    }

    return request;
  });

  await assert.rejects(
    repository.saveProduct(firstContext, "product", productInput(firstContext)),
    {
      name: "AbortError",
    },
  );
  mocked.mock.restore();

  assert.deepEqual(await repository.getProduct(firstContext, "product"), before);
  assert.deepEqual(await repository.listOutbox(firstContext), []);
  assert.deepEqual(await repository.listRegisteredProducts(firstContext), []);
});

void test("scritture da connessioni concorrenti preservano campi, sequenze e dipendenze dopo riapertura", async (context) => {
  const { repository, connect } = await fixture(context);

  await repository.saveProduct(firstContext, "product", productInput(firstContext));
  const peer = await connect();

  await Promise.all([
    repository.saveProduct(firstContext, "product", {
      description: "Prima modifica",
    }),
    peer.saveProduct(firstContext, "product", {
      name: "Seconda modifica",
    }),
  ]);
  const final = await peer.getProduct(firstContext, "product");
  const operations = await peer.listOutbox(firstContext);

  assert.ok(final);
  assert.ok(final.lastValid);
  assert.equal(final.lastValid.name, "Seconda modifica");
  assert.equal(final.lastValid.description, "Prima modifica");
  assert.deepEqual(operations.map((operation) => operation.localSequence), [
    1, 2, 3,
  ]);
  assert.deepEqual(operations[0].dependsOn, []);
  assert.deepEqual(operations[1].dependsOn, [operations[0].operationId]);
  assert.deepEqual(operations[2].dependsOn, [operations[1].operationId]);
  assert.ok(operations.every((operation) => operation.baseRevision === null));
  repository.close();
  peer.close();

  const reopened = await connect();

  assert.deepEqual(await reopened.listOutbox(firstContext), operations);
  assert.deepEqual(await reopened.getProduct(firstContext, "product"), final);
});

void test("snapshot e puntatore attivo si aggiornano atomicamente senza cancellare dati personali", async (context) => {
  const {
    repository, catalog, factory, name,
  } = await fixture(context);

  await repository.saveProduct(firstContext, "product", productInput(firstContext));
  const record = await repository.getProduct(firstContext, "product");
  const queue = await repository.listOutbox(firstContext);
  const replacement = structuredClone(catalog);

  replacement.config.app.name = "Catalogo aggiornato";
  await repository.saveCatalog(replacement, "second");
  await assert.rejects(repository.saveCatalog(catalog, "initial"), {
    name: "ConstraintError",
  });
  assert.deepEqual(await repository.getCatalog(), replacement);
  assert.deepEqual(await repository.getProduct(firstContext, "product"), record);
  assert.deepEqual(await repository.listOutbox(firstContext), queue);
  const database = await openLocalDatabase({
    name,
    factory,
  });

  try {
    assert.equal(database.objectStoreNames.contains("drafts"), false);
  } finally {
    database.close();
  }
});

void test("riferimenti rimossi dal catalogo conservano input e ultima versione valida senza nuove mutazioni", async (context) => {
  const { repository, catalog } = await fixture(context);
  const initial = await repository.saveProduct(firstContext, "product", productInput(firstContext));
  const reduced = structuredClone(catalog);

  reduced.categories = reduced.categories.filter((category) => category.id !== "bags");
  reduced.stands = reduced.stands.map((stand) => ({
    ...stand,
    categoryIds: stand.categoryIds.filter((categoryId) => categoryId !== "bags"),
  }));
  reduced.profiles = reduced.profiles.map((profile) => ({
    ...profile,
    budgets: [],
  }));
  reduced.plannedProducts = [];
  reduced.questionnaires = [];
  await repository.saveCatalog(reduced, "reduced");
  const pending = await repository.saveProduct(firstContext, "product", {
    description: "Da conservare",
  });

  assert.deepEqual(pending.lastValid, initial.lastValid);
  assert.notEqual(pending.issues.categoryId, undefined);
  assert.equal(pending.input.description, "Da conservare");
  assert.equal((await repository.listOutbox(firstContext)).length, 1);
  await repository.saveCatalog(catalog, "restored");
  const recovered = await repository.saveProduct(firstContext, "product", {
    description: "Da conservare",
  });

  assert.equal(recovered.lastValid?.description, "Da conservare");
  assert.equal((await repository.listOutbox(firstContext)).length, 2);
});
