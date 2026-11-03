import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import sharp from "sharp";

import { openLocalRepository } from "../../src/lib/offline/repository";
import { SyncEngine } from "../../src/lib/sync/engine";
import { recoverAsNew } from "../../src/lib/sync/recovery";

import { syncFixture } from "./fixture";

import type { CatalogSnapshot } from "../../src/types/catalog";
import type { LocalContext, OutboxOperation } from "../../src/types/offline";
import type { PreparedPhoto } from "../../src/types/photos";
import type { TestContext } from "node:test";

const scope: LocalContext = {
  profileId: "me",
  eventId: "fiera-demo-2026",
};
const input = {
  name: "Prodotto in fiera",
  categoryId: "bags",
  description: "Nota completa",
  price: "0",
  rating: 8,
  standRef: {
    source: "catalog" as const,
    eventId: scope.eventId,
    standId: "demo-bags",
  },
};

async function device(context: TestContext, catalog: CatalogSnapshot) {
  const repository = await openLocalRepository({
    name: crypto.randomUUID(),
    factory: new IDBFactory(),
  });

  context.after(() => {
    repository.close();
  });
  await repository.initializeProfileSession(catalog);
  await repository.selectProfile("me");

  return repository;
}

async function photo(): Promise<PreparedPhoto> {
  const bytes = await sharp({
    create: {
      width: 8,
      height: 6,
      channels: 3,
      background: "#197f9e",
    },
  }).png().toBuffer();
  const original = new Blob([new Uint8Array(bytes)], {
    type: "image/png",
  });

  return {
    filename: "originale.png",
    contentType: "image/png",
    byteSize: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    width: 8,
    height: 6,
    original,
    preview: original,
    thumbnail: original,
  };
}

void test("giornata in fiera: perdita risposta, ripresa, tutti i dati e originali da un secondo dispositivo", async (context) => {
  const fixture = await syncFixture(context);
  const first = await device(context, fixture.catalog);
  const bytes = await photo();
  const questionnaire = fixture.catalog.questionnaires.find((entry) => entry.profileId === "me");

  assert.ok(questionnaire);
  await first.saveProduct(scope, "field-product", {
    ...input,
    questionnaireInputs: [
      {
        definitionSnapshot: questionnaire,
        answers: {
          waterproof: false,
          capacity_litres: "0",
        },
      },
    ],
  });
  await first.saveStandPreferences(scope, "demo-bags", {
    interested: false,
    notes: "Note raccolte senza rete",
    checklistChange: {
      id: "check-capacity",
      checked: true,
    },
  });
  await first.setBudget("me", "bags", "0");
  await first.addProductPhoto(scope, "field-product", "field-photo", bytes, input);
  const queuedIds = (await first.listPendingOperations()).map((entry) => entry.operationId).sort();
  let loseResponse = true;
  const unstable: typeof fetch = async function(this: unknown, url, init) {
    assert.equal(this, undefined);
    const response = await fixture.request(url, init);

    if ((url instanceof Request ? url.url : String(url)) === "/api/v1/sync/push" && loseResponse) {
      loseResponse = false;

      throw new TypeError("Risposta persa dopo commit server");
    }

    return response;
  };
  const interrupted = new SyncEngine(first, unstable);

  await interrupted.run();
  assert.equal(interrupted.snapshot().phase, "error");
  assert.equal(loseResponse, false);
  assert.ok((await first.listPendingOperations()).length > 0);
  const resumed = new SyncEngine(first, fixture.request);

  await resumed.run();
  assert.equal(resumed.snapshot().phase, "idle");
  assert.equal((await first.listPendingOperations()).length, 0);
  const second = await device(context, fixture.catalog);
  const home = new SyncEngine(second, fixture.request);

  await home.run();
  assert.equal(home.snapshot().phase, "idle");
  const restored = await second.getProduct(scope, "field-product");

  assert.ok(restored?.lastValid);
  assert.equal(restored.lastValid.price, 0);
  assert.equal(restored.lastValid.rating, 8);
  assert.equal(restored.lastValid.description, input.description);
  assert.equal(restored.lastValid.questionnaireAnswers?.[0].answers.waterproof, false);
  assert.equal((await second.listStandPreferences(scope))[0].notes, "Note raccolte senza rete");
  assert.equal((await second.listStandPreferences(scope))[0].interested, false);
  assert.equal((await second.listBudgetOverrides())[0].amount, 0);
  const downloaded = await second.getPhotoAsset(scope, "field-photo");

  assert.ok(downloaded);
  const restoredBytes = Buffer.from(await downloaded.original.arrayBuffer());
  const originalBytes = Buffer.from(await bytes.original.arrayBuffer());

  assert.deepEqual(restoredBytes, originalBytes);
  assert.equal(home.snapshot().summary.missingPhotos, 0);
  const operations = await fixture.pool.query("SELECT operation_id FROM server_operations");

  assert.deepEqual(operations.rows.map((entry: {
    operation_id: string;
  }) => entry.operation_id).sort(), queuedIds);
  assert.equal((await fixture.repository.collection("father", scope.eventId)).products.length, 0);
  const files = await readdir(path.join(fixture.directory, "media"));

  assert.equal(files.filter((file) => file.startsWith(".upload-")).length, 0);
  assert.equal(files.length, 1);
});

