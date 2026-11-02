import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  defaultStandFilters, filterStandList, readStandFilters, resolveStandList, selectDashboard, standFiltersQuery,
} from "../../src/features/stands/stand-list";
import { loadCatalog } from "../../src/lib/config/load-catalog";

import type { LocalStandPreferences, ProductData } from "../../src/types/offline";

const scope = {
  profileId: "me",
  eventId: "fiera-demo-2026",
};

void test("lista stand: interessi per profilo, override espliciti e precedenza per campo senza mutare i seed", async () => {
  const catalog = await loadCatalog(path.join(process.cwd(), "tests/fixtures/catalog"));
  const before = structuredClone(catalog);
  const defaults = defaultStandFilters();
  const me = resolveStandList(catalog, scope, []);
  const father = resolveStandList(catalog, {
    ...scope,
    profileId: "father",
  }, []);

  assert.deepEqual(filterStandList(me, defaults).map((entry) => entry.id), ["demo-bags"]);
  assert.deepEqual(filterStandList(father, defaults).map((entry) => entry.id), ["demo-lights", "demo-bags"]);
  assert.equal(me.find((entry) => entry.id === "demo-lights")?.priority, null);
  assert.equal(me.find((entry) => entry.id === "demo-lights")?.location, "Posizione non disponibile");
  const override: LocalStandPreferences = {
    ...scope,
    standRef: {
      source: "catalog",
      eventId: scope.eventId,
      standId: "demo-bags",
    },
    interested: false,
    visitStatus: "visited",
    priority: null,
    localSequence: 1,
    latestOperationId: "test-operation",
    serverRevision: null,
    updatedAt: "2026-10-29T00:00:00.000Z",
  };
  const overridden = resolveStandList(catalog, scope, [
    override, {
      ...override,
      profileId: "father",
      interested: true,
    },
  ]);

  assert.equal(filterStandList(overridden, defaults).length, 0);
  assert.equal(overridden.find((entry) => entry.id === "demo-bags")?.visitStatus, "visited");
  assert.equal(overridden.find((entry) => entry.id === "demo-bags")?.priority, null);
  assert.deepEqual(catalog, before);
});

void test("ricerca senza accenti, filtri combinati, azzeramento e ordinamento deterministico", async () => {
  const catalog = await loadCatalog(path.join(process.cwd(), "tests/fixtures/catalog"));

  catalog.stands[0].name = "Caffè Élite";
  const items = resolveStandList(catalog, scope, []);
  const defaults = defaultStandFilters();
  const all = {
    ...defaults,
    interest: "all" as const,
  };

  assert.equal(filterStandList(items, {
    ...all,
    query: "CAFFE elite",
  }).length, 1);
  assert.equal(filterStandList(items, {
    ...all,
    query: "illuminazione",
  })[0]?.id, "demo-lights");
  assert.equal(filterStandList(items, {
    ...all,
    query: "DIMOSTRATIVO demo-01",
  })[0]?.id, "demo-bags");
  assert.deepEqual(filterStandList(items, {
    ...all,
    category: "bags",
    pavilion: "demo-hall",
    status: "to_visit",
    priority: "9",
    query: "caffe",
  }).map((entry) => entry.id), ["demo-bags"]);
  assert.equal(filterStandList(items, {
    ...all,
    category: "lights",
    priority: "9",
  }).length, 0);
  assert.equal(filterStandList(items, {
    ...all,
    pavilion: "missing",
    priority: "none",
  })[0]?.id, "demo-lights");
  assert.equal(filterStandList(items, {
    ...all,
    status: "visited",
  }).length, 0);
  assert.equal(filterStandList(items, {
    ...all,
    interest: "excluded",
  })[0]?.id, "demo-lights");
  assert.deepEqual(filterStandList(items, defaultStandFilters()).map((entry) => entry.id), ["demo-bags"]);
  const tied = [
    {
      ...items[0],
      id: "z",
      name: "Uguale",
      priority: 4,
    },
    {
      ...items[0],
      id: "a",
      name: "Uguale",
      priority: 4,
    },
    {
      ...items[0],
      id: "b",
      name: "Alfa",
      priority: 4,
    },
    {
      ...items[0],
      id: "c",
      name: "Alta",
      priority: 10,
    },
    {
      ...items[0],
      id: "d",
      name: "Assente",
      priority: null,
    },
  ];

  assert.deepEqual(filterStandList(tied, all).map((entry) => entry.id), [
    "c", "b", "a", "z", "d",
  ]);
  const filters = {
    ...all,
    query: "caffè",
    category: "bags",
    sort: "name" as const,
  };

  assert.deepEqual(readStandFilters(new URLSearchParams(standFiltersQuery(filters, scope)), scope), filters);
  assert.deepEqual(readStandFilters(new URLSearchParams(standFiltersQuery(filters, scope)), {
    ...scope,
    profileId: "father",
  }), defaults);
  assert.deepEqual(readStandFilters(new URLSearchParams(), scope), defaults);
});

