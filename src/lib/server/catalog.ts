import { createHash } from "node:crypto";

import { loadCatalog } from "../config/load-catalog";

import { transaction } from "./database";

import type { CatalogSnapshot } from "../../types/catalog";
import type { Pool } from "pg";

function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry: unknown) => canonical(entry)).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    return `{${Object.entries(value).filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(",")}}`;
  }

  return JSON.stringify(value);
}

export function catalogHash(catalog: CatalogSnapshot): string {
  return createHash("sha256").update(canonical(catalog)).digest("hex");
}

// All JSON files and references are validated before the first database mutation.
export async function importCatalog(pool: Pool, directory?: string): Promise<string> {
  const catalog = await loadCatalog(directory);
  const hash = catalogHash(catalog);

  await transaction(pool, async (client) => {
    const state = await client.query<{
      catalog_hash: string | null;
    }>(
      "SELECT catalog_hash FROM server_state WHERE singleton FOR UPDATE",
    );

    if (state.rows[0]?.catalog_hash === hash) {
      return;
    }
    await client.query("UPDATE events SET active=false");
    await client.query("UPDATE categories SET active=false");
    await client.query("UPDATE profiles SET active=false WHERE origin='json'");
    await client.query("UPDATE pavilions SET active=false");
    await client.query("UPDATE catalog_stands SET active=false");

    for (const event of catalog.config.events) {
      await client.query(`INSERT INTO events(id,data) VALUES ($1,$2)
        ON CONFLICT(id) DO UPDATE SET data=excluded.data,active=true`, [event.id, event]);
    }
    for (const category of catalog.categories) {
      await client.query(`INSERT INTO categories(id,data) VALUES ($1,$2)
        ON CONFLICT(id) DO UPDATE SET data=excluded.data,active=true`, [category.id, category]);
    }
    for (const profile of catalog.profiles) {
      const result = await client.query(`INSERT INTO profiles(id,origin,data) VALUES ($1,'json',$2)
        ON CONFLICT(id) DO UPDATE SET data=excluded.data,active=true WHERE profiles.origin='json'`, [profile.id, profile]);

      if (result.rowCount !== 1) {
        throw new Error(`ID profilo già usato da un profilo personale: ${profile.id}`);
      }
    }
    for (const pavilion of catalog.pavilions) {
      await client.query(`INSERT INTO pavilions(event_id,id,data) VALUES ($1,$2,$3)
        ON CONFLICT(event_id,id) DO UPDATE SET data=excluded.data,active=true`, [
        pavilion.eventId, pavilion.id, pavilion,
      ]);
    }
    for (const stand of catalog.stands) {
      await client.query(`INSERT INTO catalog_stands(event_id,id,data) VALUES ($1,$2,$3)
        ON CONFLICT(event_id,id) DO UPDATE SET data=excluded.data,active=true`, [
        stand.eventId, stand.id, stand,
      ]);
      await client.query("DELETE FROM stand_categories WHERE event_id=$1 AND stand_id=$2", [stand.eventId, stand.id]);
      for (const categoryId of stand.categoryIds) {
        await client.query(`INSERT INTO stand_categories(event_id,stand_id,category_id)
          VALUES ($1,$2,$3)`, [
          stand.eventId, stand.id, categoryId,
        ]);
      }
    }
    for (const definition of catalog.questionnaires) {
      const result = await client.query(`INSERT INTO questionnaire_definitions
        (profile_id,id,version,category_id,data) VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT(profile_id,id,version) DO UPDATE SET data=excluded.data
        WHERE questionnaire_definitions.data=excluded.data`, [
        definition.profileId, definition.id, definition.version, definition.categoryId, definition,
      ]);

      if (result.rowCount !== 1) {
        throw new Error(`Questionario ${definition.id}: incrementare la versione per modificarlo.`);
      }
    }
    await client.query(`INSERT INTO catalog_snapshots(hash,data) VALUES ($1,$2)
      ON CONFLICT(hash) DO NOTHING`, [hash, catalog]);
    await client.query("UPDATE server_state SET catalog_hash=$1 WHERE singleton", [hash]);
  });

  return hash;
}
