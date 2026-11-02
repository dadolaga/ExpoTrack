import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { IDBFactory, IDBObjectStore } from "fake-indexeddb";

import { loadCatalog } from "../../src/lib/config/load-catalog";
import { openLocalDatabase, readRequest } from "../../src/lib/offline/database";
import { LocalInputError } from "../../src/lib/offline/product-input";
import { questionnaireKey, resolveQuestionnaire } from "../../src/lib/offline/questionnaire-input";
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

void test("risposte facoltative: refresh, input invalido recuperabile e ultima risposta valida in outbox", async (context) => {
  const { repository, catalog, connect } = await fixture(context);
  const definitionSnapshot = resolveQuestionnaire(catalog, "me", "bags");

  assert.ok(definitionSnapshot);
  const original = await repository.saveProduct(firstContext, "answers", productInput(firstContext));

  assert.ok(original.lastValid);
  assert.deepEqual(original.lastValid.questionnaireAnswers, []);
  assert.equal(original.input.questionnaireInputs, undefined);
  const queueBefore = await repository.listOutbox(firstContext);
  const invalidFirst = await repository.saveProduct(firstContext, "answers", {
    questionnaireInputs: [
      {
        definitionSnapshot,
        answers: {
          capacity_litres: "1,",
        },
      },
    ],
  });

  assert.deepEqual(invalidFirst.lastValid, original.lastValid);
  assert.deepEqual(await repository.listOutbox(firstContext), queueBefore);
  const text = "È comoda?\n<script>test</script> ".repeat(1000);
  const valid = await repository.saveProduct(firstContext, "answers", {
    questionnaireInputs: [
      {
        definitionSnapshot,
        answers: {
          capacity_litres: "0",
          waterproof: false,
          impression: text,
        },
      },
    ],
  });

  assert.deepEqual(valid.lastValid?.questionnaireAnswers?.[0]?.answers, {
    impression: text,
    capacity_litres: 0,
    waterproof: false,
  });
  const invalid = await repository.saveProduct(firstContext, "answers", {
    name: "",
    favorite: true,
    questionnaireInputs: [
      {
        definitionSnapshot,
        answers: {
          capacity_litres: "abc",
          waterproof: true,
          impression: "Nuova impressione",
        },
      },
    ],
  });

  assert.notEqual(
    invalid.issues.questionnaires?.[questionnaireKey(definitionSnapshot)]?.capacity_litres,
    undefined,
  );
  assert.ok(invalid.lastValid);
  assert.ok(invalid.lastValid.questionnaireAnswers);
  assert.equal(invalid.lastValid.name, original.lastValid.name);
  assert.equal(invalid.lastValid.favorite, true);
  assert.deepEqual(invalid.lastValid.questionnaireAnswers[0]?.answers, {
    impression: "Nuova impressione",
    capacity_litres: 0,
    waterproof: true,
  });
  const queue = await repository.listOutbox(firstContext);
  const update = queue.find((entry) => entry.operationId === invalid.latestOperationId);

  assert.equal(update?.entityType, "product");
  assert.deepEqual(update.payload.questionnaireAnswers, invalid.lastValid.questionnaireAnswers);
  repository.close();
  const reopened = await connect();
  const recovered = await reopened.getProduct(firstContext, "answers");

  assert.deepEqual(recovered, invalid);
  const cleared = await reopened.saveProduct(firstContext, "answers", {
    name: "Ripristinato",
    questionnaireInputs: [
      {
        definitionSnapshot,
        answers: {},
      },
    ],
  });

  assert.deepEqual(cleared.issues, {});
  assert.deepEqual(cleared.lastValid?.questionnaireAnswers?.[0]?.answers, {});
});

