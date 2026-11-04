import assert from "node:assert/strict";
import test from "node:test";

import { productCategories } from "../../src/features/products/product-categories";

import type { Category } from "../../src/types/catalog";

const categories: Category[] = [
  {
    id: "equipment",
    name: "Attrezzatura",
  },
  {
    id: "bags",
    name: "Borse",
    parentId: "equipment",
  },
  {
    id: "lights",
    name: "Illuminazione",
    parentId: "equipment",
  },
];

void test("le categorie prodotto seguono gli ID dello stand mantenendo l’ordine del catalogo", () => {
  assert.deepEqual(productCategories(categories, ["bags", "equipment"])
    .map((category) => category.id), ["equipment", "bags"]);
  assert.deepEqual(productCategories(categories, ["lights"]).map((category) => category.id), ["lights"]);
  assert.deepEqual(productCategories(categories, ["equipment"]).map((category) => category.id), ["equipment"]);
});

void test("senza stand o senza associazioni si possono scegliere tutte le categorie", () => {
  assert.deepEqual(productCategories(categories), categories);
  assert.deepEqual(productCategories(categories, []), categories);
});

void test("ID duplicati o rimossi non introducono categorie estranee né modificano il catalogo", () => {
  const original = structuredClone(categories);

  assert.deepEqual(productCategories(categories, [
    "bags", "bags", "missing",
  ])
    .map((category) => category.id), ["bags"]);
  assert.deepEqual(productCategories(categories, ["missing"]), []);
  assert.deepEqual(categories, original);
});
