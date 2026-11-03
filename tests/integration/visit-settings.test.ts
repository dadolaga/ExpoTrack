import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { IDBFactory, IDBObjectStore } from "fake-indexeddb";

import { loadCatalog } from "../../src/lib/config/load-catalog";
import { readRequest } from "../../src/lib/offline/database";
import { effectiveBudget } from "../../src/lib/offline/profile-settings";
import { resolveQuestionnaire } from "../../src/lib/offline/questionnaire-input";
import { openLocalRepository } from "../../src/lib/offline/repository";

import type { LocalRepository } from "../../src/lib/offline/repository";
import type { TestContext } from "node:test";

async function fixture(context: TestContext) {
  const catalog = await loadCatalog(path.join(process.cwd(), "tests/fixtures/catalog"));

  catalog.config.events.push({
    ...catalog.config.events[0],
    id: "second-event",
    name: "Altro evento",
  });
  const factory = new IDBFactory();
  const name = `expotrack-test-visit-settings-${crypto.randomUUID()}`;
  const connections: LocalRepository[] = [];

  async function connect() {
    const repository = await openLocalRepository({
      name,
      factory,
    });

    connections.push(repository);

    return repository;
  }

  context.after(async () => {
    for (const connection of connections) {
      connection.close();
    }
    await readRequest<void>(factory.deleteDatabase(name));
  });
  const repository = await connect();

  await repository.initializeProfileSession(catalog);

  return {
    catalog,
    repository,
    connect,
  };
}

void test("budget esatto per profilo, zero/esclusione/ripristino, riapertura e rollback della coda", async (context) => {
  const { catalog, repository, connect } = await fixture(context);
  const scope = (await repository.selectProfile("me")).context;

  assert.ok(scope);
  assert.equal(effectiveBudget(catalog, [], "me", "bags").amount, 120);
  assert.equal(effectiveBudget(catalog, [], "father", "bags").amount, null);
  catalog.categories.push({
    id: "small-bags",
    name: "Piccole",
    parentId: "bags",
  });
  assert.equal(effectiveBudget(catalog, [], "me", "small-bags").amount, null);
  await repository.setBudget("me", "bags", "0");
  assert.equal(effectiveBudget(catalog, await repository.listBudgetOverrides(), "me", "bags").amount, 0);
  await repository.setBudget("me", "bags", null);
  const reopened = await connect();

  await reopened.initializeProfileSession(catalog);
  assert.equal(effectiveBudget(catalog, await reopened.listBudgetOverrides(), "me", "bags").amount, null);
  const anotherEvent = catalog.config.events.find((event) => event.enabled && event.id !== scope.eventId);

  assert.ok(anotherEvent);
  assert.equal((await reopened.selectEvent(anotherEvent.id)).context?.eventId, anotherEvent.id);
  assert.equal(effectiveBudget(catalog, await reopened.listBudgetOverrides(), "me", "bags").amount, null);
  await reopened.setBudget("me", "bags", undefined);
  assert.equal(effectiveBudget(catalog, await reopened.listBudgetOverrides(), "me", "bags").amount, 120);
  const before = await reopened.listBudgetOverrides();
  const queue = await reopened.listPendingOperations();

  for (const invalid of [
    "", "-1", "12,345", "Infinity",
  ]) {
    await assert.rejects(reopened.setBudget("me", "bags", invalid));
  }
  const add = Reflect.get(IDBObjectStore.prototype, "add");
  const mocked = context.mock.method(IDBObjectStore.prototype, "add", function(this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
    if (this.name === "outbox") {
      throw new DOMException("Quota", "QuotaExceededError");
    }

    return add.call(this, value, key);
  });

  await assert.rejects(reopened.setBudget("me", "bags", "19,90"));
  mocked.mock.restore();
  assert.deepEqual(await reopened.listBudgetOverrides(), before);
  assert.deepEqual(await reopened.listPendingOperations(), queue);
  await reopened.setBudget("me", "bags", "19,90");
  assert.equal(effectiveBudget(catalog, await reopened.listBudgetOverrides(), "me", "bags").amount, 19.9);
  assert.ok((await reopened.listPendingOperations()).every((entry) => entry.eventId === undefined));
});

