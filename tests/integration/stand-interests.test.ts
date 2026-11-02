import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { IDBFactory, IDBIndex, IDBObjectStore } from "fake-indexeddb";

import { resolveStandDetail, resolveStandList } from "../../src/features/stands/stand-list";
import { loadCatalog } from "../../src/lib/config/load-catalog";
import { inTransaction, openLocalDatabase, readRequest } from "../../src/lib/offline/database";
import { LocalInputError } from "../../src/lib/offline/product-input";
import { LocalRepository, openLocalRepository } from "../../src/lib/offline/repository";

import type { LocalProduct, LocalStandPreferences, OutboxOperation } from "../../src/types/offline";
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

void test("migrazione v1 → v3 conserva catalogo, profilo, prodotti e operazioni pendenti", async (context) => {
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
  const legacyDatabase = await readRequest<IDBDatabase>(request);
  const legacy = new LocalRepository(legacyDatabase);
  const catalog = await loadCatalog(path.join(process.cwd(), "tests/fixtures/catalog"));

  await legacy.initializeProfileSession(catalog);
  await legacy.selectProfile("me");
  // Seed the historical schema directly; current repository writes require v3.
  const now = "2026-10-29T00:00:00.000Z";
  const data = {
    ...scope,
    id: "legacy",
    name: "Legacy",
    categoryId: "bags",
    description: "",
    standRef: {
      source: "catalog" as const,
      eventId: scope.eventId,
      standId: "demo-bags",
    },
    createdAt: now,
    updatedAt: now,
  };
  const product: LocalProduct = {
    ...scope,
    id: "legacy",
    input: {
      name: data.name,
      description: data.description,
      categoryId: data.categoryId,
      standRef: data.standRef,
    },
    lastValid: data,
    issues: {},
    localSequence: 1,
    serverRevision: null,
    latestOperationId: "legacy-operation",
    createdAt: now,
    updatedAt: now,
  };
  const queue: OutboxOperation[] = [
    {
      ...scope,
      operationId: "legacy-operation",
      entityType: "product",
      entityId: "legacy",
      action: "create",
      localSequence: 1,
      baseRevision: null,
      dependsOn: [],
      payload: data,
      status: "pending",
      queuedAt: now,
    },
  ];

  await inTransaction(legacyDatabase, ["products", "outbox"], "readwrite", (transaction) => {
    transaction.objectStore("products").put(product);
    transaction.objectStore("outbox").add(queue[0]);
  });

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

void test("dettaglio: spunte con ID stabili, visita manuale, prodotti separati e isolamento dopo riapertura", async (context) => {
  const { catalog, repository, connect } = await fixture(context);
  const seed = catalog.interests.find((entry) => entry.profileId === scope.profileId && entry.standRef.standId === "demo-bags");

  assert.ok(seed);
  seed.checklist.push({
    id: "second-check",
    text: "Secondo controllo",
  });
  await repository.saveCatalog(catalog);
  const firstId = seed.checklist[0].id;

  await repository.saveStandPreferences(scope, "demo-bags", {
    visitStatus: "visited",
    priority: 7,
  });
  const peer = await connect();

  await Promise.all([
    repository.saveStandPreferences(scope, "demo-bags", {
      checklistChange: {
        id: firstId,
        checked: true,
      },
    }),
    peer.saveStandPreferences(scope, "demo-bags", {
      checklistChange: {
        id: "second-check",
        checked: true,
      },
    }),
  ]);
  await repository.setStandInterest(scope, "demo-bags", false);
  await repository.saveStandPreferences(scope, "demo-bags", {
    addChecklistItem: {
      id: "personal-check",
      text: "Controllo personale",
    },
  });
  await repository.saveStandPreferences(scope, "demo-bags", {
    priority: null,
  });
  await repository.saveProduct(scope, "registered", {
    name: "Prodotto registrato",
    categoryId: "bags",
    standRef: {
      source: "catalog",
      eventId: scope.eventId,
      standId: "demo-bags",
    },
  });
  repository.close();
  const reopened = await connect();
  const preferences = await reopened.listStandPreferences(scope);
  const products = await reopened.listRegisteredProducts(scope);
  const detail = resolveStandDetail(catalog, scope, "demo-bags", preferences, products);

  assert.ok(detail);
  assert.equal(detail.completed, 2);
  assert.equal(detail.checklist.length, 3);
  assert.equal(detail.visitStatus, "visited");
  assert.equal(detail.interested, false);
  assert.equal(detail.priority, null);
  assert.equal(detail.planned.length, 1);
  assert.equal(detail.registered.length, 1);
  assert.notEqual(detail.planned[0].id, detail.registered[0].id);
  const father = resolveStandDetail(catalog, {
    ...scope,
    profileId: "father",
  }, "demo-bags", preferences, products);
  const otherStand = resolveStandDetail(catalog, scope, "demo-lights", preferences, products);

  assert.ok(father);
  assert.equal(father.completed, 0);
  assert.equal(father.visitStatus, "to_visit");
  assert.equal(father.registered.length, 0);
  assert.equal(otherStand?.registered.length, 0);
  const otherEvent = {
    ...scope,
    eventId: "other-demo",
  };

  assert.deepEqual(await reopened.listStandPreferences(otherEvent), []);
  const changed = structuredClone(catalog);

  changed.interests[0].checklist.reverse();
  await reopened.saveCatalog(changed);
  const stillChecked = resolveStandDetail(changed, scope, "demo-bags", preferences, products);

  assert.ok(stillChecked);
  assert.equal(stillChecked.checklist.find((item) => item.id === firstId)?.checked, true);
  assert.equal(stillChecked.completed, 2);
});

void test("patch dettaglio invalide e quota non cambiano record/coda; le spunte seguono gli ID del seed", async (context) => {
  const { catalog, repository } = await fixture(context);
  const item = catalog.interests[0].checklist[0];

  await repository.saveStandPreferences(scope, "demo-bags", {
    checklistChange: {
      id: item.id,
      checked: true,
    },
  });
  const changed = structuredClone(catalog);

  changed.interests[0].checklist.unshift({
    id: "new-first",
    text: "Nuovo primo elemento",
  });
  await repository.saveCatalog(changed);
  const before = await repository.listStandPreferences(scope);
  const queue = await repository.listOutbox(scope);
  const detail = resolveStandDetail(changed, scope, "demo-bags", before, []);

  assert.ok(detail);
  assert.equal(detail.checklist[0].checked, false);
  assert.equal(detail.checklist.find((entry) => entry.id === item.id)?.checked, true);
  assert.equal(detail.completed, 1);
  for (const priority of [
    0, 11, 1.5, Number.NaN,
  ]) {
    await assert.rejects(repository.saveStandPreferences(scope, "demo-bags", {
      priority,
    }), LocalInputError);
  }
  await assert.rejects(repository.saveStandPreferences(scope, "demo-bags", {
    checklistChange: {
      id: "missing",
      checked: true,
    },
  }), LocalInputError);
  const add = Reflect.get(IDBObjectStore.prototype, "add");
  const quota = context.mock.method(IDBObjectStore.prototype, "add", function(this: IDBObjectStore, value: unknown) {
    if (this.name === "outbox") {
      throw new DOMException("Quota simulata.", "QuotaExceededError");
    }

    return add.call(this, value);
  });

  await assert.rejects(repository.saveStandPreferences(scope, "demo-bags", {
    visitStatus: "visited",
    priority: 5,
  }));
  quota.mock.restore();
  assert.deepEqual(await repository.listStandPreferences(scope), before);
  assert.deepEqual(await repository.listOutbox(scope), queue);
  const saved = await repository.saveStandPreferences(scope, "demo-bags", {
    visitStatus: "to_revisit",
    priority: 5,
  });

  assert.equal(saved.visitStatus, "to_revisit");
  assert.equal(saved.priority, 5);
  await repository.saveStandPreferences(scope, "demo-bags", {
    visitStatus: "to_revisit",
    priority: 5,
  });
  assert.equal((await repository.listOutbox(scope)).length, queue.length + 1);
});

void test("note: testo lungo integro dopo riapertura, campi indipendenti e isolamento profilo/evento/stand", async (context) => {
  const { catalog, repository, connect } = await fixture(context);
  const notes = `  Appunti personali\n${"È una prova <script>test</script> 👜\n".repeat(2000)}  `;
  const secondEvent = "notes-second-demo";

  catalog.config.events.push({
    ...catalog.config.events[0],
    id: secondEvent,
  });
  catalog.stands.push({
    ...catalog.stands[0],
    eventId: secondEvent,
    hall: undefined,
  });
  await repository.saveCatalog(catalog);
  const peer = await connect();

  await Promise.all([
    repository.saveStandPreferences(scope, "demo-bags", {
      notes,
    }),
    peer.saveStandPreferences(scope, "demo-bags", {
      visitStatus: "visited",
      priority: 6,
    }),
  ]);
  const father = {
    ...scope,
    profileId: "father",
  };
  const otherEvent = {
    ...scope,
    eventId: secondEvent,
  };

  await repository.saveStandPreferences(father, "demo-bags", {
    notes: "Note papà",
  });
  await repository.saveStandPreferences(otherEvent, "demo-bags", {
    notes: "Altro evento",
  });
  await repository.setStandInterest(scope, "demo-bags", false);
  await repository.saveStandPreferences(scope, "demo-bags", {
    checklistChange: {
      id: catalog.interests[0].checklist[0].id,
      checked: true,
    },
  });
  await repository.saveProduct(scope, "notes-product", {
    name: "Prodotto",
    categoryId: "bags",
    description: "Descrizione distinta",
    standRef: {
      source: "catalog",
      eventId: scope.eventId,
      standId: "demo-bags",
    },
  });
  repository.close();
  const reopened = await connect();
  const preferences = await reopened.listStandPreferences(scope);
  const detail = resolveStandDetail(catalog, scope, "demo-bags", preferences, []);

  assert.ok(detail);
  assert.equal(detail.notes, notes);
  assert.equal(detail.visitStatus, "visited");
  assert.equal(detail.priority, 6);
  assert.equal(detail.interested, false);
  assert.equal(detail.completed, 1);
  assert.equal(resolveStandDetail(catalog, scope, "demo-lights", preferences, [])?.notes, "");
  assert.equal(resolveStandDetail(catalog, father, "demo-bags", preferences, [])?.notes, "");
  assert.equal((await reopened.listStandPreferences(father))[0].notes, "Note papà");
  assert.equal((await reopened.listStandPreferences(otherEvent))[0].notes, "Altro evento");
  assert.equal((await reopened.getProduct(scope, "notes-product"))?.input.description, "Descrizione distinta");
  const queue = await reopened.listOutbox(scope);
  const standQueue = queue.filter((operation) => operation.entityType === "stand-preferences");

  assert.equal(standQueue.at(-1)?.payload.notes, notes);
  await reopened.saveStandPreferences(scope, "demo-bags", {
    notes,
  });
  assert.equal((await reopened.listOutbox(scope)).length, queue.length);
  await reopened.saveStandPreferences(scope, "demo-bags", {
    notes: "",
  });
  const cleared = resolveStandDetail(catalog, scope, "demo-bags", await reopened.listStandPreferences(scope), []);

  assert.equal(cleared?.notes, "");
  assert.equal(cleared.visitStatus, "visited");
  assert.equal((await reopened.listStandPreferences(father))[0].notes, "Note papà");
});

void test("note: input invalido e quota conservano record e outbox, retry senza perdita di testo", async (context) => {
  const { repository } = await fixture(context);
  const initial = await repository.saveStandPreferences(scope, "demo-bags", {
    notes: "Testo precedente",
  });
  const queue = await repository.listOutbox(scope);
  const invalid = JSON.parse('{"notes":42}') as {
    notes: string;
  };

  await assert.rejects(repository.saveStandPreferences(scope, "demo-bags", invalid), LocalInputError);
  const add = Reflect.get(IDBObjectStore.prototype, "add");
  const quota = context.mock.method(IDBObjectStore.prototype, "add", function(this: IDBObjectStore, value: unknown) {
    if (this.name === "outbox") {
      throw new DOMException("Quota simulata.", "QuotaExceededError");
    }

    return add.call(this, value);
  });
  const notes = "Ultimo testo da non perdere\n ";

  await assert.rejects(repository.saveStandPreferences(scope, "demo-bags", {
    notes,
  }), {
    name: "QuotaExceededError",
  });
  quota.mock.restore();
  assert.deepEqual(await repository.listStandPreferences(scope), [initial]);
  assert.deepEqual(await repository.listOutbox(scope), queue);
  const saved = await repository.saveStandPreferences(scope, "demo-bags", {
    notes,
  });

  assert.equal(saved.notes, notes);
  assert.equal((await repository.listOutbox(scope)).length, queue.length + 1);
});

void test("stand personali: input recuperabili, interesse iniziale, catalogo immutabile e isolamento origini/profili/eventi", async (context) => {
  const { catalog, repository, connect } = await fixture(context);
  const originalCatalog = structuredClone(catalog);
  const id = "demo-bags";

  assert.equal(await repository.getPersonalStand(scope, id), undefined);
  await repository.savePersonalStand(scope, id, {
    description: "Appunti descrittivi",
  });
  assert.equal((await repository.getVisitData(scope)).personalStands.length, 0);
  assert.equal((await repository.listOutbox(scope)).length, 0);
  const saved = await repository.savePersonalStand(scope, id, {
    name: "  Stand personale  ",
  });

  assert.equal(saved.lastValid?.name, "Stand personale");
  const queue = await repository.listOutbox(scope);
  const creation = queue.find((operation) => operation.entityType === "personal-stand");
  const preference = queue.find((operation) => operation.entityType === "stand-preferences");

  assert.ok(creation);
  assert.ok(preference);
  assert.deepEqual(preference.dependsOn, [creation.operationId]);
  assert.equal(preference.payload.interested, true);
  assert.equal(preference.payload.visitStatus, "to_visit");
  await repository.saveStandPreferences(scope, id, {
    notes: "Note personali",
    priority: 10,
  }, "personal");
  await repository.saveStandPreferences(scope, id, {
    notes: "Note catalogo",
    visitStatus: "visited",
  });
  await repository.savePersonalStand(scope, id, {
    name: "",
    booth: "Posizione libera",
  });
  repository.close();
  const reopened = await connect();
  const recovered = await reopened.getPersonalStand(scope, id);

  assert.equal(recovered?.input.name, "");
  assert.equal(recovered.lastValid?.name, "Stand personale");
  const data = await reopened.getVisitData(scope);
  const personal = resolveStandDetail(catalog, scope, id, data.preferences, [], data.personalStands, "personal");
  const editorial = resolveStandDetail(catalog, scope, id, data.preferences, [], data.personalStands);

  assert.equal(personal?.notes, "Note personali");
  assert.equal(personal.visitStatus, "to_visit");
  assert.equal(personal.location, "Posizione libera");
  assert.equal(editorial?.notes, "Note catalogo");
  assert.equal(editorial.visitStatus, "visited");
  const father = {
    ...scope,
    profileId: "father",
  };

  assert.equal(await reopened.getPersonalStand(father, id), undefined);
  assert.equal((await reopened.getVisitData(father)).personalStands.length, 0);
  await assert.rejects(reopened.saveStandPreferences(father, id, {
    notes: "Vietato",
  }, "personal"), LocalInputError);
  await reopened.savePersonalStand(father, id, {
    name: "Stand papà",
  });
  const second = {
    ...scope,
    eventId: "personal-second-event",
  };

  catalog.config.events.push({
    ...catalog.config.events[0],
    id: second.eventId,
  });
  await reopened.saveCatalog(catalog);
  await reopened.savePersonalStand(second, id, {
    name: "Secondo evento",
  });
  assert.equal((await reopened.getVisitData(second)).personalStands[0].name, "Secondo evento");
  assert.equal((await reopened.getVisitData(scope)).personalStands[0].name, "Stand personale");
  await assert.rejects(reopened.savePersonalStand(scope, id, {
    hall: "missing",
  }), LocalInputError);
  await assert.rejects(reopened.savePersonalStand(scope, id, {
    categoryIds: ["missing"],
  }), LocalInputError);
  assert.deepEqual((await reopened.getCatalog())?.stands, originalCatalog.stands);
  await reopened.saveProduct(scope, "catalog-collision", {
    name: "Prodotto catalogo",
    categoryId: "bags",
    standRef: {
      source: "catalog",
      eventId: scope.eventId,
      standId: id,
    },
  });
  await reopened.deletePersonalStand(scope, id);
  assert.equal((await reopened.getVisitData(scope)).personalStands.length, 0);
  assert.equal((await reopened.getVisitData(scope)).products.length, 1);
  assert.equal((await reopened.getVisitData(father)).personalStands.length, 1);
  assert.equal((await reopened.getVisitData(second)).personalStands.length, 1);
});

void test("cancellazione personale: blocco con prodotto valido o parziale, tombstone e nessuna cascata", async (context) => {
  const { catalog, repository } = await fixture(context);
  const id = "personal-with-product";

  await repository.savePersonalStand(scope, id, {
    name: "Con prodotti",
  });
  const standRef = {
    source: "personal" as const,
    eventId: scope.eventId,
    standId: id,
  };
  const registered = await repository.saveProduct(scope, "personal-product", {
    name: "Registrato",
    categoryId: "bags",
    standRef,
  });

  assert.ok(registered.lastValid);
  const before = await repository.getPersonalStand(scope, id);
  const queue = await repository.listOutbox(scope);

  assert.ok(typeof before?.latestOperationId === "string");
  assert.equal(queue.find((operation) => operation.entityType === "product")
    ?.dependsOn.includes(before.latestOperationId), true);
  await assert.rejects(repository.deletePersonalStand(scope, id), /prodotti collegati/u);
  assert.deepEqual(await repository.getPersonalStand(scope, id), before);
  assert.deepEqual(await repository.listOutbox(scope), queue);
  assert.deepEqual(await repository.getProduct(scope, "personal-product"), registered);
  await repository.savePersonalStand(scope, "partial-product-stand", {
    name: "Con input parziali",
  });
  await repository.saveProduct(scope, "partial-product", {
    standRef: {
      ...standRef,
      standId: "partial-product-stand",
    },
  });
  await assert.rejects(repository.deletePersonalStand(scope, "partial-product-stand"), /prodotti collegati/u);
  await repository.savePersonalStand(scope, "removable", {
    name: "Eliminabile",
  });
  await repository.saveStandPreferences(scope, "removable", {
    notes: "Note da eliminare",
  }, "personal");
  const lastPreferences = (await repository.listStandPreferences(scope))
    .find((entry) => entry.standRef.source === "personal" && entry.standRef.standId === "removable");

  await repository.deletePersonalStand(scope, "removable");
  const data = await repository.getVisitData(scope);
  const tombstone = await repository.getPersonalStand(scope, "removable");
  const deletion = (await repository.listOutbox(scope)).find((operation) => operation.action === "delete");

  assert.equal(data.personalStands.some((stand) => stand.id === "removable"), false);
  assert.equal(data.preferences.some((entry) => entry.standRef.standId === "removable"), false);
  assert.equal(typeof tombstone?.lastValid?.deletedAt, "string");
  assert.ok(deletion);
  assert.ok(lastPreferences);
  assert.ok(deletion.dependsOn.includes(lastPreferences.latestOperationId));
  await assert.rejects(repository.savePersonalStand(scope, "removable", {
    name: "Resurrezione",
  }), LocalInputError);
  await assert.rejects(repository.saveStandPreferences(scope, "removable", {
    priority: 4,
  }, "personal"), LocalInputError);
  assert.equal(resolveStandList(catalog, scope, data.preferences, data.personalStands)
    .some((stand) => stand.id === "removable"), false);
});

void test("stand personali: quota annulla creazione/preferenze/outbox e cancellazione, con retry", async (context) => {
  const { repository } = await fixture(context);
  const add = Reflect.get(IDBObjectStore.prototype, "add");
  const quota = context.mock.method(IDBObjectStore.prototype, "add", function(this: IDBObjectStore, value: unknown) {
    if (this.name === "outbox") {
      throw new DOMException("Quota simulata", "QuotaExceededError");
    }

    return add.call(this, value);
  });

  await assert.rejects(repository.savePersonalStand(scope, "quota-stand", {
    name: "Quota",
  }));
  assert.equal(await repository.getPersonalStand(scope, "quota-stand"), undefined);
  assert.deepEqual(await repository.listStandPreferences(scope), []);
  assert.deepEqual(await repository.listOutbox(scope), []);
  quota.mock.restore();
  const stand = await repository.savePersonalStand(scope, "quota-stand", {
    name: "Quota",
  });
  const preferences = await repository.listStandPreferences(scope);
  const queue = await repository.listOutbox(scope);
  const abort = context.mock.method(IDBObjectStore.prototype, "add", function(this: IDBObjectStore, value: unknown) {
    const request = add.call(this, value);

    if (this.name === "outbox") {
      request.addEventListener("success", () => {
        this.transaction.abort();
      });
    }

    return request;
  });

  await assert.rejects(repository.deletePersonalStand(scope, "quota-stand"));
  abort.mock.restore();
  assert.deepEqual(await repository.getPersonalStand(scope, "quota-stand"), stand);
  assert.deepEqual(await repository.listStandPreferences(scope), preferences);
  assert.deepEqual(await repository.listOutbox(scope), queue);
  await repository.deletePersonalStand(scope, "quota-stand");
  assert.equal((await repository.getVisitData(scope)).personalStands.length, 0);
  const getAll = Reflect.get(IDBIndex.prototype, "getAll");
  const readFailure = context.mock.method(IDBIndex.prototype, "getAll", function(
    this: IDBIndex,
    ...args: Parameters<IDBIndex["getAll"]>
  ) {
    if (this.objectStore.name === "stand_preferences") {
      throw new DOMException("Errore di lettura simulato", "UnknownError");
    }

    return getAll.apply(this, args);
  });

  await assert.rejects(repository.getVisitData(scope), {
    name: "UnknownError",
  });
  readFailure.mock.restore();
  assert.equal((await repository.getVisitData(scope)).personalStands.length, 0);
});

void test("migrazione v2 → v3 conserva note, preferenze e outbox degli stand esistenti", async (context) => {
  const factory = new IDBFactory();
  const name = `expotrack-test-migration-v2-${crypto.randomUUID()}`;
  const request = factory.open(name, 2);

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
    database.createObjectStore("stand_preferences", {
      keyPath: [
        "profileId", "eventId", "standRef.source", "standRef.standId",
      ],
    }).createIndex("by_context", ["profileId", "eventId"]);
    const outbox = database.createObjectStore("outbox", {
      keyPath: "operationId",
    });

    outbox.createIndex("by_context", ["profileId", "eventId"]);
    outbox.createIndex("by_entity_sequence", [
      "profileId", "eventId", "entityType", "entityId", "localSequence",
    ], {
      unique: true,
    });
  };
  const legacy = await readRequest<IDBDatabase>(request);
  const catalog = await loadCatalog(path.join(process.cwd(), "tests/fixtures/catalog"));
  const repository = new LocalRepository(legacy);

  await repository.initializeProfileSession(catalog);
  await repository.selectProfile(scope.profileId);
  const preference: LocalStandPreferences = {
    ...scope,
    standRef: {
      source: "catalog",
      eventId: scope.eventId,
      standId: "demo-bags",
    },
    notes: "Note anteriori alla migrazione",
    interested: false,
    priority: 5,
    visitStatus: "to_revisit",
    localSequence: 1,
    latestOperationId: "v2-operation",
    serverRevision: null,
    updatedAt: "2026-11-02T00:00:00Z",
  };
  const operation: OutboxOperation = {
    ...scope,
    operationId: "v2-operation",
    entityType: "stand-preferences",
    entityId: JSON.stringify(["catalog", "demo-bags"]),
    action: "create",
    localSequence: 1,
    baseRevision: null,
    dependsOn: [],
    status: "pending",
    queuedAt: preference.updatedAt,
    payload: preference,
  };

  await inTransaction(legacy, ["stand_preferences", "outbox"], "readwrite", (transaction) => {
    transaction.objectStore("stand_preferences").put(preference);
    transaction.objectStore("outbox").add(operation);
  });
  repository.close();
  const upgraded = await openLocalRepository({
    factory,
    name,
  });

  context.after(async () => {
    upgraded.close();
    await readRequest<void>(factory.deleteDatabase(name));
  });
  assert.deepEqual(await upgraded.listStandPreferences(scope), [preference]);
  assert.deepEqual(await upgraded.listOutbox(scope), [operation]);
  assert.deepEqual((await upgraded.getProfileSession())?.context, scope);
  assert.deepEqual((await upgraded.getVisitData(scope)).personalStands, []);
  await upgraded.savePersonalStand(scope, "post-migration", {
    name: "Dopo migrazione",
  });
  assert.equal((await upgraded.getVisitData(scope)).personalStands.length, 1);
  assert.deepEqual(await upgraded.getCatalog(), catalog);
});
