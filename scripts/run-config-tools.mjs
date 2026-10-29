import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const [mode, ...args] = process.argv.slice(2);

if (mode !== "validate" && mode !== "test") {
  throw new Error("Specificare validate oppure test.");
}

function run(arguments_) {
  const result = spawnSync(process.execPath, arguments_, {
    cwd: root,
    stdio: "inherit",
  });

  if (result.error !== undefined) {
    throw result.error;
  }

  return result.status ?? 1;
}

const output = await mkdtemp(path.join(tmpdir(), "expotrack-config-tools-"));

try {
  const compilation = run([
    require.resolve("typescript/bin/tsc"),
    "--project",
    "tsconfig.config-tools.json",
    "--outDir",
    output,
  ]);

  if (compilation !== 0) {
    process.exitCode = compilation;
  } else if (mode === "validate") {
    process.exitCode = run([path.join(output, "scripts/validate-config.js"), ...args]);
  } else {
    const files = (await readdir(path.join(root, "tests/unit")))
      .filter((file) => file.endsWith(".test.ts"))
      .sort();

    if (files.length === 0) {
      throw new Error("Nessun test unitario trovato.");
    }
    process.exitCode = run([
      "--test",
      ...files.map((file) => path.join(output, "tests/unit", file.replace(/\.ts$/, ".js"))),
      ...args,
    ]);
  }
} finally {
  await rm(output, {
    recursive: true,
    force: true,
  });
}
