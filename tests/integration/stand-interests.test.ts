import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { IDBFactory, IDBObjectStore } from "fake-indexeddb";

import { resolveStandList } from "../../src/features/stands/stand-list";
import { loadCatalog } from "../../src/lib/config/load-catalog";
import { inTransaction, openLocalDatabase, readRequest } from "../../src/lib/offline/database";
import { LocalInputError } from "../../src/lib/offline/product-input";
import { LocalRepository, openLocalRepository } from "../../src/lib/offline/repository";

import type { LocalStandPreferences } from "../../src/types/offline";
import type { TestContext } from "node:test";

const scope = {
  profileId: "me",
  eventId: "fiera-demo-2026",
};

async function fixture(context: TestContext) {
  const catalog = await loadCatalog(path.join(process.cwd(), "tests/fixtures/catalog"));
  const factory = new IDBFactory();
  const name = `expotrack-test-stands-${crypto.randomUUID()}`;
  const connections: LocalRepository[] = [];

  async function connect() {
    const repository = await openLocalRepository({
      factory,
      name,
    });

    connections.push(repository);

    return repository;
  }

  context.after(async () => {
    connections.forEach((repository) => {
      repository.close();
    });
    await readRequest<void>(factory.deleteDatabase(name));
  });
  const repository = await connect();

  await repository.saveCatalog(catalog);

  return {
    catalog,
    factory,
    name,
    repository,
    connect,
  };
}

void test("interesse persistente: rimozione esplicita, isolamento profili/eventi e seed aggiornati", async (context) => {
  const { catalog, repository, connect } = await fixture(context);
  const secondEvent = "second-demo";

  catalog.config.events.push({
    ...catalog.config.events[0],
    id: secondEvent,
  });
  catalog.stands.push(...catalog.stands.map((stand) => ({
    ...stand,
    eventId: secondEvent,
    hall: undefined,
  })));
  await repository.saveCatalog(catalog);
  const scopes = [
    scope, {
      ...scope,
      profileId: "father",
    }, {
      ...scope,
      eventId: secondEvent,
    },
  ];

  assert.deepEqual(await repository.listStandPreferences(scope), []);
  for (const entry of scopes) {
    await repository.setStandInterest(entry, "demo-bags", false);
  }
  await repository.setStandInterest(scope, "demo-lights", true);
  repository.close();
  const reopened = await connect();

  assert.equal((await reopened.listStandPreferences(scope)).length, 2);
  assert.equal((await reopened.listStandPreferences(scopes[1])).length, 1);
  assert.equal((await reopened.listStandPreferences(scopes[2])).length, 1);
  assert.equal((await reopened.listOutbox(scope)).length, 2);
  await reopened.setStandInterest(scope, "demo-bags", false);
  assert.equal((await reopened.listOutbox(scope)).length, 2);
  const changed = structuredClone(catalog);

  changed.interests[0].priority = 10;
  await reopened.initializeProfileSession(changed);
  const items = resolveStandList(changed, scope, await reopened.listStandPreferences(scope));

  assert.equal(items.find((item) => item.id === "demo-bags")?.interested, false);
  assert.equal(items.find((item) => item.id === "demo-bags")?.priority, 10);
  assert.ok(items.every((item) => item.visitStatus === "to_visit"));
  await assert.rejects(reopened.setStandInterest(scope, "missing", true), LocalInputError);
  await assert.rejects(reopened.setStandInterest({
    ...scope,
    profileId: "missing",
  }, "demo-bags", true), LocalInputError);
  assert.equal((await reopened.listOutbox(scope)).length, 2);
});

void test("stella preserva stato visita e priorità esistenti, con sequenze e dipendenze fra connessioni", async (context) => {
  const {
    repository, factory, name, connect,
  } = await fixture(context);
  const initial = await repository.setStandInterest(scope, "demo-bags", true);
  const database = await openLocalDatabase({
    factory,
    name,
  });

  await inTransaction(database, ["stand_preferences"], "readwrite", (transaction) => {
    transaction.objectStore("stand_preferences").put({
      ...initial,
      visitStatus: "visited",
      priority: null,
    } satisfies LocalStandPreferences);
  });
  database.close();
  const peer = await connect();

  await Promise.all([
    repository.setStandInterest(scope, "demo-bags", false),
    peer.setStandInterest(scope, "demo-bags", true),
  ]);
  const [record] = await repository.listStandPreferences(scope);
  const queue = await repository.listOutbox(scope);

  assert.equal(record.interested, true);
  assert.equal(record.visitStatus, "visited");
  assert.equal(record.priority, null);
  assert.deepEqual(queue.map((operation) => operation.localSequence), [
    1, 2, 3,
  ]);
  assert.deepEqual(queue[1].dependsOn, [queue[0].operationId]);
  assert.deepEqual(queue[2].dependsOn, [queue[1].operationId]);
  assert.equal(queue[2].entityType, "stand-preferences");
  assert.deepEqual(queue[2].payload, {
    ...scope,
    standRef: initial.standRef,
    interested: true,
    visitStatus: "visited",
    priority: null,
  });
  // The same entity ID in a different domain must not collide in the outbox index.
  await repository.saveProduct(scope, JSON.stringify(["catalog", "demo-bags"]), {
    name: "Test",
    categoryId: "bags",
    standRef: initial.standRef,
  });
  assert.equal((await repository.listOutbox(scope)).length, 4);
});