void test("versioni questionario indipendenti e storico conservato dopo rimozione, copia ed eliminazione", async (context) => {
  const { repository, catalog, connect } = await fixture(context);
  const definitionSnapshot = resolveQuestionnaire(catalog, "me", "bags");

  assert.ok(definitionSnapshot);
  const first = {
    definitionSnapshot,
    answers: {
      waterproof: false,
      impression: "Risposta originale",
    },
  };

  await repository.saveProduct(firstContext, "history", {
    ...productInput(firstContext),
    questionnaireInputs: [first],
  });
  const secondDefinition = structuredClone(definitionSnapshot);

  secondDefinition.version = 2;
  secondDefinition.title = "Nuova prova";
  secondDefinition.questions = [
    {
      id: "impression",
      label: "Una domanda diversa",
      type: "text",
    },
  ];
  catalog.questionnaires = catalog.questionnaires.map((definition) => definition.id === definitionSnapshot.id
    ? secondDefinition : definition);
  await repository.saveCatalog(catalog, "v2");
  const second = {
    definitionSnapshot: secondDefinition,
    answers: {
      impression: "Risposta versione 2",
    },
  };
  const updated = await repository.saveProduct(firstContext, "history", {
    questionnaireInputs: [first, second],
  });

  assert.equal(updated.lastValid?.questionnaireAnswers?.length, 2);
  assert.equal(updated.lastValid.questionnaireAnswers[0]?.definitionSnapshot.title, definitionSnapshot.title);
  await assert.rejects(repository.saveProduct(firstContext, "history", {
    questionnaireInputs: [
      {
        ...first,
        answers: {
          waterproof: true,
        },
      }, second,
    ],
  }), /storico/u);
  await assert.rejects(repository.saveProduct(firstContext, "history", {
    questionnaireInputs: [second],
  }), /conservate/u);
  catalog.questionnaires = [];
  await repository.saveCatalog(catalog, "removed");
  await repository.saveProduct(firstContext, "history", {
    description: "Le risposte restano intatte",
  });
  const copy = await repository.duplicateProduct(firstContext, "history");

  assert.deepEqual(copy.lastValid?.questionnaireAnswers, updated.lastValid.questionnaireAnswers);
  assert.notEqual(copy.id, updated.id);
  repository.close();
  const reopened = await connect();
  const recovered = await reopened.getProduct(firstContext, "history");

  assert.ok(recovered);
  assert.deepEqual(recovered.input.questionnaireInputs, updated.input.questionnaireInputs);
  assert.deepEqual(recovered.lastValid?.questionnaireAnswers, updated.lastValid.questionnaireAnswers);
  await reopened.deleteProduct(firstContext, "history");
  await assert.rejects(reopened.saveProduct(firstContext, "history", {
    questionnaireInputs: [first, second],
  }), LocalInputError);
  assert.deepEqual(
    (await reopened.getProduct(firstContext, copy.id))?.lastValid?.questionnaireAnswers,
    copy.lastValid.questionnaireAnswers,
  );
});

void test("risposte e snapshot isolati per profilo/evento e categoria prima della registrazione", async (context) => {
  const { repository, catalog } = await fixture(context);
  const me = resolveQuestionnaire(catalog, "me", "bags");
  const father = resolveQuestionnaire(catalog, "father", "bags");

  assert.ok(me);
  assert.ok(father);
  const inputs = [
    {
      definitionSnapshot: me,
      answers: {
        waterproof: false,
      },
    },
  ];
  const partial = await repository.saveProduct(firstContext, "scope", {
    ...productInput(firstContext),
    name: "",
    questionnaireInputs: inputs,
  });

  assert.equal(partial.lastValid, null);
  await repository.saveProduct(firstContext, "scope", {
    categoryId: "lights",
  });
  const registered = await repository.saveProduct(firstContext, "scope", {
    name: "Luce",
  });

  assert.deepEqual(registered.lastValid?.questionnaireAnswers, []);
  assert.deepEqual(registered.input.questionnaireInputs, inputs);
  for (const scope of [
    {
      ...firstContext,
      profileId: "father",
    }, {
      ...firstContext,
      eventId: secondEvent,
    },
  ]) {
    assert.equal(await repository.getProduct(scope, "scope"), undefined);
  }
  const fatherContext = {
    ...firstContext,
    profileId: "father",
  };

  await assert.rejects(repository.saveProduct(fatherContext, "scope", {
    ...productInput(fatherContext),
    questionnaireInputs: inputs,
  }), /profilo e categoria/u);
  const savedFather = await repository.saveProduct(fatherContext, "scope", {
    ...productInput(fatherContext),
    questionnaireInputs: [
      {
        definitionSnapshot: father,
        answers: {
          easy_opening: false,
        },
      },
    ],
  });

  assert.equal(savedFather.lastValid?.questionnaireAnswers?.[0]?.answers.easy_opening, false);
  const fabricated = structuredClone(me);

  fabricated.questions[0] = {
    id: "invented",
    label: "Domanda inventata",
    type: "text",
  };
  await assert.rejects(repository.saveProduct(firstContext, "forged", {
    ...productInput(firstContext),
    questionnaireInputs: [
      {
        definitionSnapshot: fabricated,
        answers: {
          invented: "Test",
        },
      },
    ],
  }), /profilo e categoria/u);
  assert.equal(await repository.getProduct(firstContext, "forged"), undefined);
});

