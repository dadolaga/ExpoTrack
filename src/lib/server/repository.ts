import { transaction } from "./database";

import type {
  Bootstrap, ServerCollection, ServerProfile, ServerRecord,
} from "../../types/server";
import type { Pool, PoolClient } from "pg";

export class ServerNotFoundError extends Error {}

// JSONB is written only through the validated catalog importer or server repositories.
export class ServerRepository {
  constructor(private readonly pool: Pool) {}

  async bootstrap(): Promise<Bootstrap> {
    const result = await this.pool.query<{
      hash: string;
      data: Bootstrap["catalog"];
    }>(`
      SELECT c.hash,c.data FROM server_state s JOIN catalog_snapshots c ON c.hash=s.catalog_hash
      WHERE s.singleton`);
    const row = result.rows.at(0);

    if (row === undefined) {
      throw new Error("Catalogo server non inizializzato: eseguire db:import.");
    }

    return {
      schemaVersion: 1,
      configHash: row.hash,
      catalog: row.data,
    };
  }

  async profiles(): Promise<ServerProfile[]> {
    const result = await this.pool.query<ServerProfile>(`SELECT data,revision::float8 AS revision,
      deleted_at AS "deletedAt", (active AND deleted_at IS NULL
        AND coalesce((data->>'enabled')::boolean,false)) AS available FROM profiles ORDER BY id`);

    return result.rows;
  }

  async collection(profileId: string, eventId: string): Promise<ServerCollection> {
    return transaction(this.pool, async (client) => {
      const scope = await client.query(`SELECT FROM profiles p CROSS JOIN events e
        WHERE p.id=$1 AND e.id=$2`, [profileId, eventId]);

      if (scope.rowCount !== 1) {
        throw new ServerNotFoundError("Profilo o evento non disponibile.");
      }
      const state = await client.query<{
        revision: number;
      }>(
        "SELECT revision::float8 AS revision FROM server_state WHERE singleton",
      );
      const rows = async <T>(table: string, eventScoped = true) => {
        // Table identifiers are fixed by this repository; values are always parameters.
        const result = await client.query<ServerRecord<T>>(`SELECT data,revision::float8 AS revision
          FROM ${table} WHERE profile_id=$1 ${eventScoped ? "AND event_id=$2" : ""}
          ORDER BY revision`, eventScoped ? [profileId, eventId] : [profileId]);

        return result.rows;
      };
      const products = await rows<ServerCollection["products"][number]["data"]>("products");
      const personalStands = await rows<ServerCollection["personalStands"][number]["data"]>(
        "personal_stands",
      );
      const standPreferences = await rows<ServerCollection["standPreferences"][number]["data"]>(
        "stand_preferences",
      );
      const budgets = await rows<ServerCollection["budgets"][number]["data"]>("budget_overrides", false);
      const photos = await readPhotos(client, profileId, eventId);

      return {
        profileId,
        eventId,
        revision: state.rows[0].revision,
        products,
        personalStands,
        standPreferences,
        budgets,
        photos,
      };
    }, true);
  }
}

async function readPhotos(client: PoolClient, profileId: string, eventId: string) {
  const result = await client.query<ServerCollection["photos"][number]>(`SELECT data,
    revision::float8 AS revision,media_status AS "mediaStatus" FROM photos
    WHERE profile_id=$1 AND event_id=$2 ORDER BY revision`, [profileId, eventId]);

  return result.rows;
}
