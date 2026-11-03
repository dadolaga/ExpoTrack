import { importCatalog } from "../src/lib/server/catalog";
import { createServerPool } from "../src/lib/server/database";
import { migrate } from "../src/lib/server/migrations";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  const [command, directory] = process.argv.slice(2);

  if (connectionString === undefined || connectionString.length === 0) {
    throw new Error("Impostare DATABASE_URL esclusivamente nell’ambiente server.");
  }
  const pool = createServerPool(connectionString);

  try {
    if (command === "migrate") {
      await migrate(pool);
      process.stdout.write("Migrazioni applicate.\n");
    } else if (command === "import") {
      const hash = await importCatalog(pool, directory);

      process.stdout.write(`Catalogo importato: ${hash}\n`);
    } else {
      throw new Error("Comando supportato: migrate oppure import.");
    }
  } finally {
    await pool.end();
  }
}

void main().catch(() => {
  process.stderr.write("Operazione database non riuscita. Verificare configurazione, migrazioni e JSON.\n");
  process.exitCode = 1;
});