void test("profili personali protetti da collisioni, isolati e cancellati preservando dati e dipendenze", async (context) => {
  const { catalog, repository, connect } = await fixture(context);

  await assert.rejects(repository.savePersonalProfile("me", {
    name: "Altro",
    color: "#123456",
  }));
  await assert.rejects(repository.deletePersonalProfile("me"));
  await assert.rejects(repository.savePersonalProfile("usr-empty", {
    name: " ",
    color: "#123456",
  }));
  await repository.savePersonalProfile("usr-visit", {
    name: "Visitatore",
    color: "#123456",
  });
  const session = await repository.selectProfile("usr-visit");

  assert.ok(session.context);
  assert.equal(session.profile?.origin, "personal");
  assert.equal(resolveQuestionnaire(session.catalog, "usr-visit", "bags"), undefined);
  assert.deepEqual(session.catalog.interests.filter((entry) => entry.profileId === "usr-visit"), []);
  const product = await repository.saveProduct(session.context, "personal-product", {
    name: "Raccolta personale",
    categoryId: "bags",
    description: "Da conservare",
    standRef: {
      source: "catalog",
      eventId: session.context.eventId,
      standId: "demo-bags",
    },
  });

  await repository.setBudget("usr-visit", "bags", "25");
  await repository.savePersonalProfile("usr-visit", {
    name: "Nome aggiornato",
    color: "#147D3C",
  });
  const reopened = await connect();
  const recovered = await reopened.initializeProfileSession(catalog);

  const collision = structuredClone(catalog);

  collision.profiles.push({
    ...catalog.profiles[0],
    id: "usr-visit",
  });
  await assert.rejects(reopened.initializeProfileSession(collision));
  assert.equal((await reopened.getProfileSession())?.profile?.name, "Nome aggiornato");
  assert.equal(recovered.profile?.name, "Nome aggiornato");
  assert.deepEqual(await reopened.getProduct(session.context, product.id), product);
  const queue = await reopened.listPendingOperations();
  const created = queue.find((entry) => entry.entityType === "profile" && entry.action === "create");
  const productOperation = queue.find((entry) => entry.entityType === "product");

  assert.ok(created);
  assert.ok(productOperation);
  assert.ok(productOperation.dependsOn.includes(created.operationId));
  await reopened.deletePersonalProfile("usr-visit");
  const after = await reopened.listPendingOperations();
  const deletion = after.find((entry) => entry.entityType === "profile" && entry.action === "delete");

  assert.ok(deletion);
  assert.ok(queue.every((entry) => deletion.dependsOn.includes(entry.operationId)));
  assert.deepEqual(after.filter((entry) => entry !== deletion), queue);
  assert.deepEqual(await reopened.getProduct(session.context, product.id), product);
  assert.equal((await reopened.getProfileSession())?.profile, null);
  await assert.rejects(reopened.selectProfile("usr-visit"));
  await assert.rejects(reopened.saveProduct(session.context, product.id, {
    name: "Scrittura tardiva",
  }));
  await assert.rejects(reopened.setBudget("usr-visit", "bags", "30"));
  await reopened.selectProfile("me");
  assert.deepEqual(await reopened.listProducts({
    ...session.context,
    profileId: "me",
  }), []);
});

void test("rating e scelte persistono per ID, si cancellano e rifiutano valori fuori contratto", async (context) => {
  const { catalog, repository, connect } = await fixture(context);
  const scope = (await repository.selectProfile("me")).context;
  const definitionSnapshot = resolveQuestionnaire(catalog, "me", "bags");

  assert.ok(scope);
  assert.ok(definitionSnapshot);
  const saved = await repository.saveProduct(scope, "answers", {
    name: "Prodotto",
    categoryId: "bags",
    description: "",
    standRef: {
      source: "catalog",
      eventId: scope.eventId,
      standId: "demo-bags",
    },
    questionnaireInputs: [
      {
        definitionSnapshot,
        answers: {
          carrying: "hand",
          features: ["pockets", "padding"],
          comfort: 10,
        },
      },
    ],
  });
  const reopened = await connect();

  assert.deepEqual((await reopened.getProduct(scope, "answers"))?.input, saved.input);
  assert.deepEqual(saved.lastValid?.questionnaireAnswers?.[0]?.answers, {
    carrying: "hand",
    features: ["pockets", "padding"],
    comfort: 10,
  });
  const invalid = await reopened.saveProduct(scope, "answers", {
    questionnaireInputs: [
      {
        definitionSnapshot,
        answers: {
          carrying: "label inventata",
          features: ["unknown"],
          comfort: 0,
        },
      },
    ],
  });

  assert.ok(invalid.issues.questionnaires);
  assert.deepEqual(invalid.lastValid?.questionnaireAnswers, saved.lastValid.questionnaireAnswers);
  const cleared = await reopened.saveProduct(scope, "answers", {
    questionnaireInputs: [
      {
        definitionSnapshot,
        answers: {},
      },
    ],
  });

  assert.deepEqual(cleared.lastValid?.questionnaireAnswers?.[0]?.answers, {});
  assert.equal(cleared.input.rating, undefined);
});
