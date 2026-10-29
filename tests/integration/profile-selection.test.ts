import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { IDBFactory, IDBObjectStore } from "fake-indexeddb";

import { loadCatalog } from "../../src/lib/config/load-catalog";
import { inTransaction, openLocalDatabase, readRequest } from "../../src/lib/offline/database";
import { LocalInputError } from "../../src/lib/offline/product-input";
import { openLocalRepository } from "../../src/lib/offline/repository";

import type { LocalRepository } from "../../src/lib/offline/repository";
import type { TestContext } from "node:test";

async function fixture(context: TestContext) {
  const catalog = await loadCatalog(path.join(process.cwd(), "tests/fixtures/catalog"));
  const factory = new IDBFactory();
  const name = `expotrack-test-profiles-${crypto.randomUUID()}`;
  const connections: LocalRepository[] = [];

  async function connect() {
    const repository = await openLocalRepository({
      name,
      factory,
    });

    connections.push(repository);

    return repository;
  }

  async function writeSelection(value: Record<string, unknown>) {
    const database = await openLocalDatabase({
      name,
      factory,
    });

    try {
      await inTransaction(database, ["app_meta"], "readwrite", (transaction) => {
        transaction.objectStore("app_meta").put({
          ...value,
          key: "active-context",
        });
      });
    } finally {
      database.close();
    }
  }

  context.after(async () => {
    for (const connection of connections) {
      connection.close();
    }
    await readRequest<void>(factory.deleteDatabase(name));
  });

  return {
    catalog,
    factory,
    name,
    connect,
    writeSelection,
    repository: await connect(),
  };
}

void test("primo avvio senza scelta automatica e avvii successivi con il profilo ricordato", async (context) => {
  const { catalog, repository, connect } = await fixture(context);

  assert.equal(await repository.getProfileSession(), null);
  const initial = await repository.initializeProfileSession(catalog);

  assert.equal(initial.profile, null);
  assert.equal(initial.context, null);
  assert.equal(initial.invalidSelection, false);
  const selected = await repository.selectProfile("me");

  assert.equal(selected.profile?.id, "me");
  assert.deepEqual(selected.context, {
    profileId: "me",
    eventId: catalog.config.app.defaultEventId,
  });
  assert.deepEqual(await repository.listOutbox(selected.context), []);
  repository.close();
  const reopened = await connect();
  const next = await reopened.initializeProfileSession(catalog);

  assert.equal(next.profile?.id, "me");
  assert.deepEqual(next.context, selected.context);
  assert.equal(next.invalidSelection, false);
});

void test("cambio profilo attende le scritture e non mescola né elimina prodotti o code", async (context) => {
  const { catalog, repository } = await fixture(context);

  await repository.initializeProfileSession(catalog);
  const first = (await repository.selectProfile("me")).context;

  assert.ok(first);
  const writing = repository.saveProduct(first, "same-product", {
    name: "Prodotto del primo profilo",
    categoryId: "bags",
    description: "Da conservare",
    standRef: {
      source: "catalog",
      eventId: first.eventId,
      standId: "demo-bags",
    },
  });
  const switching = repository.selectProfile("father");
  const [saved, switched] = await Promise.all([writing, switching]);

  assert.ok(switched.context);
  assert.equal(switched.profile?.id, "father");
  assert.deepEqual(await repository.getProduct(first, "same-product"), saved);
  assert.deepEqual(await repository.listProducts(switched.context), []);
  await repository.saveProduct(switched.context, "same-product", {
    name: "Prodotto del secondo profilo",
    categoryId: "bags",
    description: "Separata",
    standRef: {
      source: "catalog",
      eventId: first.eventId,
      standId: "demo-bags",
    },
  });
  const secondQueue = await repository.listOutbox(switched.context);
  const firstQueue = await repository.listOutbox(first);

  await repository.selectProfile("me");
  assert.deepEqual(await repository.listOutbox(first), firstQueue);
  assert.deepEqual(await repository.listOutbox(switched.context), secondQueue);
  assert.equal((await repository.listRegisteredProducts(first))[0].name, "Prodotto del primo profilo");
  assert.equal((await repository.listRegisteredProducts(switched.context))[0].name, "Prodotto del secondo profilo");
});

