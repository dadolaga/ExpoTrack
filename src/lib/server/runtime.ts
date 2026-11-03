import "server-only";

import { createServerPool } from "./database";
import { ServerRepository } from "./repository";

import type { Pool } from "pg";

const serverGlobal = globalThis as typeof globalThis & {
  expotrackPool?: Pool;
};

export function serverRepository(): ServerRepository {
  const connectionString = process.env.DATABASE_URL;

  if (connectionString === undefined || connectionString.length === 0) {
    throw new Error("DATABASE_URL non configurata sul server.");
  }
  serverGlobal.expotrackPool ??= createServerPool(connectionString);

  return new ServerRepository(serverGlobal.expotrackPool);
}