void test("quota sulle risposte annulla record e outbox, retry senza perdita", async (context) => {
  const { repository, catalog } = await fixture(context);
  const definitionSnapshot = resolveQuestionnaire(catalog, "me", "bags");

  assert.ok(definitionSnapshot);
  const original = await repository.saveProduct(firstContext, "quota-answers", productInput(firstContext));
  const before = await repository.listOutbox(firstContext);
  const add = Reflect.get(IDBObjectStore.prototype, "add");
  const mocked = context.mock.method(IDBObjectStore.prototype, "add", function(this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
    if (this.name === "outbox") {
      throw new DOMException("Quota simulata nel test isolato.", "QuotaExceededError");
    }

    return add.call(this, value, key);
  });
  const patch = {
    questionnaireInputs: [
      {
        definitionSnapshot,
        answers: {
          waterproof: false,
          capacity_litres: "12,5",
        },
      },
    ],
  };

  await assert.rejects(repository.saveProduct(firstContext, "quota-answers", patch), {
    name: "QuotaExceededError",
  });
  assert.deepEqual(await repository.getProduct(firstContext, "quota-answers"), original);
  assert.deepEqual(await repository.listOutbox(firstContext), before);
  mocked.mock.restore();
  const saved = await repository.saveProduct(firstContext, "quota-answers", patch);

  assert.equal(saved.lastValid?.questionnaireAnswers?.[0]?.answers.capacity_litres, 12.5);
  assert.equal((await repository.listOutbox(firstContext)).length, before.length + 1);
});

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

void test("prezzo e voto distinguono assenza e zero, conservano input errati e ultima versione valida", async (context) => {
  const { repository, connect } = await fixture(context);
  const initial = await repository.saveProduct(firstContext, "pricing", productInput(firstContext));

  assert.equal(initial.lastValid?.price, null);
  assert.equal(initial.lastValid.rating, null);
  const zero = await repository.saveProduct(firstContext, "pricing", {
    price: "0",
    rating: 1,
  });

  assert.equal(zero.lastValid?.price, 0);
  assert.equal(zero.lastValid.rating, 1);
  const priced = await repository.saveProduct(firstContext, "pricing", {
    price: "8799,50",
  });

  assert.equal(priced.lastValid?.price, 8799.5);
  const before = await repository.listOutbox(firstContext);
  const invalid = await repository.saveProduct(firstContext, "pricing", {
    price: "12,",
    rating: 11,
  });

  assert.notEqual(invalid.issues.price, undefined);
  assert.notEqual(invalid.issues.rating, undefined);
  assert.equal(invalid.lastValid?.price, 8799.5);
  assert.equal(invalid.lastValid.rating, 1);
  assert.equal((await repository.listOutbox(firstContext)).length, before.length);
  const reopened = await connect();
  const recovered = await reopened.getProduct(firstContext, "pricing");

  assert.equal(recovered?.input.price, "12,");
  assert.equal(recovered.input.rating, 11);
  const removed = await reopened.saveProduct(firstContext, "pricing", {
    price: "",
    rating: null,
  });

  assert.equal(removed.lastValid?.price, null);
  assert.equal(removed.lastValid.rating, null);
  assert.deepEqual(removed.issues, {});
});