void test("profili disabilitati o rimossi e preferenze corrotte richiedono una scelta esplicita", async (context) => {
  const { catalog, repository, writeSelection } = await fixture(context);

  await repository.initializeProfileSession(catalog);
  await repository.selectProfile("me");
  const disabled = structuredClone(catalog);

  disabled.profiles = disabled.profiles.map((profile) => ({
    ...profile,
    enabled: profile.id !== "me",
  }));
  const unavailable = await repository.initializeProfileSession(disabled);

  assert.equal(unavailable.invalidSelection, true);
  assert.equal(unavailable.profile, null);
  await assert.rejects(repository.selectProfile("me"), LocalInputError);
  assert.equal((await repository.selectProfile("father")).profile?.id, "father");

  await repository.initializeProfileSession(catalog);
  await writeSelection({
    profileId: "removed",
    eventId: catalog.config.app.defaultEventId,
  });
  const removed = await repository.getProfileSession();

  assert.equal(removed?.invalidSelection, true);
  assert.equal(removed.profile, null);
  await writeSelection({
    profileId: 7,
    eventId: null,
  });
  const corrupted = await repository.getProfileSession();

  assert.equal(corrupted?.invalidSelection, true);
  assert.equal(corrupted.context, null);
  assert.equal((await repository.selectProfile("me")).invalidSelection, false);
});

void test("evento valido conservato nel cambio profilo, evento non valido ripristinato soltanto dopo la scelta", async (context) => {
  const { catalog, repository, writeSelection } = await fixture(context);

  catalog.config.events.push({
    id: "another-demo",
    name: "Secondo evento",
    enabled: true,
    standsFile: "events/another-demo.json",
  });
  await repository.initializeProfileSession(catalog);
  await writeSelection({
    profileId: "me",
    eventId: "another-demo",
  });
  const switched = await repository.selectProfile("father");

  assert.equal(switched.context?.eventId, "another-demo");
  const disabled = structuredClone(catalog);

  disabled.config.events = disabled.config.events.map((event) => ({
    ...event,
    enabled: event.id !== "another-demo",
  }));
  const invalid = await repository.initializeProfileSession(disabled);

  assert.equal(invalid.invalidSelection, true);
  assert.equal(invalid.context, null);
  const selected = await repository.selectProfile("me");

  assert.equal(selected.context?.eventId, catalog.config.app.defaultEventId);
});

void test("errore nella preferenza preserva la scelta precedente e permette il retry", async (context) => {
  const { catalog, repository } = await fixture(context);

  await repository.initializeProfileSession(catalog);
  await repository.selectProfile("me");
  const put = Reflect.get(IDBObjectStore.prototype, "put");
  const mocked = context.mock.method(IDBObjectStore.prototype, "put", function(this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
    if (this.name === "app_meta" && typeof value === "object" && value !== null
      && "key" in value && value.key === "active-context") {
      throw new DOMException("Scrittura preferenza negata nel test.", "QuotaExceededError");
    }

    return put.call(this, value, key);
  });

  await assert.rejects(repository.selectProfile("father"), {
    name: "QuotaExceededError",
  });
  mocked.mock.restore();
  assert.equal((await repository.getProfileSession())?.profile?.id, "me");
  assert.equal((await repository.selectProfile("father")).profile?.id, "father");
});

void test("catalogo profili vuoto non crea identità e il bootstrap ripetuto non duplica snapshot", async (context) => {
  const {
    catalog, repository, factory, name,
  } = await fixture(context);

  catalog.profiles = [];
  catalog.interests = [];
  catalog.plannedProducts = [];
  catalog.questionnaires = [];
  await repository.initializeProfileSession(catalog);
  const empty = await repository.initializeProfileSession(catalog);

  assert.equal(empty.profile, null);
  assert.equal(empty.invalidSelection, false);
  await assert.rejects(repository.selectProfile("me"), LocalInputError);
  const database = await openLocalDatabase({
    name,
    factory,
  });

  try {
    const count = await inTransaction(database, ["config_snapshots"], "readonly", (transaction) => {
      return readRequest<number>(transaction.objectStore("config_snapshots").count());
    });

    assert.equal(count, 1);
  } finally {
    database.close();
  }
});
