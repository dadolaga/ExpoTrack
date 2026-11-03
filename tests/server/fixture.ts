import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { importCatalog } from "../../src/lib/server/catalog";
import { createServerPool } from "../../src/lib/server/database";
import { ServerMedia } from "../../src/lib/server/media";
import { migrate } from "../../src/lib/server/migrations";
import { ServerRepository } from "../../src/lib/server/repository";
import { ServerSync } from "../../src/lib/server/sync";
import { syncResponse } from "../../src/lib/server/sync-api";

import type { TestContext } from "node:test";

export async function syncFixture(context: TestContext) {
  const configured = process.env.TEST_DATABASE_URL;

  assert.ok(configured !== undefined && configured !== "", "Impostare TEST_DATABASE_URL.");
  const target = new URL(configured);

  assert.match(target.pathname, /(?:^|_)test(?:_|$)/);
  if (process.env.EXPOTRACK_FINAL_VALIDATION !== "1" && process.env.DATABASE_URL !== undefined) {
    const development = new URL(process.env.DATABASE_URL);

    assert.notEqual(`${target.host}${target.pathname}`, `${development.host}${development.pathname}`);
  }
  target.pathname = "/postgres";
  const admin = createServerPool(target.toString());
  const name = `expotrack_test_${randomUUID().replaceAll("-", "")}`;

  await admin.query(`CREATE DATABASE "${name}"`);
  target.pathname = `/${name}`;
  const pool = createServerPool(target.toString());
  const directory = await mkdtemp(path.join(tmpdir(), "expotrack-sync-test-"));

  context.after(async () => {
    await pool.end();
    try {
      await admin.query(`DROP DATABASE "${name}"`);
    } finally {
      await admin.end();
      await rm(directory, {
        recursive: true,
        force: true,
      });
    }
  });
  await cp("tests/fixtures/catalog", path.join(directory, "config"), {
    recursive: true,
  });
  await migrate(pool);
  await importCatalog(pool, path.join(directory, "config"));
  const repository = new ServerRepository(pool);
  const sync = new ServerSync(pool);
  const media = new ServerMedia(pool, path.join(directory, "media"));
  const request: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), "http://test.local");

    return syncResponse(async () => {
      if (url.pathname === "/api/v1/sync/push") {
        assert.equal(typeof init?.body, "string");

        return Response.json(await sync.push(JSON.parse(init?.body as string) as unknown));
      }
      if (url.pathname === "/api/v1/sync/pull") {
        return Response.json(await sync.pull(url.searchParams.get("cursor")));
      }
      const match = /^\/api\/v1\/profiles\/([^/]+)\/events\/([^/]+)\/photos\/([^/]+)\/original$/u.exec(url.pathname);

      assert.ok(match);
      const scope = {
        profileId: decodeURIComponent(match[1]),
        eventId: decodeURIComponent(match[2]),
      };
      const photoId = decodeURIComponent(match[3]);

      if (init?.method === "PUT") {
        return Response.json(await media.upload(scope, photoId, new Request(url, init)));
      }

      return media.download(scope, photoId, url.searchParams.get("variant") ?? "original");
    });
  };

  return {
    pool,
    directory,
    repository,
    sync,
    media,
    request,
    catalog: (await repository.bootstrap()).catalog,
  };
}
