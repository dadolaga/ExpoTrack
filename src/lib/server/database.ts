import { Pool } from "pg";

import type { PoolClient } from "pg";

export function createServerPool(connectionString: string): Pool {
  const pool = new Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 2500,
    statement_timeout: 15000,
    idleTimeoutMillis: 10000,
  });

  // pg retires failed idle clients. Handle its error event so a database outage
  // does not terminate Next.js; requests can return 503 and reconnect later.
  pool.on("error", () => {
    console.error("Connessione PostgreSQL inattiva interrotta.");
  });

  return pool;
}

export async function transaction<T>(
  pool: Pool,
  work: (client: PoolClient) => Promise<T>,
  readOnly = false,
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query(readOnly ? "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY" : "BEGIN");
    const result = await work(client);

    await client.query("COMMIT");

    return result;
  } catch (error) {
    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }
}
