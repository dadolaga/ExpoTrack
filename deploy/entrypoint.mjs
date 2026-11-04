import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [command = "serve", ...args] = process.argv.slice(2);
const configRoot = process.env.CONFIG_ROOT ?? "/config";
const commands = {
  serve: ["server.js"],
  validate: ["tools/scripts/validate-config.js", configRoot],
  migrate: ["tools/scripts/database.js", "migrate"],
  import: [
    "tools/scripts/database.js", "import", configRoot,
  ],
};

function databaseEnvironment() {
  if (process.env.DATABASE_URL !== undefined && process.env.DATABASE_URL.length > 0) {
    return;
  }
  const required = [
    "PGHOST", "PGDATABASE", "PGUSER", "PGPASSWORD",
  ];

  if (required.some((key) => !process.env[key])) {
    throw new Error("Impostare PGHOST, PGDATABASE, PGUSER e PGPASSWORD sul container.");
  }
  const connection = new URL("postgresql://localhost");

  connection.hostname = process.env.PGHOST;
  connection.port = process.env.PGPORT ?? "5432";
  connection.username = encodeURIComponent(process.env.PGUSER);
  connection.password = encodeURIComponent(process.env.PGPASSWORD);
  connection.pathname = `/${encodeURIComponent(process.env.PGDATABASE)}`;
  process.env.DATABASE_URL = connection.href;
}

try {
  if ((command !== "bootstrap" && !Object.hasOwn(commands, command)) || args.length > 0) {
    throw new Error("Comando previsto: serve, bootstrap, validate, migrate oppure import.");
  }
  if (command !== "validate") {
    databaseEnvironment();
  }
  if (command === "bootstrap") {
    for (const step of [
      "validate", "migrate", "import",
    ]) {
      const result = spawnSync(process.execPath, commands[step], {
        stdio: "inherit",
      });

      if (result.error !== undefined || result.status !== 0) {
        throw new Error(`Inizializzazione interrotta durante ${step}.`);
      }
    }
  } else {
    const [script, ...scriptArgs] = commands[command];
    const filename = path.resolve(script);

    process.argv = [
      process.execPath, filename, ...scriptArgs,
    ];
    // Run the server in this process so SIGTERM reaches Next.js directly.
    await import(pathToFileURL(filename).href);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Avvio del container non riuscito.");
  process.exitCode = 1;
}
