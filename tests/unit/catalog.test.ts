import assert from "node:assert/strict";
import {
  cp, mkdtemp, rm, symlink, writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { loadCatalog } from "../../src/lib/config/load-catalog";
import { ConfigValidationError } from "../../src/lib/config/validation";
import app from "../fixtures/catalog/app.json";
import categories from "../fixtures/catalog/categories.json";
import stands from "../fixtures/catalog/events/fiera-demo-2026-stands.json";
import interests from "../fixtures/catalog/interests/me.json";
import profiles from "../fixtures/catalog/profiles.json";
import questionnaires from "../fixtures/catalog/questionnaires/me.json";

import type { TestContext } from "node:test";

async function temporaryDirectory(context: TestContext) {
  const directory = await mkdtemp(path.join(tmpdir(), "expotrack-catalog-test-"));

  context.after(async () => {
    await rm(directory, {
      recursive: true,
      force: true,
    });
  });

  return directory;
}

async function fixture(context: TestContext) {
  const directory = await temporaryDirectory(context);

  await cp(path.join(process.cwd(), "tests/fixtures/catalog"), directory, {
    recursive: true,
  });

  return directory;
}

async function writeJson(directory: string, file: string, value: unknown) {
  await writeFile(path.join(directory, file), JSON.stringify(value), "utf8");
}

void test("il dataset carica catalogo condiviso e seed personali senza inventare dati", async (context) => {
  const snapshot = await loadCatalog(await fixture(context));
  const first = snapshot.interests.find((interest) => interest.profileId === "me");
  const second = snapshot.interests.find((interest) => {
    return interest.profileId === "father" && interest.standRef.standId === "demo-bags";
  });

  assert.ok(first);
  assert.ok(second);
  assert.deepEqual(first.standRef, second.standRef);
  assert.notEqual(first.priority, second.priority);
  assert.notDeepEqual(first.checklist, second.checklist);
  assert.equal(snapshot.interests.some((interest) => {
    return interest.profileId === "me" && interest.standRef.standId === "demo-lights";
  }), false);
  const unlocated = snapshot.stands.find((stand) => stand.id === "demo-lights");

  assert.ok(unlocated);
  assert.equal(unlocated.hall, undefined);
  assert.equal(unlocated.booth, undefined);
  const planned = snapshot.plannedProducts.find((product) => product.id === "demo-day-bag");

  assert.ok(planned);
  assert.equal(planned.profileId, "me");
  assert.deepEqual(planned.standRef, first.standRef);
  assert.equal(planned.categoryId, "bags");
  assert.equal(Object.hasOwn(planned, "rating"), false);
  assert.equal(Object.hasOwn(planned, "visitStatus"), false);
  assert.deepEqual(new Set(snapshot.questionnaires.find((entry) => entry.profileId === "me")
    ?.questions.map((question) => question.type)), new Set([
    "text", "number", "boolean", "single_choice", "multiple_choice", "rating_1_10",
  ]));
  assert.ok(snapshot.questionnaires.every((entry) => entry.version > 0 && entry.categoryId === "bags"));
  assert.notDeepEqual(snapshot.questionnaires[0].questions, snapshot.questionnaires[1].questions);
});

void test("riferimenti incoerenti e categorie cicliche vengono respinti con un percorso utile", async (context) => {
  const cases = [
    {
      name: "evento predefinito assente",
      file: "app.json",
      value: {
        ...app,
        app: {
          ...app.app,
          defaultEventId: "missing",
        },
      },
      location: /app\.json\.app\.defaultEventId/,
    },
    {
      name: "categoria padre assente",
      file: "categories.json",
      value: {
        ...categories,
        categories: [
          {
            id: "child",
            name: "Child",
            parentId: "missing",
          },
        ],
      },
      location: /categories\.json.*parentId/,
    },
    {
      name: "ciclo fra categorie",
      file: "categories.json",
      value: {
        ...categories,
        categories: [
          {
            id: "bags",
            name: "Borse",
            parentId: "lights",
          },
          {
            id: "lights",
            name: "Luci",
            parentId: "bags",
          },
        ],
      },
      location: /categories\.json.*parentId/,
    },
    {
      name: "categoria stand assente",
      file: "events/fiera-demo-2026-stands.json",
      value: {
        ...stands,
        stands: [
          {
            ...stands.stands[0],
            categories: ["missing"],
          },
        ],
      },
      location: /stands\.json.*categories/,
    },
    {
      name: "padiglione assente",
      file: "events/fiera-demo-2026-stands.json",
      value: {
        ...stands,
        stands: [
          {
            ...stands.stands[0],
            hall: "missing",
          },
        ],
      },
      location: /stands\.json.*hall/,
    },
    {
      name: "identità del file interessi incoerente",
      file: "interests/me.json",
      value: {
        ...interests,
        profileId: "father",
      },
      location: /interests\/me\.json\.profileId/,
    },
    {
      name: "evento inesistente anche con interessi vuoti",
      file: "interests/me.json",
      value: {
        ...interests,
        events: [
          {
            eventId: "missing",
            stands: [],
          },
        ],
      },
      location: /interests\/me\.json.*eventId/,
    },
    {
      name: "stand inesistente",
      file: "interests/me.json",
      value: {
        ...interests,
        events: [
          {
            eventId: "fiera-demo-2026",
            stands: [
              {
                standId: "missing",
              },
            ],
          },
        ],
      },
      location: /interests\/me\.json.*standId/,
    },
    {
      name: "categoria del pianificato assente",
      file: "interests/me.json",
      value: {
        ...interests,
        events: [
          {
            eventId: "fiera-demo-2026",
            stands: [
              {
                standId: "demo-bags",
                plannedProducts: [
                  {
                    id: "planned",
                    name: "Prova",
                    categoryId: "missing",
                  },
                ],
              },
            ],
          },
        ],
      },
      location: /interests\/me\.json.*categoryId/,
    },
    {
      name: "categoria questionario assente",
      file: "questionnaires/me.json",
      value: {
        ...questionnaires,
        questionnaires: [
          {
            ...questionnaires.questionnaires[0],
            categoryId: "missing",
          },
        ],
      },
      location: /questionnaires\/me\.json.*categoryId/,
    },
    {
      name: "categoria budget assente",
      file: "profiles.json",
      value: {
        ...profiles,
        profiles: [
          {
            ...profiles.profiles[0],
            budgets: [
              {
                categoryId: "missing",
                amount: 0,
                currency: "EUR",
              },
            ],
          },
        ],
      },
      location: /profiles\.json.*categoryId/,
    },
  ];

  for (const scenario of cases) {
    await context.test(scenario.name, async (subtest) => {
      const directory = await fixture(subtest);

      await writeJson(directory, scenario.file, scenario.value);
      await assert.rejects(loadCatalog(directory), (error: unknown) => {
        return error instanceof ConfigValidationError && scenario.location.test(error.message);
      });
    });
  }
});

void test("le chiavi di stand e padiglioni sono separate per evento", async (context) => {
  const directory = await fixture(context);

  await writeJson(directory, "app.json", {
    ...app,
    events: [
      ...app.events, {
        id: "second-demo",
        name: "Seconda fiera demo",
        enabled: true,
        standsFile: "events/second-demo.json",
      },
    ],
  });
  await writeJson(directory, "events/second-demo.json", {
    schemaVersion: 1,
    stands: [
      {
        id: "demo-bags",
        name: "Omonimo",
        categories: [],
      },
    ],
  });
  const snapshot = await loadCatalog(directory);

  assert.equal(snapshot.stands.filter((stand) => stand.id === "demo-bags").length, 2);
  await writeJson(directory, "events/second-demo.json", {
    schemaVersion: 1,
    stands: [
      {
        id: "demo-bags",
        name: "Omonimo",
        categories: [],
        hall: "demo-hall",
      },
    ],
  });
  await assert.rejects(loadCatalog(directory), /second-demo\.json.*hall/);
  await writeJson(directory, "events/second-demo.json", {
    schemaVersion: 1,
    stands: [],
  });
  await writeJson(directory, "interests/me.json", {
    ...interests,
    events: [
      {
        eventId: "second-demo",
        stands: [
          {
            standId: "demo-bags",
          },
        ],
      },
    ],
  });
  await assert.rejects(loadCatalog(directory), /interests\/me\.json.*standId/);
});

void test("schema, duplicati e vincoli numerici non vengono corretti o convertiti silenziosamente", async (context) => {
  const question = questionnaires.questionnaires[0].questions[0];
  const cases = [
    {
      file: "app.json",
      value: {
        ...app,
        schemaVersion: 2,
      },
    },
    {
      file: "app.json",
      value: {
        ...app,
        currentProfileId: "me",
      },
    },
    {
      file: "profiles.json",
      value: {
        ...profiles,
        profiles: [profiles.profiles[0], profiles.profiles[0]],
      },
    },
    {
      file: "profiles.json",
      value: {
        ...profiles,
        profiles: [
          {
            ...profiles.profiles[0],
            enabled: "true",
          },
        ],
      },
    },
    {
      file: "profiles.json",
      value: {
        ...profiles,
        profiles: [
          {
            ...profiles.profiles[0],
            budgets: [
              {
                categoryId: "bags",
                amount: 0.001,
                currency: "EUR",
              },
            ],
          },
        ],
      },
    },
    {
      file: "categories.json",
      value: {
        ...categories,
        categories: [
          {
            id: "Bad ID",
            name: "Prova",
          },
        ],
      },
    },
    {
      file: "categories.json",
      value: {
        ...categories,
        categories: [categories.categories[0], categories.categories[0]],
      },
    },
    {
      file: "interests/me.json",
      value: {
        ...interests,
        events: [
          {
            eventId: "fiera-demo-2026",
            stands: [
              {
                standId: "demo-bags",
                priority: 0,
              },
            ],
          },
        ],
      },
    },
    {
      file: "interests/me.json",
      value: {
        ...interests,
        events: [
          {
            eventId: "fiera-demo-2026",
            stands: [
              {
                standId: "demo-bags",
                priority: 1.5,
              },
            ],
          },
        ],
      },
    },
    {
      file: "interests/me.json",
      value: {
        ...interests,
        events: [
          {
            eventId: "fiera-demo-2026",
            stands: [
              {
                standId: "demo-bags",
                whatToSee: [
                  {
                    id: "check",
                    text: "  ",
                  },
                ],
              },
            ],
          },
        ],
      },
    },
    {
      file: "interests/me.json",
      value: {
        ...interests,
        events: [
          {
            eventId: "fiera-demo-2026",
            stands: [
              {
                standId: "demo-bags",
                whatToSee: [
                  {
                    id: "check",
                    text: "A",
                  }, {
                    id: "check",
                    text: "B",
                  },
                ],
              },
            ],
          },
        ],
      },
    },
    {
      file: "interests/me.json",
      value: {
        ...interests,
        events: [
          {
            eventId: "fiera-demo-2026",
            stands: [
              {
                standId: "demo-bags",
                plannedProducts: [
                  {
                    id: "planned",
                    name: "A",
                    categoryId: "bags",
                  }, {
                    id: "planned",
                    name: "B",
                    categoryId: "bags",
                  },
                ],
              },
            ],
          },
        ],
      },
    },
    {
      file: "questionnaires/me.json",
      value: {
        ...questionnaires,
        profileId: "father",
      },
    },
    {
      file: "questionnaires/me.json",
      value: {
        ...questionnaires,
        questionnaires: [
          {
            ...questionnaires.questionnaires[0],
            version: 0,
          },
        ],
      },
    },
    {
      file: "questionnaires/me.json",
      value: {
        ...questionnaires,
        questionnaires: [
          questionnaires.questionnaires[0], {
            ...questionnaires.questionnaires[0],
            id: "other",
          },
        ],
      },
    },
    ...[
      {
        ...question,
        required: false,
      },
      {
        ...question,
        type: "unknown",
      },
      {
        ...question,
        type: "boolean",
        min: 0,
      },
      {
        ...question,
        type: "number",
        min: 2,
        max: 1,
      },
      {
        ...question,
        type: "number",
        step: 0,
      },
      {
        ...question,
        type: "number",
        min: "1",
      },
      {
        ...question,
        type: "single_choice",
        options: [
          {
            id: "same",
            label: "A",
          }, {
            id: "same",
            label: "B",
          },
        ],
      },
    ].map((invalidQuestion) => ({
      file: "questionnaires/me.json",
      value: {
        ...questionnaires,
        questionnaires: [
          {
            ...questionnaires.questionnaires[0],
            questions: [invalidQuestion],
          },
        ],
      },
    })),
  ];

  for (const [index, scenario] of cases.entries()) {
    await context.test(`${scenario.file}, caso ${index + 1}`, async (subtest) => {
      const directory = await fixture(subtest);

      await writeJson(directory, scenario.file, scenario.value);
      await assert.rejects(loadCatalog(directory), ConfigValidationError);
    });
  }
});

void test("identità checklist e pianificati restano stabili dopo rinomina e rilettura", async (context) => {
  const directory = await fixture(context);
  const before = await loadCatalog(directory);
  const entry = interests.events[0].stands[0];
  const longDescription = "Testo dimostrativo. ".repeat(1000);

  await writeJson(directory, "interests/me.json", {
    ...interests,
    events: [
      {
        ...interests.events[0],
        stands: [
          {
            ...entry,
            whatToSee: entry.whatToSee.map((item) => ({
              ...item,
              text: "Testo rinominato",
            })),
            plannedProducts: entry.plannedProducts.map((item) => ({
              ...item,
              name: "Nuovo nome",
              description: longDescription,
            })),
          },
        ],
      },
    ],
  });
  const after = await loadCatalog(directory);

  assert.deepEqual(
    after.interests.map((interest) => interest.checklist.map((item) => item.id)),
    before.interests.map((interest) => interest.checklist.map((item) => item.id)),
  );
  assert.deepEqual(after.plannedProducts.map((item) => item.id), before.plannedProducts.map((item) => item.id));
  assert.equal(after.plannedProducts[0].description, longDescription);
});

void test("seed opzionali assenti non ereditano altri profili e rating viene normalizzato", async (context) => {
  const directory = await fixture(context);

  await rm(path.join(directory, "interests/father.json"));
  await rm(path.join(directory, "questionnaires/father.json"));
  await writeJson(directory, "questionnaires/me.json", {
    ...questionnaires,
    questionnaires: [
      {
        ...questionnaires.questionnaires[0],
        questions: [
          {
            id: "legacy",
            label: "Prova",
            type: "rating",
          },
        ],
      },
    ],
  });
  const snapshot = await loadCatalog(directory);

  assert.ok(snapshot.profiles.some((profile) => profile.id === "father"));
  assert.equal(snapshot.interests.some((interest) => interest.profileId === "father"), false);
  assert.equal(snapshot.questionnaires.some((entry) => entry.profileId === "father"), false);
  assert.equal(snapshot.questionnaires[0].questions[0].type, "rating_1_10");
  assert.equal(snapshot.questionnaires.some((entry) => entry.categoryId === "equipment"), false);
});

void test("lettura fallita, JSON malformato e percorsi esterni non producono snapshot parziali", async (context) => {
  const directory = await fixture(context);

  await writeFile(path.join(directory, "interests/me.json"), "{", "utf8");
  await assert.rejects(loadCatalog(directory), /interests\/me\.json/);
  await rm(path.join(directory, "interests/me.json"));
  await rm(path.join(directory, "categories.json"));
  await assert.rejects(loadCatalog(directory), /categories\.json/);
  await writeJson(directory, "app.json", {
    ...app,
    configFiles: {
      ...app.configFiles,
      profiles: "../outside.json",
    },
  });
  await assert.rejects(loadCatalog(directory), /outside\.json/);

  const outside = await temporaryDirectory(context);

  await writeJson(outside, "profiles.json", profiles);
  await writeJson(directory, "app.json", app);
  await writeJson(directory, "categories.json", categories);
  await rm(path.join(directory, "profiles.json"));
  await symlink(path.join(outside, "profiles.json"), path.join(directory, "profiles.json"));
  await assert.rejects(loadCatalog(directory), /profiles\.json/);
});
