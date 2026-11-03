import assert from "node:assert/strict";
import test from "node:test";

import { IDBFactory } from "fake-indexeddb";

import { loadCatalog } from "../../src/lib/config/load-catalog";
import { initializeServerCatalog } from "../../src/lib/offline/catalog-bootstrap";
import { openLocalRepository } from "../../src/lib/offline/repository";

import type { CatalogSnapshot } from "../../src/types/catalog";

function bootstrap(catalog: CatalogSnapshot, hash = "a".repeat(64)): Response {
  return Response.json({
    schemaVersion: 1,
    configHash: hash,
    catalog,
  });
}

void test("bootstrap reale: prima apertura, aggiornamento e 304 preservano raccolte, override e coda", async (context) => {
  const catalog = await loadCatalog("tests/fixtures/catalog");
  const factory = new IDBFactory();
  const connect = () => openLocalRepository({
    name: "bootstrap-test",
    factory,
  });
  const repository = await connect();

  context.after(() => {
    repository.close();
  });
  await initializeServerCatalog(repository, () => Promise.resolve(bootstrap(catalog)));
  const session = await repository.selectProfile("me");

  assert.ok(session.context);
  const scope = session.context;
  const product = await repository.saveProduct(scope, "retained", {
    name: "Raccolto sul telefono",
    categoryId: "bags",
    description: "Nota",
    standRef: {
      source: "catalog",
      eventId: scope.eventId,
      standId: "demo-bags",
    },
  });

  await repository.saveStandPreferences(scope, "demo-bags", {
    interested: false,
    notes: "Da conservare",
    checklistChange: {
      id: "check-capacity",
      checked: true,
    },
  });
  await repository.setBudget("me", "bags", "0");
  await repository.savePersonalProfile("usr-bootstrap", {
    name: "Personale",
    color: "#147D3C",
  });
  const queue = await repository.listPendingOperations();
  const preferences = await repository.listStandPreferences(scope);
  const budget = await repository.listBudgetOverrides();
  const changed = structuredClone(catalog);

  changed.stands[0].name = "Nuovo catalogo";
  changed.profiles[0].budgets[0].amount = 999;
  changed.interests[0].priority = 10;
  const updated = await initializeServerCatalog(repository, (_url, options) => {
    assert.equal(new Headers(options?.headers).get("if-none-match"), `"${"a".repeat(64)}"`);

    return Promise.resolve(bootstrap(changed, "b".repeat(64)));
  });

  assert.equal(updated.profile?.id, "me");
  assert.ok(updated.catalog.profiles.some((profile) => profile.id === "usr-bootstrap"));
  assert.equal(updated.catalog.stands[0].name, "Nuovo catalogo");
  assert.deepEqual(await repository.getProduct(scope, "retained"), product);
  assert.deepEqual(await repository.listStandPreferences(scope), preferences);
  assert.deepEqual(await repository.listBudgetOverrides(), budget);
  assert.deepEqual(await repository.listPendingOperations(), queue);
  repository.close();
  const reopened = await connect();

  context.after(() => {
    reopened.close();
  });
  const notModified = await initializeServerCatalog(reopened, () => Promise.resolve(
    new Response(null, {
      status: 304,
    }),
  ));

  assert.equal(notModified.profile?.id, "me");
  assert.equal(await reopened.getServerCatalogHash(), "b".repeat(64));
  assert.deepEqual(await reopened.getProduct(scope, "retained"), product);
  assert.deepEqual(await reopened.listPendingOperations(), queue);
});

void test("server assente o risposta invalida mantengono l’ultimo catalogo; primo avvio fallisce senza falso successo", async (context) => {
  const catalog = await loadCatalog("tests/fixtures/catalog");
  const repository = await openLocalRepository({
    factory: new IDBFactory(),
    name: "fallback-test",
  });

  context.after(() => {
    repository.close();
  });
  const unavailable: typeof fetch = () => Promise.reject(new TypeError("Offline"));

  await assert.rejects(initializeServerCatalog(repository, unavailable));
  assert.equal(await repository.getProfileSession(), null);
  await initializeServerCatalog(repository, () => Promise.resolve(bootstrap(catalog)));
  await repository.selectProfile("me");
  const original = await repository.getProfileSession();
  const invalid = structuredClone(catalog);

  invalid.stands[0].categoryIds = ["missing"];
  for (const request of [
    unavailable,
    () => Promise.resolve(new Response(null, {
      status: 503,
    })),
    () => Promise.resolve(Response.json({})),
    () => Promise.resolve(bootstrap(invalid, "b".repeat(64))),
  ]) {
    assert.deepEqual(await initializeServerCatalog(repository, request), original);
    assert.equal(await repository.getServerCatalogHash(), "a".repeat(64));
  }
  // A collision discovered in the local transaction must roll back snapshot and hash together.
  await repository.savePersonalProfile("usr-owned", {
    name: "Personale",
    color: "#147D3C",
  });
  const collision = structuredClone(catalog);

  collision.profiles.push({
    ...collision.profiles[0],
    id: "usr-owned",
  });
  await initializeServerCatalog(repository, () => Promise.resolve(bootstrap(collision, "c".repeat(64))));
  assert.equal(await repository.getServerCatalogHash(), "a".repeat(64));
  assert.equal((await repository.getProfileSession())?.catalog.profiles.find((profile) => profile.id === "usr-owned")?.origin, "personal");
  await repository.initializeProfileSession(catalog);
  assert.equal(await repository.getServerCatalogHash(), null);
});
