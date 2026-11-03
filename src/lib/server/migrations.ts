import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { transaction } from "./database";

import type { Pool } from "pg";

export async function migrate(pool: Pool, directory = path.join(process.cwd(), "migrations")) {
  const files = (await readdir(directory)).filter((file) => /^\d{3}_[\w-]+\.sql$/.test(file)).sort();

  if (files.length === 0) {
    throw new Error("Nessuna migrazione disponibile.");
  }
  await transaction(pool, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(180018)");
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const applied = await client.query<{
      version: string;
      checksum: string;
    }>(
      "SELECT version, checksum FROM schema_migrations ORDER BY version",
    );

    if (applied.rows.some((row, index) => files[index] !== row.version)) {
      throw new Error("Migrazioni applicate assenti o fuori ordine: ripristinare i file originali.");
    }
    for (const file of files) {
      const sql = await readFile(path.join(directory, file), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const previous = applied.rows.find((row) => row.version === file);

      if (previous !== undefined) {
        if (previous.checksum !== checksum) {
          throw new Error(`Migrazione già applicata modificata: ${file}`);
        }
        continue;
      }
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations(version,checksum) VALUES ($1,$2)", [file, checksum]);
    }
  });
}
