import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";
import test from "node:test";

import { IDBFactory, IDBObjectStore } from "fake-indexeddb";

import { filterProductList, defaultProductFilters, resolveProductList } from "../../src/features/products/product-list";
import { loadCatalog } from "../../src/lib/config/load-catalog";
import { inTransaction, openLocalDatabase, readRequest } from "../../src/lib/offline/database";
import { hashPhoto } from "../../src/lib/offline/photo-hash";
import { inspectPhoto } from "../../src/lib/offline/photo-input";
import { openLocalRepository } from "../../src/lib/offline/repository";

import type { LocalRepository } from "../../src/lib/offline/repository";
import type { ProductInput } from "../../src/types/offline";
import type { PreparedPhoto } from "../../src/types/photos";
import type { TestContext } from "node:test";

const bytes = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3ioAAAAASUVORK5CYII=", "base64"));
const photo: PreparedPhoto = {
  filename: "test.png",
  contentType: "image/png",
  byteSize: bytes.length,
  sha256: createHash("sha256").update(bytes).digest("hex"),
  width: 1,
  height: 1,
  original: new Blob([bytes], {
    type: "image/png",
  }),
  thumbnail: new Blob([bytes], {
    type: "image/png",
  }),
  preview: new Blob([bytes], {
    type: "image/png",
  }),
};
const input: ProductInput = {
  name: "Foto di prova",
  categoryId: "bags",
  description: "",
  standRef: {
    source: "catalog",
    eventId: "fiera-demo-2026",
    standId: "demo-bags",
  },
};
const scope = {
  profileId: "me",
  eventId: "fiera-demo-2026",
};

async function fixture(context: TestContext) {
  const catalog = await loadCatalog(path.join(process.cwd(), "tests/fixtures/catalog"));
  const factory = new IDBFactory();
  const name = `expotrack-test-photos-${crypto.randomUUID()}`;
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
    repository,
    catalog,
    connect,
    name,
    factory,
  };
}

void test("originali con prodotto incompleto, riapertura, dipendenze e isolamento", async (context) => {
  const { repository, catalog, connect } = await fixture(context);
  const partial = {
    ...input,
    name: "",
    categoryId: null,
  };

  await repository.addProductPhoto(scope, "partial", "photo-a", photo, partial);
  assert.equal((await repository.getProduct(scope, "partial"))?.lastValid, null);
  assert.deepEqual(await repository.listOutbox(scope), []);
  const reopened = await connect();
  const asset = await reopened.getPhotoAsset(scope, "photo-a");

  assert.ok(asset);
  assert.deepEqual(new Uint8Array(await asset.original.arrayBuffer()), bytes);
  assert.equal(createHash("sha256").update(new Uint8Array(await asset.original.arrayBuffer())).digest("hex"), photo.sha256);
  assert.equal((await reopened.listProductPhotos(scope, "partial")).length, 1);
  assert.equal(await reopened.getPhotoAsset({
    ...scope,
    profileId: "father",
  }, "photo-a"), undefined);
  assert.equal(await reopened.getPhotoAsset({
    ...scope,
    eventId: "other-event",
  }, "photo-a"), undefined);
  const registered = await reopened.saveProduct(scope, "partial", input);
  const queue = await reopened.listOutbox(scope);
  const photoOperation = queue.find((entry) => entry.entityType === "photo");

  assert.ok(photoOperation);
  assert.ok(registered.latestOperationId !== null);
  assert.ok(photoOperation.dependsOn.includes(registered.latestOperationId));
  assert.equal(photoOperation.payload.productId, "partial");
  await reopened.addProductPhoto(scope, "partial", "photo-a", photo, input);
  assert.deepEqual(await reopened.listOutbox(scope), queue);
  await assert.rejects(reopened.addProductPhoto(scope, "partial", "photo-a", {
    ...photo,
    sha256: "0".repeat(64),
  }, input));
  const listed = resolveProductList(
    catalog,
    scope,
    await reopened.listProducts(scope),
    [],
    await reopened.listPhotos(scope),
  );

  assert.equal(listed.find((entry) => entry.id === "partial")?.primaryPhotoId, "photo-a");
  assert.equal(filterProductList(listed, {
    ...defaultProductFilters(),
    photos: "with",
  }).length, 1);
  const copy = await reopened.duplicateProduct(scope, "partial");

  assert.deepEqual(await reopened.listProductPhotos(scope, copy.id), []);
});