void test("descrizione lunga e preferito salvano anche con nome temporaneamente vuoto, senza cambiare visita", async (context) => {
  const { repository, connect } = await fixture(context);

  await repository.saveProduct(firstContext, "impressions", productInput(firstContext));
  const notes = "Impressioni personali senza limite.\n".repeat(1000);
  const edited = await repository.saveProduct(firstContext, "impressions", {
    name: "",
    description: notes,
    favorite: true,
    price: "19.90",
    rating: 10,
  });

  assert.notEqual(edited.issues.name, undefined);
  assert.equal(edited.input.name, "");
  assert.equal(edited.lastValid?.name, "Prodotto di prova");
  assert.equal(edited.lastValid.description, notes);
  assert.equal(edited.lastValid.favorite, true);
  const reopened = await connect();
  const recovered = await reopened.getProduct(firstContext, "impressions");

  assert.equal(recovered?.input.description, notes);
  assert.equal(recovered.input.name, "");
  assert.equal((await reopened.listRegisteredProducts(firstContext)).length, 1);
  assert.deepEqual(await reopened.listStandPreferences(firstContext), []);
  assert.equal(await reopened.getProduct({
    ...firstContext,
    profileId: "father",
  }, "impressions"), undefined);
  assert.equal(await reopened.getProduct({
    ...firstContext,
    eventId: secondEvent,
  }, "impressions"), undefined);
  const operations = await reopened.listOutbox(firstContext);
  const latest = operations.at(-1);

  assert.equal(latest?.entityType, "product");
  assert.equal(latest.payload.description, notes);
  assert.equal(latest.payload.name, "Prodotto di prova");
  assert.equal(latest.payload.favorite, true);
});

void test("duplicazione atomica copia i dati validi ma separa identità e pianificazione, con rollback su quota", async (context) => {
  const { repository, catalog, connect } = await fixture(context);
  const planned = catalog.plannedProducts.find((entry) => entry.profileId === firstContext.profileId);

  assert.ok(planned);
  const source = await repository.saveProduct(firstContext, "original", {
    ...productInput(firstContext),
    description: "Descrizione da conservare",
    price: "0",
    rating: 1,
    favorite: true,
    plannedProductId: planned.id,
  });

  await repository.saveProduct(firstContext, "original", {
    name: "",
    price: "12,",
  });
  const before = await repository.listProducts(firstContext);
  const queue = await repository.listOutbox(firstContext);
  const add = Reflect.get(IDBObjectStore.prototype, "add");
  const mocked = context.mock.method(IDBObjectStore.prototype, "add", function(this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
    if (this.name === "outbox") {
      throw new DOMException("Quota simulata", "QuotaExceededError");
    }

    return add.call(this, value, key);
  });

  await assert.rejects(repository.duplicateProduct(firstContext, "original"), {
    name: "QuotaExceededError",
  });
  mocked.mock.restore();
  assert.deepEqual(await repository.listProducts(firstContext), before);
  assert.deepEqual(await repository.listOutbox(firstContext), queue);
  const copy = await repository.duplicateProduct(firstContext, "original");

  assert.notEqual(copy.id, source.id);
  assert.equal(copy.lastValid?.name, source.lastValid?.name);
  assert.equal(copy.input.price, "0");
  assert.equal(copy.input.rating, 1);
  assert.equal(copy.input.favorite, true);
  assert.equal(copy.input.description, "Descrizione da conservare");
  assert.equal(copy.input.plannedProductId, undefined);
  assert.equal(copy.lastValid?.plannedProductId, null);
  assert.equal(copy.localSequence, 1);
  assert.equal(copy.serverRevision, null);
  const operations = (await repository.listOutbox(firstContext)).filter((entry) => entry.entityId === copy.id);

  assert.equal(operations.length, 1);
  assert.equal(operations[0]?.action, "create");
  const reopened = await connect();

  assert.deepEqual(await reopened.getProduct(firstContext, copy.id), copy);
  assert.equal(await reopened.getProduct({
    ...firstContext,
    profileId: "father",
  }, copy.id), undefined);
  assert.deepEqual(await reopened.listStandPreferences(firstContext), []);
});

