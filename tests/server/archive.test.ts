import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  appendFile, cp, mkdtemp, readFile, rm, writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createReadApi } from "../../src/lib/server/api";
import { importCatalog } from "../../src/lib/server/catalog";
import { createServerPool, transaction } from "../../src/lib/server/database";
import { migrate } from "../../src/lib/server/migrations";
import { ServerRepository } from "../../src/lib/server/repository";

import type { ProductData } from "../../src/types/offline";
import type { TestContext } from "node:test";
import type { Pool } from "pg";

const eventId = "fiera-demo-2026";

async function fixture(context: TestContext) {
  const configured = process.env.TEST_DATABASE_URL;

  assert.ok(
    configured !== undefined && configured.length > 0,
    "Impostare TEST_DATABASE_URL con un nome database contenente il segmento test.",
  );
  const target = new URL(configured);

  assert.match(decodeURIComponent(target.pathname.slice(1)), /(?:^|_)test(?:_|$)/);
  assert.ok(["postgres:", "postgresql:"].includes(target.protocol));
  if (process.env.EXPOTRACK_FINAL_VALIDATION !== "1" && process.env.DATABASE_URL !== undefined) {
    const development = new URL(process.env.DATABASE_URL);
    const targetPort = target.port === "" ? "5432" : target.port;
    const developmentPort = development.port === "" ? "5432" : development.port;

    assert.notEqual(
      `${target.hostname}:${targetPort}${target.pathname}`,
      `${development.hostname}:${developmentPort}${development.pathname}`,
    );
  }
  // Connect to the maintenance DB only to create/drop a unique database owned by this test.
  target.pathname = "/postgres";
  const admin = createServerPool(target.toString());
  const databaseName = `expotrack_test_${randomUUID().replaceAll("-", "")}`;

  await admin.query(`CREATE DATABASE "${databaseName}"`);
  target.pathname = `/${databaseName}`;
  const pool = createServerPool(target.toString());
  const directory = await mkdtemp(path.join(tmpdir(), "expotrack-server-test-"));

  context.after(async () => {
    await pool.end();
    try {
      await admin.query(`DROP DATABASE "${databaseName}"`);
    } finally {
      await admin.end();
      await rm(directory, {
        recursive: true,
        force: true,
      });
    }
  });
  await cp("tests/fixtures/catalog", directory, {
    recursive: true,
  });
  await migrate(pool);

  return {
    pool,
    directory,
    repository: new ServerRepository(pool),
  };
}

function product(id: string, profileId = "me"): ProductData {
  return {
    id,
    profileId,
    eventId,
    name: "Raccolta di test",
    categoryId: "bags",
    standRef: {
      source: "catalog",
      eventId,
      standId: "demo-bags",
    },
    description: "Nota privata",
    price: 0,
    rating: null,
    questionnaireAnswers: [],
    createdAt: "2026-11-01T10:00:00.000Z",
    updatedAt: "2026-11-01T10:00:00.000Z",
  };
}

async function insertProduct(pool: Pool, data: ProductData) {
  await pool.query("INSERT INTO products(profile_id,event_id,id,data) VALUES ($1,$2,$3,$4)", [
    data.profileId, data.eventId, data.id, data,
  ]);
}

async function jsonFile<T>(directory: string, file: string): Promise<T> {
  // Test fixture files are controlled by this suite.
  return JSON.parse(await readFile(path.join(directory, file), "utf8")) as T;
}

void test("migrazioni ripetibili, checksum protetto e rollback dell’intera migrazione fallita", async (context) => {
  const { pool, directory } = await fixture(context);

  await Promise.all([migrate(pool), migrate(pool)]);
  await cp("migrations", path.join(directory, "migrations"), {
    recursive: true,
  });
  const migrations = path.join(directory, "migrations");

  await writeFile(
    path.join(migrations, "003_failure.sql"),
    "CREATE TABLE must_rollback(id text); SELECT * FROM missing_table;",
  );
  await assert.rejects(migrate(pool, migrations));
  assert.equal((await pool.query<{
    name: string | null;
  }>(
    "SELECT to_regclass('must_rollback') AS name",
  )).rows[0].name, null);
  await rm(path.join(migrations, "003_failure.sql"));
  await appendFile(path.join(migrations, "001_archive.sql"), "\n-- changed\n");
  await assert.rejects(migrate(pool, migrations), /modificata/u);
  assert.equal((await pool.query("SELECT * FROM schema_migrations")).rowCount, 2);
});