void test("LWW, ID riusato, scritture durante pull/ack e rollback locale prima del cursore", async (context) => {
  const fixture = await syncFixture(context);
  const first = await device(context, fixture.catalog);

  await first.saveProduct(scope, "shared", input);
  const create = (await first.listPendingOperations())[0];

  const receiptPut = Reflect.get(IDBObjectStore.prototype, "put");
  const receiptMock = context.mock.method(IDBObjectStore.prototype, "put", function(this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
    if (this.name === "sync_receipts") {
      throw new DOMException("Quota sulla conferma", "QuotaExceededError");
    }

    return receiptPut.call(this, value, key);
  });
  const interruptedAck = new SyncEngine(first, fixture.request);

  await interruptedAck.run();
  receiptMock.mock.restore();
  assert.equal(interruptedAck.snapshot().phase, "error");
  assert.equal((await first.listPendingOperations()).length, 1);
  assert.equal((await first.getProduct(scope, "shared"))?.serverRevision, null);
  await new SyncEngine(first, fixture.request).run();
  const altered: OutboxOperation = {
    ...create,
    payload: {
      ...create.payload,
      description: "ID riusato",
    },
  } as OutboxOperation;

  await assert.rejects(fixture.sync.push(altered), /operation_id_reused/u);
  const second = await device(context, fixture.catalog);

  await new SyncEngine(second, fixture.request).run();
  await first.saveProduct(scope, "shared", {
    description: "Primo dispositivo",
  });
  await second.saveProduct(scope, "shared", {
    description: "Secondo dispositivo",
  });
  await new SyncEngine(first, fixture.request).run();
  let editDuringAck = true;
  const concurrent: typeof fetch = async (url, init) => {
    const result = await fixture.request(url, init);

    if ((url instanceof Request ? url.url : String(url)) === "/api/v1/sync/push" && editDuringAck) {
      editDuringAck = false;
      await second.saveProduct(scope, "shared", {
        description: "Modifica durante conferma",
        name: "",
      });
    }

    return result;
  };

  await new SyncEngine(second, concurrent).run();
  assert.equal((await fixture.repository.collection("me", scope.eventId)).products[0].data.description, "Modifica durante conferma");
  assert.equal((await second.getProduct(scope, "shared"))?.input.name, "");
  const before = await first.sync.cursor();
  const page = await fixture.sync.pull(before);
  const originalPut = Reflect.get(IDBObjectStore.prototype, "put");
  const mock = context.mock.method(IDBObjectStore.prototype, "put", function(this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
    if (this.name === "app_meta" && typeof value === "object" && value !== null && "key" in value && value.key === "sync-state") {
      throw new DOMException("Quota", "QuotaExceededError");
    }

    return originalPut.call(this, value, key);
  });

  await assert.rejects(first.sync.applyPage(page));
  mock.mock.restore();
  assert.equal(await first.sync.cursor(), before);
  await first.sync.applyPage(page);
  assert.equal((await first.getProduct(scope, "shared"))?.lastValid?.description, "Modifica durante conferma");
  const missingOwner: OutboxOperation = {
    ...create,
    operationId: crypto.randomUUID(),
    entityId: "missing-owner",
    profileId: "usr-later",
    dependsOn: [],
    payload: {
      ...input,
      ...scope,
      id: "missing-owner",
      profileId: "usr-later",
      price: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  } as OutboxOperation;
  const rejectedOwner = await fixture.sync.push(missingOwner);

  assert.equal(rejectedOwner.status, "rejected");
  await first.savePersonalProfile("usr-later", {
    name: "Creato dopo il rifiuto",
    color: "#197F9E",
  });
  await new SyncEngine(first, fixture.request).run();
  assert.deepEqual(await fixture.sync.push(missingOwner), rejectedOwner);
  const expired: typeof fetch = async (url, init) => {
    if ((url instanceof Request ? url.url : String(url)).includes("cursor=") && (url instanceof Request ? url.url : String(url)).includes("pull")) {
      return Response.json({
        error: "cursor_expired",
      }, {
        status: 410,
      });
    }

    return fixture.request(url, init);
  };

  await new SyncEngine(first, expired).run();
  assert.equal((await first.getProduct(scope, "shared"))?.lastValid?.description, "Modifica durante conferma");
});

void test("tombstone protette: update offline respinto e recuperato con nuovo ID e allegati", async (context) => {
  const fixture = await syncFixture(context);
  const first = await device(context, fixture.catalog);
  const bytes = await photo();

  await first.saveProduct(scope, "deleted", input);
  await first.addProductPhoto(scope, "deleted", "retained-image", bytes, input);
  await new SyncEngine(first, fixture.request).run();
  const second = await device(context, fixture.catalog);

  await new SyncEngine(second, fixture.request).run();
  await second.saveProduct(scope, "deleted", {
    description: "Modifica offline da recuperare",
  });
  await first.deleteProduct(scope, "deleted");
  await new SyncEngine(first, fixture.request).run();
  const engine = new SyncEngine(second, fixture.request);

  await engine.run();
  const recoveries = (await second.sync.summary()).recoveries;

  assert.ok(recoveries.length > 0);
  assert.equal(typeof (await fixture.repository.collection("me", scope.eventId)).products[0].data.deletedAt, "string");
  assert.ok(await second.getPhotoAsset(scope, "retained-image"));
  const result = await recoverAsNew(second, recoveries[0].operationId);

  assert.notEqual(result.href, "/products/deleted");
  await engine.run();
  const collection = await fixture.repository.collection("me", scope.eventId);
  const recovered = collection.products.find((entry) =>
    entry.data.deletedAt === null || entry.data.deletedAt === undefined);

  assert.ok(recovered);
  assert.equal(recovered.data.description, "Modifica offline da recuperare");
  assert.ok(collection.photos.some((entry) => entry.data.productId === recovered.data.id
    && entry.data.deletedAt === null));
  assert.equal((await second.sync.summary()).recoveries.length, 0);
});

void test("upload interrotto/discordante/spazio esaurito: nessuna conferma falsa, originale locale conservato", async (context) => {
  const fixture = await syncFixture(context);
  const first = await device(context, fixture.catalog);
  const bytes = await photo();

  await first.saveProduct(scope, "media", input);
  await first.addProductPhoto(scope, "media", "media-image", bytes, input);
  const noSpace: typeof fetch = (url, init) => (url instanceof Request ? url.url : String(url)).endsWith("/original") && init?.method === "PUT"
    ? Promise.resolve(Response.json({
      error: "storage_full",
    }, {
      status: 507,
    })) : fixture.request(url, init);
  const blocked = new SyncEngine(first, noSpace);

  await blocked.run();
  assert.equal(blocked.snapshot().phase, "error");
  assert.equal((await first.listPendingOperations()).filter((entry) => entry.entityType === "photo").length, 1);
  assert.ok(await first.getPhotoAsset(scope, "media-image"));
  assert.equal((await fixture.repository.collection("me", scope.eventId)).photos[0].mediaStatus, "pending");
  const broken = new Request("http://test.local", {
    method: "PUT",
    body: new Blob(["corrupt"]),
  });

  await assert.rejects(fixture.media.upload(scope, "media-image", broken));
  assert.equal((await fixture.repository.collection("me", scope.eventId)).photos[0].mediaStatus, "pending");
  await new SyncEngine(first, fixture.request).run();
  assert.equal((await first.listPendingOperations()).length, 0);
  assert.equal((await fixture.repository.collection("me", scope.eventId)).photos[0].mediaStatus, "ready");
  await assert.rejects(fixture.media.download({
    ...scope,
    profileId: "father",
  }, "media-image", "original"));
  const again = await fixture.media.upload(scope, "media-image", new Request("http://test.local", {
    method: "PUT",
    body: bytes.original,
  }));

  assert.equal(again.mediaStatus, "ready");
  const files = await readdir(path.join(fixture.directory, "media"));
  const original = await readFile(path.join(fixture.directory, "media", files[0], "original"));

  assert.equal(createHash("sha256").update(original).digest("hex"), bytes.sha256);
});

void test("profili personali, stand, budget fra eventi e preferenze concorrenti restano separati", async (context) => {
  const fixture = await syncFixture(context);
  const first = await device(context, fixture.catalog);
  const personal = {
    profileId: "usr-fair",
    eventId: scope.eventId,
  };

  await first.savePersonalProfile(personal.profileId, {
    name: "Visitatore",
    color: "#197F9E",
  });
  await first.savePersonalStand(personal, "personal-fair", {
    name: "Stand scoperto",
    description: "In fiera",
    categoryIds: ["bags"],
    hall: null,
    booth: "A",
  });
  await first.saveProduct(personal, "personal-product", {
    ...input,
    standRef: {
      source: "personal",
      eventId: scope.eventId,
      standId: "personal-fair",
    },
  });
  await first.setBudget(personal.profileId, "bags", null);
  await first.saveStandPreferences(scope, "demo-bags", {
    notes: "Primo dispositivo",
  });
  const second = await device(context, fixture.catalog);

  // Both devices create their first override offline; the last accepted whole record wins.
  await second.saveStandPreferences(scope, "demo-bags", {
    notes: "Secondo dispositivo",
    interested: false,
  });
  await new SyncEngine(first, fixture.request).run();
  await new SyncEngine(second, fixture.request).run();
  await new SyncEngine(first, fixture.request).run();
  const restored = await second.getCatalog();

  assert.ok(restored);
  assert.ok(restored.profiles.some((profile) => profile.id === personal.profileId
    && profile.origin === "personal"));
  assert.equal((await second.getProduct(personal, "personal-product"))?.lastValid?.name, input.name);
  assert.equal((await second.listStandPreferences(scope))[0].notes, "Secondo dispositivo");
  assert.equal((await first.listStandPreferences(scope))[0].interested, false);
  assert.equal((await fixture.repository.collection("father", scope.eventId)).products.length, 0);
  await fixture.pool.query("INSERT INTO events(id,data) VALUES ('second-fair','{}')");
  const another = await fixture.repository.collection(personal.profileId, "second-fair");

  assert.equal(another.products.length, 0);
  assert.equal(another.budgets[0].data.amount, null);
  assert.equal(another.budgets[0].data.removed, false);
  await second.saveProduct(personal, "personal-product", {
    description: "Raccolta da profilo eliminato",
  });
  await first.deletePersonalProfile(personal.profileId);
  await new SyncEngine(first, fixture.request).run();
  await new SyncEngine(second, fixture.request).run();
  const profileAfterDeletion = (await second.getCatalog())?.profiles.find((profile) =>
    profile.id === personal.profileId);

  assert.equal(profileAfterDeletion?.enabled, false);
  assert.ok(await second.getProduct(personal, "personal-product"));
  const rejected = (await second.sync.summary()).recoveries.find((entry) =>
    entry.operation.entityType === "product");

  assert.ok(rejected);
  const recovered = await recoverAsNew(second, rejected.operationId);

  assert.notEqual(recovered.profileId, personal.profileId);
  await new SyncEngine(second, fixture.request).run();
  const recoveredCollection = await fixture.repository.collection(recovered.profileId, scope.eventId);

  assert.equal(recoveredCollection.products[0].data.description, "Raccolta da profilo eliminato");
  assert.equal((await second.sync.summary()).recoveries.length, 0);
});

void test("originali: upload interrotto e cancellazione concorrente non pubblicano file incompleti", async (context) => {
  const fixture = await syncFixture(context);
  const first = await device(context, fixture.catalog);
  const bytes = await photo();

  await first.saveProduct(scope, "interrupted", input);
  await first.addProductPhoto(scope, "interrupted", "interrupted-image", bytes, input);
  const queued = await first.listPendingOperations();
  const productOperation = queued.find((operation) => operation.entityType === "product");
  const photoOperation = queued.find((operation) => operation.entityType === "photo");

  assert.ok(productOperation);
  assert.ok(photoOperation);
  assert.equal((await fixture.sync.push(productOperation)).status, "accepted");
  assert.equal((await fixture.sync.push(photoOperation)).status, "accepted");
  const partial: RequestInit & {
    duplex: "half";
  } = {
    method: "PUT",
    duplex: "half",
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]));
        controller.error(new TypeError("Connessione interrotta"));
      },
    }),
  };

  await assert.rejects(fixture.media.upload(scope, "interrupted-image", new Request("http://test.local", partial)));
  assert.equal((await fixture.repository.collection("me", scope.eventId)).photos[0].mediaStatus, "pending");
  const allBytes = new Uint8Array(await bytes.original.arrayBuffer());
  let deleted = false;
  const racing: RequestInit & {
    duplex: "half";
  } = {
    method: "PUT",
    duplex: "half",
    body: new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (!deleted) {
          deleted = true;
          await fixture.sync.push({
            ...productOperation,
            operationId: crypto.randomUUID(),
            action: "delete",
            dependsOn: [],
            payload: {
              ...productOperation.payload,
              deletedAt: new Date().toISOString(),
            },
          });
          controller.enqueue(allBytes);
        } else {
          controller.close();
        }
      },
    }),
  };

  await assert.rejects(fixture.media.upload(scope, "interrupted-image", new Request("http://test.local", racing)));
  await assert.rejects(fixture.media.download(scope, "interrupted-image", "original"));
  assert.ok(await first.getPhotoAsset(scope, "interrupted-image"));
  assert.equal((await readdir(path.join(fixture.directory, "media"))).filter((file) => file.startsWith(".upload-")).length, 0);
});