void test("eliminazione atomica idempotente esclude il prodotto dalle viste e blocca scritture tardive", async (context) => {
  const { repository, connect } = await fixture(context);

  await repository.saveProduct(firstContext, "delete-me", productInput(firstContext));
  const before = await repository.getProduct(firstContext, "delete-me");
  const queue = await repository.listOutbox(firstContext);
  const add = Reflect.get(IDBObjectStore.prototype, "add");
  const mocked = context.mock.method(IDBObjectStore.prototype, "add", function(this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
    if (this.name === "outbox") {
      throw new DOMException("Quota simulata", "QuotaExceededError");
    }

    return add.call(this, value, key);
  });

  await assert.rejects(repository.deleteProduct(firstContext, "delete-me"), {
    name: "QuotaExceededError",
  });
  mocked.mock.restore();
  assert.deepEqual(await repository.getProduct(firstContext, "delete-me"), before);
  assert.deepEqual(await repository.listOutbox(firstContext), queue);
  await repository.deleteProduct({
    ...firstContext,
    profileId: "father",
  }, "delete-me");
  assert.deepEqual(await repository.getProduct(firstContext, "delete-me"), before);
  await repository.deleteProduct(firstContext, "delete-me");
  await repository.deleteProduct(firstContext, "delete-me");
  const reopened = await connect();
  const removed = await reopened.getProduct(firstContext, "delete-me");

  assert.equal(typeof removed?.deletedAt, "string");
  assert.equal(removed?.lastValid?.deletedAt, removed?.deletedAt);
  assert.deepEqual(await reopened.listRegisteredProducts(firstContext), []);
  assert.deepEqual((await reopened.getVisitData(firstContext)).products, []);
  const operations = await reopened.listOutbox(firstContext);
  const deletion = operations.find((entry) => entry.action === "delete");

  assert.equal(operations.length, queue.length + 1);
  assert.equal(deletion?.entityType, "product");
  assert.deepEqual(deletion.dependsOn, [before?.latestOperationId]);
  await assert.rejects(reopened.saveProduct(firstContext, "delete-me", {
    name: "Scrittura tardiva",
  }), LocalInputError);
  await assert.rejects(reopened.duplicateProduct(firstContext, "delete-me"), LocalInputError);
  assert.deepEqual(await reopened.listStandPreferences(firstContext), []);
});

void test("eliminare input parziali non accoda dati invalidi e i tombstone liberano lo stand con dipendenze", async (context) => {
  const { repository } = await fixture(context);

  await repository.saveProduct(firstContext, "partial-remove", {
    name: "Parziale",
  });
  await repository.deleteProduct(firstContext, "partial-remove");
  assert.equal(typeof (await repository.getProduct(firstContext, "partial-remove"))?.deletedAt, "string");
  assert.deepEqual(await repository.listOutbox(firstContext), []);
  await assert.rejects(repository.saveProduct(firstContext, "partial-remove", productInput(firstContext)), LocalInputError);
  await repository.savePersonalStand(firstContext, "owned-stand", {
    name: "Stand personale",
  });
  await repository.saveProduct(firstContext, "owned-product", {
    ...productInput(firstContext),
    standRef: {
      source: "personal",
      eventId: firstContext.eventId,
      standId: "owned-stand",
    },
  });
  await assert.rejects(repository.deletePersonalStand(firstContext, "owned-stand"), LocalInputError);
  await repository.deleteProduct(firstContext, "owned-product");
  await repository.deletePersonalStand(firstContext, "owned-stand");
  const operations = await repository.listOutbox(firstContext);
  const productDeletion = operations.find((entry) => entry.entityType === "product" && entry.action === "delete");
  const standDeletion = operations.find((entry) => entry.entityType === "personal-stand" && entry.action === "delete");

  assert.ok(productDeletion);
  assert.ok(standDeletion?.dependsOn.includes(productDeletion.operationId) === true);
  assert.deepEqual((await repository.getVisitData(firstContext)).personalStands, []);
});