void test("importazione atomica: JSON invalidi, riferimenti mancanti, storia questionari e catalogo rimosso", async (context) => {
  const { pool, directory, repository } = await fixture(context);
  const hash = await importCatalog(pool, directory);

  assert.equal(await importCatalog(pool, directory), hash);
  assert.equal((await pool.query("SELECT * FROM catalog_snapshots")).rowCount, 1);
  const original = await readFile(path.join(directory, "categories.json"), "utf8");

  await writeFile(path.join(directory, "categories.json"), "{");
  await assert.rejects(importCatalog(pool, directory));
  await writeFile(path.join(directory, "categories.json"), original);
  const stands = await jsonFile<{
    schemaVersion: 1;
    stands: {
      id: string;
      categories: string[];
    }[];
  }>(directory, "events/fiera-demo-2026-stands.json");

  stands.stands[0].categories.push("missing");
  await writeFile(path.join(directory, "events/fiera-demo-2026-stands.json"), JSON.stringify(stands));
  await assert.rejects(importCatalog(pool, directory));
  stands.stands[0].categories.pop();
  await writeFile(path.join(directory, "events/fiera-demo-2026-stands.json"), JSON.stringify(stands));
  const questions = await jsonFile<{
    questionnaires: {
      title: string;
      version: number;
    }[];
  }>(directory, "questionnaires/me.json");

  questions.questionnaires[0].title = "Nuovo titolo";
  await writeFile(path.join(directory, "questionnaires/me.json"), JSON.stringify(questions));
  await assert.rejects(importCatalog(pool, directory), /versione/u);
  assert.equal((await repository.bootstrap()).configHash, hash);
  assert.equal((await pool.query("SELECT * FROM catalog_snapshots")).rowCount, 1);
  assert.equal((await pool.query("SELECT * FROM events WHERE active")).rowCount, 1);
  questions.questionnaires[0].version += 1;
  await writeFile(path.join(directory, "questionnaires/me.json"), JSON.stringify(questions));
  const updated = await importCatalog(pool, directory);

  assert.notEqual(updated, hash);
  assert.equal((await pool.query("SELECT * FROM questionnaire_definitions WHERE profile_id='me'"))
    .rowCount, 2);
  const collected = product("retained");

  collected.standRef.standId = "demo-lights";
  await insertProduct(pool, collected);
  stands.stands = stands.stands.filter((stand) => stand.id !== "demo-lights");
  await writeFile(path.join(directory, "events/fiera-demo-2026-stands.json"), JSON.stringify(stands));
  const interests = await jsonFile<{
    events: {
      stands: {
        standId: string;
      }[];
    }[];
  }>(directory, "interests/father.json");

  interests.events[0].stands = interests.events[0].stands.filter((stand) => stand.standId !== "demo-lights");
  await writeFile(path.join(directory, "interests/father.json"), JSON.stringify(interests));
  await importCatalog(pool, directory);
  assert.equal((await repository.collection("me", eventId)).products[0].data.id, "retained");
  assert.equal((await pool.query<{
    active: boolean;
  }>(
    "SELECT active FROM catalog_stands WHERE id='demo-lights'",
  )).rows[0].active, false);
});

