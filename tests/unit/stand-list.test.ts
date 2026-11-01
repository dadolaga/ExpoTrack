import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  defaultStandFilters, filterStandList, readStandFilters, resolveStandList, standFiltersQuery,
} from "../../src/features/stands/stand-list";
import { loadCatalog } from "../../src/lib/config/load-catalog";

import type { LocalStandPreferences } from "../../src/types/offline";

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