void test("quota e abort tardivo annullano interesse e coda insieme, con retry possibile", async (context) => {
  const { repository } = await fixture(context);
  const initial = await repository.setStandInterest(scope, "demo-bags", true);
  const before = await repository.listOutbox(scope);
  const add = Reflect.get(IDBObjectStore.prototype, "add");
  const quota = context.mock.method(IDBObjectStore.prototype, "add", function(this: IDBObjectStore, value: unknown) {
    if (this.name === "outbox") {
      throw new DOMException("Quota simulata.", "QuotaExceededError");
    }

    return add.call(this, value);
  });

  await assert.rejects(repository.setStandInterest(scope, "demo-bags", false), {
    name: "QuotaExceededError",
  });
  quota.mock.restore();
  assert.deepEqual(await repository.listStandPreferences(scope), [initial]);
  assert.deepEqual(await repository.listOutbox(scope), before);
  const abort = context.mock.method(IDBObjectStore.prototype, "add", function(this: IDBObjectStore, value: unknown) {
    const request = add.call(this, value);

    if (this.name === "outbox") {
      const transaction = this.transaction;

      request.addEventListener("success", () => {
        transaction.abort();
      });
    }

    return request;
  });

  await assert.rejects(repository.setStandInterest(scope, "demo-bags", false), {
    name: "AbortError",
  });
  abort.mock.restore();
  assert.deepEqual(await repository.listStandPreferences(scope), [initial]);
  assert.deepEqual(await repository.listOutbox(scope), before);
  assert.equal((await repository.setStandInterest(scope, "demo-bags", false)).interested, false);
  assert.equal((await repository.listOutbox(scope)).length, 2);
});

void test("migrazione v1 → v2 conserva catalogo, profilo, prodotti e operazioni pendenti", async (context) => {
  const factory = new IDBFactory();
  const name = `expotrack-test-migration-${crypto.randomUUID()}`;
  const request = factory.open(name, 1);

  request.onupgradeneeded = () => {
    const database = request.result;

    database.createObjectStore("config_snapshots", {
      keyPath: "id",
    });
    database.createObjectStore("app_meta", {
      keyPath: "key",
    });
    database.createObjectStore("products", {
      keyPath: [
        "profileId", "eventId", "id",
      ],
    })
      .createIndex("by_context", ["profileId", "eventId"]);
    const outbox = database.createObjectStore("outbox", {
      keyPath: "operationId",
    });

    outbox.createIndex("by_context", ["profileId", "eventId"]);
    outbox.createIndex("by_entity_sequence", [
      "profileId", "eventId", "entityId", "localSequence",
    ], {
      unique: true,
    });
  };
  const legacy = new LocalRepository(await readRequest<IDBDatabase>(request));
  const catalog = await loadCatalog(path.join(process.cwd(), "tests/fixtures/catalog"));

  await legacy.initializeProfileSession(catalog);
  await legacy.selectProfile("me");
  const product = await legacy.saveProduct(scope, "legacy", {
    name: "Legacy",
    categoryId: "bags",
    standRef: {
      source: "catalog",
      eventId: scope.eventId,
      standId: "demo-bags",
    },
  });
  const queue = await legacy.listOutbox(scope);

  legacy.close();
  const upgraded = await openLocalRepository({
    factory,
    name,
  });

  context.after(async () => {
    legacy.close();
    upgraded.close();
    await readRequest<void>(factory.deleteDatabase(name));
  });
  assert.deepEqual(await upgraded.getCatalog(), catalog);
  assert.deepEqual((await upgraded.getProfileSession())?.context, scope);
  assert.deepEqual(await upgraded.getProduct(scope, "legacy"), product);
  assert.deepEqual(await upgraded.listOutbox(scope), queue);
  await upgraded.setStandInterest(scope, "demo-bags", false);
  assert.equal((await upgraded.listOutbox(scope)).length, 2);
  assert.deepEqual(await upgraded.getProduct(scope, "legacy"), product);
});