void test("vincoli server: contesti, campi bloccati, budget, checklist, foto, tombstone e idempotenza", async (context) => {
  const { pool, directory, repository } = await fixture(context);

  await importCatalog(pool, directory);
  await insertProduct(pool, product("first"));
  await insertProduct(pool, product("first", "father"));
  await pool.query("INSERT INTO events(id,data) VALUES ('second-test','{}')");
  await pool.query(`INSERT INTO catalog_stands(event_id,id,data)
    VALUES ('second-test','demo-bags','{}')`);
  const otherEvent = product("first");

  otherEvent.eventId = "second-test";
  otherEvent.standRef.eventId = "second-test";
  otherEvent.name = "Altro evento";
  await insertProduct(pool, otherEvent);
  await assert.rejects(insertProduct(pool, product("first")));
  await assert.rejects(insertProduct(pool, product("bad-profile", "missing")));
  const wrongEvent = {
    ...product("bad-event"),
    eventId: "missing",
  };

  await assert.rejects(insertProduct(pool, wrongEvent));
  await assert.rejects(pool.query(`UPDATE products SET data=jsonb_set(data,'{profileId}','"father"')
    WHERE id='first' AND profile_id='me'`));
  await assert.rejects(pool.query(`UPDATE products SET data=jsonb_set(data,'{categoryId}','"lights"')
    WHERE id='first'`));
  await assert.rejects(pool.query(`UPDATE products SET data=jsonb_set(data,'{standRef,standId}','"demo-lights"')
    WHERE id='first'`));
  const personalStand = {
    id: "private",
    profileId: "me",
    eventId,
    name: "Personale",
    description: "",
    categoryIds: ["bags"],
    hall: null,
    booth: "",
    createdAt: product("unused").createdAt,
    updatedAt: product("unused").updatedAt,
    deletedAt: null,
  };

  await pool.query("INSERT INTO personal_stands(profile_id,event_id,id,data) VALUES ('me',$1,'private',$2)", [eventId, personalStand]);
  const foreignStand = product("foreign", "father");

  foreignStand.standRef = {
    source: "personal",
    eventId,
    standId: "private",
  };
  await assert.rejects(insertProduct(pool, foreignStand));
  const preferences = {
    profileId: "me",
    eventId,
    standRef: product("unused").standRef,
    interested: false,
    checklist: [
      {
        id: "stable",
        text: "Controllare",
      },
    ],
    checklistDone: {
      stable: true,
    },
  };
  const writePreferences = (data: unknown) => pool.query(`INSERT INTO stand_preferences
    (profile_id,event_id,data) VALUES ('me',$1,$2)`, [eventId, data]);

  await assert.rejects(writePreferences({
    ...preferences,
    checklistDone: {
      stable: "yes",
    },
  }));
  await assert.rejects(writePreferences({
    ...preferences,
    checklist: [
      {
        id: "x",
        text: "",
      },
    ],
  }));
  await writePreferences(preferences);
  await assert.rejects(pool.query(`UPDATE stand_preferences
    SET data=jsonb_set(data,'{priority}','1.5')`));
  const writeBudget = (amount: number | null, removed: boolean, profileId = "me") => pool.query(`
    INSERT INTO budget_overrides(profile_id,category_id,data) VALUES ($1,'bags',$2)
    ON CONFLICT(profile_id,category_id) DO UPDATE SET data=excluded.data`, [
    profileId, {
      profileId,
      categoryId: "bags",
      amount,
      removed,
      currency: "EUR",
    },
  ]);

  await assert.rejects(writeBudget(-1, false));
  await assert.rejects(writeBudget(1.001, false));
  await writeBudget(0, false);
  await writeBudget(null, true, "father");
  const photo = {
    id: "image",
    profileId: "father",
    eventId,
    productId: "only-me",
    filename: "test.jpg",
    sha256: "a".repeat(64),
    byteSize: 3,
    contentType: "image/jpeg",
    width: 1,
    height: 1,
    isPrimary: true,
    addedOrder: 1,
    createdAt: personalStand.createdAt,
    updatedAt: personalStand.updatedAt,
    deletedAt: null,
  };

  await insertProduct(pool, product("only-me"));
  await assert.rejects(pool.query(`INSERT INTO photos(profile_id,event_id,id,data)
    VALUES ('father',$1,'image',$2)`, [eventId, photo]));
  photo.profileId = "me";
  await pool.query(`INSERT INTO photos(profile_id,event_id,id,data)
    VALUES ('me',$1,'image',$2)`, [eventId, photo]);
  await assert.rejects(pool.query("UPDATE photos SET media_status='ready'"));
  await pool.query("UPDATE photos SET storage_key='isolated-test/image',media_status='ready'");
  await pool.query(`UPDATE products SET data=jsonb_set(data,'{deletedAt}','"2026-11-03T10:00:00Z"')
    WHERE profile_id='me' AND id='first'`);
  await assert.rejects(pool.query("UPDATE products SET data=data-'deletedAt' WHERE profile_id='me' AND id='first'"));
  await assert.rejects(pool.query("DELETE FROM products WHERE id='first'"));
  const before = (await repository.collection("me", eventId)).revision;

  await assert.rejects(transaction(pool, async (client) => {
    await client.query("INSERT INTO products(profile_id,event_id,id,data) VALUES ('me',$1,'rollback',$2)", [eventId, product("rollback")]);

    throw new Error("rollback");
  }));
  assert.equal((await repository.collection("me", eventId)).revision, before);
  const operation = `INSERT INTO server_operations(operation_id,profile_id,event_id,entity_type,
    entity_id,payload_hash,response) VALUES ('op','me',$1,'product','first','hash','{"status":"accepted"}')`;

  await pool.query(operation, [eventId]);
  await assert.rejects(pool.query(operation, [eventId]));
  const first = await repository.collection("me", eventId);
  const second = await repository.collection("father", eventId);
  const third = await repository.collection("me", "second-test");

  assert.equal(first.standPreferences[0].data.interested, false);
  assert.equal(first.budgets[0].data.amount, 0);
  assert.equal(second.budgets[0].data.removed, true);
  assert.deepEqual(third.budgets, first.budgets);
  assert.equal(third.products.length, 1);
  assert.equal(third.products[0].data.name, "Altro evento");
  assert.equal(first.products.find((entry) => entry.data.id === "first")?.data.deletedAt !== null, true);
  assert.equal(second.products[0].data.deletedAt, undefined);
  assert.ok(first.products.every((entry) => entry.data.profileId === "me" && entry.revision > 0));
  assert.equal(first.photos[0].mediaStatus, "ready");
  assert.equal(JSON.stringify(first).includes("storage_key"), false);
});

