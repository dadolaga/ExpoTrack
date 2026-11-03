import path from "node:path";

import "server-only";

import { createServerPool } from "./database";
import { ServerMedia } from "./media";
import { ServerRepository } from "./repository";
import { ServerSync } from "./sync";

import type { Pool } from "pg";

const serverGlobal = globalThis as typeof globalThis & {
  expotrackPool?: Pool;
};

function serverPool(): Pool {
  const connectionString = process.env.DATABASE_URL;

  if (connectionString === undefined || connectionString.length === 0) {
    throw new Error("DATABASE_URL non configurata sul server.");
  }
  serverGlobal.expotrackPool ??= createServerPool(connectionString);

  return serverGlobal.expotrackPool;
}

export function serverRepository() {
  return new ServerRepository(serverPool());
}

export function serverSync() {
  return new ServerSync(serverPool());
}

export function serverMedia() {
  return new ServerMedia(serverPool(), path.resolve(process.env.MEDIA_ROOT ?? ".media"));
}
