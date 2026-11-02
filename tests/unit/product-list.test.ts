import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  defaultProductFilters, filterProductList, productFiltersQuery, readProductFilters, resolveProductList,
} from "../../src/features/products/product-list";
import { loadCatalog } from "../../src/lib/config/load-catalog";

import type { ProductListItem } from "../../src/features/products/product-list";
import type { LocalProduct } from "../../src/types/offline";

const scope = {
  profileId: "me",
  eventId: "fiera-demo-2026",
};

void test("raccolta unica isola i contesti, risolve stand e pianificati senza doppioni e ignora tombstone", async () => {
  const catalog = await loadCatalog(path.join(process.cwd(), "tests/fixtures/catalog"));
  const plan = catalog.plannedProducts.find((entry) => entry.profileId === scope.profileId);

  assert.ok(plan);
  const data = {
    ...scope,
    id: `planned:${plan.id}`,
    name: "Nome personale",
    categoryId: plan.categoryId,
    standRef: plan.standRef,
    description: "",
    createdAt: "2026-11-02T10:00:00Z",
    updatedAt: "2026-11-02T10:00:00Z",
  };
  const record: LocalProduct = {
    ...scope,
    id: data.id,
    input: data,
    lastValid: data,
    issues: {},
    localSequence: 1,
    serverRevision: null,
    latestOperationId: null,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
  const items = resolveProductList(catalog, scope, [
    record, {
      ...record,
      profileId: "father",
      id: "foreign",
    },
  ], []);

  assert.equal(items.filter((item) => item.id === record.id).length, 1);
  assert.equal(items.some((item) => item.plannedId === plan.id), false);
  assert.equal(items.some((item) => item.id === "foreign"), false);
  assert.equal(
    items.find((item) => item.id === record.id)?.standName,
    catalog.stands.find((stand) => stand.id === plan.standRef.standId)?.name,
  );
  const deleted = resolveProductList(catalog, scope, [
    {
      ...record,
      deletedAt: data.updatedAt,
    },
  ], []);

  assert.equal(deleted.some((item) => item.id === record.id), false);
  assert.equal(deleted.some((item) => item.plannedId === plan.id), true);
  const associated = {
    ...record,
    id: "new-registration",
    input: {
      ...record.input,
      plannedProductId: plan.id,
    },
  };

  assert.equal(resolveProductList(catalog, scope, [associated], []).some((item) => item.plannedId === plan.id), false);
});

function makeItem(id: string, patch: Partial<ProductListItem>): ProductListItem {
  return {
    id,
    plannedId: null,
    kind: "registered",
    name: id,
    categoryId: "bags",
    categoryName: "Bórse",
    standRef: {
      source: "catalog",
      eventId: scope.eventId,
      standId: "same",
    },
    standName: "Caffè",
    price: null,
    rating: null,
    favorite: false,
    createdAt: "2026-11-02T10:00:00Z",
    hasPhotos: false,
    ...patch,
  };
}

void test("ricerca e filtri combinati distinguono zero e assenza e ordinano valori mancanti in fondo", () => {
  const items = [
    makeItem("zero", {
      price: 0,
      rating: 1,
      favorite: true,
      name: "Borsa città",
    }),
    makeItem("expensive", {
      price: 99.5,
      rating: 9,
      hasPhotos: true,
      createdAt: "2026-11-03T10:00:00Z",
    }),
    makeItem("missing", {}),
    makeItem("personal", {
      standRef: {
        source: "personal",
        eventId: scope.eventId,
        standId: "same",
      },
      kind: "planned",
    }),
  ];
  const defaults = defaultProductFilters();

  assert.deepEqual(filterProductList(items, {
    ...defaults,
    query: "citta caffe borse",
    favorites: true,
    minPrice: "0",
    maxPrice: "0",
    minRating: "1",
  }).map((entry) => entry.id), ["zero"]);
  assert.deepEqual(filterProductList(items, {
    ...defaults,
    photos: "with",
    minPrice: "90,00",
    minRating: "8",
  }).map((entry) => entry.id), ["expensive"]);
  assert.deepEqual(filterProductList(items, {
    ...defaults,
    stand: JSON.stringify(["personal", "same"]),
    status: "planned",
  }).map((entry) => entry.id), ["personal"]);
  assert.equal(filterProductList(items, defaults)[0]?.id, "expensive");
  assert.equal(filterProductList(items, {
    ...defaults,
    sort: "rating",
  })[0]?.id, "expensive");
  assert.equal(filterProductList(items, {
    ...defaults,
    sort: "price",
  })[1]?.id, "zero");
  assert.deepEqual(filterProductList(items, {
    ...defaults,
    minPrice: "20",
    maxPrice: "10",
  }), []);
  assert.deepEqual(filterProductList(items, {
    ...defaults,
    minRating: "11",
  }), []);
  const filters = {
    ...defaults,
    query: "città & café",
    minPrice: "0",
    favorites: true,
    sort: "price" as const,
  };
  const params = new URLSearchParams(productFiltersQuery(filters, scope));

  assert.deepEqual(readProductFilters(params, scope), filters);
  assert.deepEqual(readProductFilters(params, {
    ...scope,
    profileId: "father",
  }), defaults);
  assert.deepEqual(readProductFilters(params, {
    ...scope,
    eventId: "other",
  }), defaults);
});
