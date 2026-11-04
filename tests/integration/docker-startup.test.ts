import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtemp, mkdir, readFile, rm, writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const entrypoint = path.resolve("deploy/entrypoint.mjs");

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "expotrack-docker-test-"));
  const config = path.join(root, "catalogo privato");
  const journal = path.join(root, "journal.jsonl");
  const scripts = path.join(root, "tools/scripts");

  await mkdir(scripts, {
    recursive: true,
  });
  await mkdir(config);
  // Only the child programs are simulated: exercise the real process entrypoint,
  // its argument forwarding, credentials and stop-on-failure behavior.
  const record = `
const fs = require("node:fs");
const step = process.env.TEST_STEP || process.argv[2];
fs.appendFileSync(process.env.TEST_JOURNAL, JSON.stringify({
  step,
  args: process.argv.slice(2),
  connection: process.env.DATABASE_URL,
}) + "\\n");
process.exitCode = process.env.TEST_FAIL === step ? 1 : 0;
`;

  await writeFile(path.join(root, "server.js"), record);
  await writeFile(path.join(scripts, "database.js"), record);
  await writeFile(path.join(scripts, "validate-config.js"), `
process.env.TEST_STEP = "validate";
${record}
`);
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    CONFIG_ROOT: config,
    TEST_JOURNAL: journal,
    PGHOST: "postgres",
    PGDATABASE: "expotrack",
    PGUSER: "expotrack_app",
    PGPASSWORD: "test-only: @/#?$%è",
  };

  delete env.DATABASE_URL;
  delete env.TEST_STEP;
  delete env.TEST_FAIL;

  return {
    root,
    config,
    env,
    run(command: string, overrides: Partial<NodeJS.ProcessEnv> = {}) {
      return spawnSync(process.execPath, [entrypoint, command], {
        cwd: root,
        env: {
          ...env,
          ...overrides,
        },
        encoding: "utf8",
      });
    },
    async records() {
      const content = await readFile(journal, "utf8");

      return content.trim().split("\n").map((line) => JSON.parse(line) as {
        step?: string;
        args: string[];
        connection?: string;
      });
    },
    async cleanup() {
      await rm(root, {
        recursive: true,
        force: true,
      });
    },
  };
}

void test("Docker: catalogo esterno con spazi, ordine bootstrap e password con caratteri speciali", async (context) => {
  const setup = await fixture();

  context.after(() => setup.cleanup());
  const result = setup.run("bootstrap");

  assert.equal(result.status, 0, result.stderr);
  const records = await setup.records();

  assert.deepEqual(records.map((record) => record.step), [
    "validate", "migrate", "import",
  ]);
  assert.deepEqual(records[0].args, [setup.config]);
  assert.deepEqual(records[1].args, ["migrate"]);
  assert.deepEqual(records[2].args, ["import", setup.config]);
  const connection = new URL(records[2].connection ?? "");

  assert.equal(connection.hostname, "postgres");
  assert.equal(connection.pathname, "/expotrack");
  assert.equal(decodeURIComponent(connection.username), "expotrack_app");
  assert.equal(decodeURIComponent(connection.password), setup.env.PGPASSWORD);
  assert.equal(result.stdout.includes(setup.env.PGPASSWORD ?? ""), false);
});

for (const failedStep of ["validate", "migrate"]) {
  void test(`Docker: errore ${failedStep} interrompe le operazioni successive`, async (context) => {
    const setup = await fixture();

    context.after(() => setup.cleanup());
    const result = setup.run("bootstrap", {
      TEST_FAIL: failedStep,
    });

    assert.equal(result.status, 1);
    const records = await setup.records();

    assert.deepEqual(records.map((record) => record.step), failedStep === "validate"
      ? ["validate"] : ["validate", "migrate"]);
    assert.equal(result.stderr.includes(setup.env.PGPASSWORD ?? ""), false);
  });
}

void test("Docker: validazione senza credenziali e avvio rifiutato senza database", async (context) => {
  const setup = await fixture();

  context.after(() => setup.cleanup());
  const noPassword = {
    PGPASSWORD: undefined,
  };

  assert.equal(setup.run("validate", noPassword).status, 0);
  assert.equal(setup.run("serve", noPassword).status, 1);
  assert.equal(setup.run("comando-sconosciuto").status, 1);
  const records = await setup.records();

  assert.equal(records.length, 1);
  assert.deepEqual(records[0].args, [setup.config]);
});

void test("Docker: avvio server nello stesso processo con URL esplicito", async (context) => {
  const setup = await fixture();

  context.after(() => setup.cleanup());
  const connection = "postgresql://isolated:test-only@localhost/expotrack_test";
  const result = setup.run("serve", {
    DATABASE_URL: connection,
    PGPASSWORD: undefined,
    TEST_STEP: "serve",
  });

  assert.equal(result.status, 0, result.stderr);
  const records = await setup.records();

  assert.deepEqual(records, [
    {
      step: "serve",
      args: [],
      connection,
    },
  ]);
});