void test("principale e delete atomici, sostituzione e asset pendenti preservati dalla pulizia", async (context) => {
  const {
    repository, connect, name, factory,
  } = await fixture(context);

  await repository.addProductPhoto(scope, "parent", "first", photo, input);
  await repository.addProductPhoto(scope, "parent", "second", photo, input);
  await repository.changeProductPhoto(scope, "parent", "second", "primary");
  const reopened = await connect();

  assert.equal((await reopened.listProductPhotos(scope, "parent")).find((entry) => entry.isPrimary)?.id, "second");
  const before = await reopened.listPhotos(scope);
  const queue = await reopened.listOutbox(scope);
  const add = Reflect.get(IDBObjectStore.prototype, "add");
  const mocked = context.mock.method(IDBObjectStore.prototype, "add", function(this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
    if (this.name === "outbox") {
      throw new DOMException("Quota", "QuotaExceededError");
    }

    return add.call(this, value, key);
  });

  await assert.rejects(reopened.changeProductPhoto(scope, "parent", "second", "delete"));
  mocked.mock.restore();
  assert.deepEqual(await reopened.listPhotos(scope), before);
  assert.deepEqual(await reopened.listOutbox(scope), queue);
  await reopened.changeProductPhoto(scope, "parent", "second", "delete");
  assert.equal((await reopened.listProductPhotos(scope, "parent")).find((entry) => entry.isPrimary)?.id, "first");
  await reopened.deleteProduct(scope, "parent");
  assert.deepEqual(await reopened.listProductPhotos(scope, "parent"), []);
  assert.equal((await reopened.listPhotos(scope)).every((entry) => entry.deletedAt !== null), true);
  await assert.rejects(reopened.addProductPhoto(scope, "parent", "late", photo, input));
  const after = await reopened.listOutbox(scope);
  const deletion = after.find((entry) => entry.entityType === "product" && entry.action === "delete");

  assert.ok(deletion);
  assert.ok(after.filter((entry) => entry.entityType === "photo" && entry.action === "delete")
    .every((entry) => deletion.dependsOn.includes(entry.operationId)));
  const database = await openLocalDatabase({
    name,
    factory,
  });

  await inTransaction(database, ["photos", "photo_assets"], "readwrite", (transaction) => {
    // Simulate metadata cleanup: the pending payload alone must still protect its original.
    transaction.objectStore("photos").delete([
      scope.profileId, scope.eventId, "second",
    ]);
    transaction.objectStore("photo_assets").put({
      ...photo,
      ...scope,
      id: "orphan",
      productId: "unused",
    });
  });
  database.close();
  assert.equal(await reopened.collectPhotoOrphans(), 1);
  assert.ok(await reopened.getPhotoAsset(scope, "first"));
  assert.ok(await reopened.getPhotoAsset(scope, "second"));
});

void test("quota senza falso successo, retry e pulizia foto mai accodate, formati e dimensioni", async (context) => {
  const { repository } = await fixture(context);

  for (const text of [
    "", "abc", "Foto con accenti è e più blocchi. ".repeat(100),
  ]) {
    const buffer = new TextEncoder().encode(text).buffer;

    assert.equal(await hashPhoto(buffer, null), createHash("sha256").update(text).digest("hex"));
  }
  assert.deepEqual(inspectPhoto(bytes), {
    contentType: "image/png",
    width: 1,
    height: 1,
  });
  assert.throws(() => inspectPhoto(new TextEncoder().encode("<svg></svg>")));
  const oversized = bytes.slice();

  new DataView(oversized.buffer).setUint32(16, 20001);
  assert.throws(() => inspectPhoto(oversized));
  const add = Reflect.get(IDBObjectStore.prototype, "add");
  const mocked = context.mock.method(IDBObjectStore.prototype, "add", function(this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
    if (this.name === "outbox" && typeof value === "object" && value !== null
      && "entityType" in value && value.entityType === "photo") {
      throw new DOMException("Quota", "QuotaExceededError");
    }

    return add.call(this, value, key);
  });

  await assert.rejects(repository.addProductPhoto(scope, "rollback", "failed", photo, input));
  mocked.mock.restore();
  assert.equal(await repository.getProduct(scope, "rollback"), undefined);
  assert.equal(await repository.getPhotoAsset(scope, "failed"), undefined);
  assert.deepEqual(await repository.listPhotos(scope), []);
  assert.deepEqual(await repository.listOutbox(scope), []);
  await repository.addProductPhoto(scope, "rollback", "failed", photo, input);
  assert.equal((await repository.listProductPhotos(scope, "rollback")).length, 1);
  await repository.addProductPhoto(scope, "incomplete", "unreferenced", photo, {
    ...input,
    name: "",
  });
  await repository.changeProductPhoto(scope, "incomplete", "unreferenced", "delete");
  assert.equal(await repository.getPhotoAsset(scope, "unreferenced"), undefined);
});