void test("dashboard: conteggi disgiunti sugli interessi, prodotti del contesto e prime cinque priorità deterministiche", async () => {
  const catalog = await loadCatalog(path.join(process.cwd(), "tests/fixtures/catalog"));
  const [base] = resolveStandList(catalog, scope, []);
  const cases = [
    {
      id: "visited",
      name: "Visitato",
      visitStatus: "visited" as const,
      priority: 10,
    },
    {
      id: "none",
      name: "Senza priorità",
      visitStatus: "to_visit" as const,
      priority: null,
    },
    {
      id: "z",
      name: "Uguale",
      visitStatus: "to_visit" as const,
      priority: 9,
    },
    {
      id: "a",
      name: "Uguale",
      visitStatus: "to_revisit" as const,
      priority: 9,
    },
    {
      id: "top",
      name: "Primo",
      visitStatus: "to_visit" as const,
      priority: 10,
    },
    {
      id: "four",
      name: "Quarto",
      visitStatus: "to_visit" as const,
      priority: 8,
    },
    {
      id: "five",
      name: "Quinto",
      visitStatus: "to_revisit" as const,
      priority: 7,
    },
    {
      id: "six",
      name: "Sesto",
      visitStatus: "to_visit" as const,
      priority: 6,
    },
  ];
  const items = cases.map((entry) => ({
    ...base,
    ...entry,
    interested: true,
  }));

  items.push({
    ...base,
    id: "excluded",
    name: "Escluso",
    interested: false,
    priority: 10,
  });
  const product: ProductData = {
    ...scope,
    id: "valid",
    name: "Registrato",
    categoryId: "bags",
    description: "",
    standRef: {
      source: "catalog",
      eventId: scope.eventId,
      standId: "demo-bags",
    },
    createdAt: "2026-11-02T00:00:00Z",
    updatedAt: "2026-11-02T00:00:00Z",
  };
  const summary = selectDashboard(items, [
    product,
    {
      ...product,
      id: "father",
      profileId: "father",
    },
    {
      ...product,
      id: "other-event",
      eventId: "another",
    },
  ], scope);

  assert.deepEqual(summary.counts, {
    to_visit: 5,
    visited: 1,
    to_revisit: 2,
  });
  assert.equal(summary.products, 1);
  assert.deepEqual(summary.priorities.map((stand) => stand.id), [
    "top", "a", "z", "four", "five",
  ]);
  for (const status of [
    "to_visit", "visited", "to_revisit",
  ] as const) {
    const filters = {
      ...defaultStandFilters(),
      status,
    };
    const restored = readStandFilters(new URLSearchParams(standFiltersQuery(filters, scope)), scope);

    assert.equal(filterStandList(items, restored).length, summary.counts[status]);
  }
});

void test("dashboard: vuoto, meno di cinque candidati, profilo/evento diversi e nessun conteggio dei pianificati", async () => {
  const catalog = await loadCatalog(path.join(process.cwd(), "tests/fixtures/catalog"));
  const me = selectDashboard(resolveStandList(catalog, scope, []), [], scope);
  const fatherScope = {
    ...scope,
    profileId: "father",
  };
  const father = selectDashboard(resolveStandList(catalog, fatherScope, []), [], fatherScope);
  const otherScope = {
    ...scope,
    eventId: "missing-event",
  };
  const other = selectDashboard(resolveStandList(catalog, otherScope, []), [], otherScope);

  assert.equal(me.counts.to_visit, 1);
  assert.equal(me.priorities.length, 1);
  assert.equal(me.products, 0);
  assert.equal(father.counts.to_visit, 2);
  assert.equal(father.priorities.length, 2);
  assert.deepEqual(other.counts, {
    to_visit: 0,
    visited: 0,
    to_revisit: 0,
  });
  assert.deepEqual(other.priorities, []);
});