void test("profili personali: proprietà, collisione con JSON e tombstone senza cascata", async (context) => {
  const { pool, directory, repository } = await fixture(context);
  const hash = await importCatalog(pool, directory);
  const personal = {
    id: "usr-test",
    origin: "personal",
    name: "Personale",
    color: "#147D3C",
    icon: "user-round",
    enabled: true,
    budgets: [],
    deletedAt: null,
  };

  await pool.query("INSERT INTO profiles(id,origin,data) VALUES ('usr-test','personal',$1)", [personal]);
  await insertProduct(pool, product("owned", "usr-test"));
  const profileDocument = await jsonFile<{
    profiles: {
      id: string;
    }[];
  }>(directory, "profiles.json");

  profileDocument.profiles.push({
    ...profileDocument.profiles[0],
    id: "usr-test",
  });
  await writeFile(path.join(directory, "profiles.json"), JSON.stringify(profileDocument));
  await assert.rejects(importCatalog(pool, directory), /personale/u);
  assert.equal((await repository.bootstrap()).configHash, hash);
  await assert.rejects(pool.query("UPDATE profiles SET origin='json' WHERE id='usr-test'"));
  await pool.query(`UPDATE profiles SET data=data ||
    '{"enabled":false,"deletedAt":"2026-11-03T10:00:00Z"}' WHERE id='usr-test'`);
  await assert.rejects(pool.query("UPDATE profiles SET data=data-'deletedAt' WHERE id='usr-test'"));
  await assert.rejects(pool.query("DELETE FROM profiles WHERE id='usr-test'"));
  const profiles = await repository.profiles();

  assert.equal(profiles.find((entry) => entry.data.id === "usr-test")?.available, false);
  assert.equal((await repository.collection("usr-test", eventId)).products[0].data.id, "owned");
});

void test("API di lettura: bootstrap/304, isolamento, errori senza credenziali e server irraggiungibile", async (context) => {
  const { pool, directory, repository } = await fixture(context);
  const api = createReadApi(repository);
  const request = new Request("http://localhost/api/v1/bootstrap");

  assert.equal((await api.bootstrap(request)).status, 503);
  await importCatalog(pool, directory);
  await insertProduct(pool, product("private"));
  const first = await api.bootstrap(request);
  const second = await api.bootstrap(request);

  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), await second.json());
  assert.equal(first.headers.get("cache-control"), "private, no-store");
  const conditional = new Request(request, {
    headers: {
      "If-None-Match": `W/${first.headers.get("etag") ?? ""}`,
    },
  });

  assert.equal((await api.bootstrap(conditional)).status, 304);
  assert.equal((await api.catalog(eventId)).status, 200);
  assert.equal((await api.catalog("missing")).status, 404);
  assert.equal((await api.collection("missing", eventId)).status, 404);
  assert.equal((await api.collection("me' OR true", eventId)).status, 400);
  const privateCollection = await api.collection("me", eventId);
  const otherCollection = await api.collection("father", eventId);

  assert.ok((await privateCollection.text()).includes("private"));
  assert.equal((await otherCollection.text()).includes("private"), false);
  assert.equal((await api.profiles()).status, 200);
  const unavailable = createServerPool("postgresql://user:secret@127.0.0.1:1/unavailable");

  try {
    const response = await createReadApi(new ServerRepository(unavailable)).bootstrap(request);

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: "server_unavailable",
    });
  } finally {
    await unavailable.end();
  }
});
