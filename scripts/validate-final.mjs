import { spawn } from "node:child_process";
import {
  mkdir, readFile, stat, writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

export const requirements = [
  ["catalog-and-domain", "test:unit"],
  ["profile-event-isolation", "test:integration"],
  ["local-persistence", "test:integration"],
  ["server-contracts", "test:integration"],
  ["sync-integrity", "test:integration"],
  ["media-integrity", "test:integration"],
  ["profiles-and-dashboard", "test:e2e"],
  ["stands", "test:e2e"],
  ["products-and-questionnaires", "test:e2e"],
  ["photo-workflow", "test:e2e"],
  ["offline-pwa-multidevice", "test:e2e"],
  ["accessibility-and-mobile-scope", "test:e2e"],
];

export const deviceChecks = [
  "android-pwa",
  "camera-and-storage",
  "mobile-usability",
];

const scripts = [
  "lint",
  "typecheck",
  "test:unit",
  "test:integration",
  "build",
  "test:e2e",
];

async function existingFile(root, relativePath, testFile = false) {
  if (typeof relativePath !== "string" || !relativePath.trim()) {
    return false;
  }
  const resolved = path.resolve(root, relativePath);
  const relative = path.relative(root, resolved);

  if (path.isAbsolute(relativePath) || relative === ".." || relative.startsWith(`..${path.sep}`)) {
    return false;
  }
  if (testFile && !/\.(test|spec)\.[cm]?[jt]sx?$/.test(relativePath)) {
    return false;
  }
  try {
    const entry = await stat(resolved);

    return entry.isFile() && entry.size > 0;
  } catch {
    return false;
  }
}

async function preflight(root, environment) {
  const issues = [];
  const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const evidence = JSON.parse(
    await readFile(path.join(root, "validation/final-evidence.json"), "utf8"),
  );

  try {
    const target = new URL(environment.TEST_DATABASE_URL);

    if (
      !["postgres:", "postgresql:"].includes(target.protocol)
      || !/(?:^|_)test(?:_|$)/.test(decodeURIComponent(target.pathname.slice(1)))
    ) {
      issues.push("TEST_DATABASE_URL deve identificare un database PostgreSQL dedicato, con segmento test nel nome.");
    }
    if (environment.DATABASE_URL) {
      const current = new URL(environment.DATABASE_URL);

      if (
        current.hostname === target.hostname
        && (current.port || "5432") === (target.port || "5432")
        && decodeURIComponent(current.pathname) === decodeURIComponent(target.pathname)
      ) {
        issues.push("Il database di test coincide con DATABASE_URL: usare un database isolato.");
      }
    }
  } catch {
    issues.push("Configurare TEST_DATABASE_URL con una connessione PostgreSQL di test valida.");
  }

  for (const script of scripts) {
    const command = pkg.scripts?.[script];

    if (typeof command !== "string" || !command.trim()) {
      issues.push(`Comando npm mancante: ${script}`);
    } else if (/--(?:passWithNoTests|if-present)\b/.test(command)) {
      issues.push(`Il comando ${script} permette di ignorare test mancanti.`);
    }
  }

  for (const [id] of requirements) {
    const files = evidence.automated?.[id];

    if (!Array.isArray(files) || files.length === 0) {
      issues.push(`Copertura non collegata: ${id}`);
      continue;
    }
    for (const file of files) {
      if (!(await existingFile(root, file, true))) {
        issues.push(`File di test non valido per ${id}: ${String(file)}`);
      }
    }
  }

  const manual = [];

  for (const id of deviceChecks) {
    const entry = evidence.manual?.[id];
    const status = entry?.status;

    if (![
      "pending", "passed", "failed",
    ].includes(status)) {
      issues.push(`Stato verifica dispositivo non valido: ${id}`);
    }
    if (status === "passed") {
      if (!Array.isArray(entry.evidence) || entry.evidence.length === 0) {
        issues.push(`Verifica ${id} dichiarata superata senza evidenze.`);
      } else {
        for (const file of entry.evidence) {
          if (!(await existingFile(root, file))) {
            issues.push(`Evidenza non trovata per ${id}: ${String(file)}`);
          }
        }
      }
    }
    manual.push({
      id,
      status: status ?? "pending",
      evidence: entry?.evidence ?? [],
    });
  }

  return {
    issues,
    coverage: evidence.automated,
    manual,
  };
}

function runNpmScript(script, root, environment) {
  console.log(`\n[validate:final] npm run ${script}`);

  return new Promise((resolve) => {
    const npmCli = environment.npm_execpath;
    const fallbackCommand = process.platform === "win32" ? "npm.cmd" : "npm";
    const child = spawn(
      npmCli ? process.execPath : fallbackCommand,
      npmCli ? [
        npmCli, "run", script,
      ] : ["run", script],
      {
        cwd: root,
        stdio: "inherit",
        shell: !npmCli && process.platform === "win32",
        env: {
          ...environment,
          DATABASE_URL: environment.TEST_DATABASE_URL,
          CI: "1",
          EXPOTRACK_FINAL_VALIDATION: "1",
        },
      },
    );

    child.once("error", (error) => resolve({
      exitCode: 1,
      error: error.message,
    }));
    child.once("close", (code, signal) =>
      resolve({
        exitCode: code ?? 1,
        signal,
      }));
  });
}

export async function validateFinal({
  root = projectRoot,
  preflightOnly = false,
  runScript = runNpmScript,
  environment = process.env,
} = {}) {
  const startedAt = new Date().toISOString();
  const report = {
    startedAt,
    mode: preflightOnly ? "preflight" : "full",
    status: "not-ready",
    automatedStatus: "not-run",
    issues: [],
    checks: [],
    coverage: {},
    manual: [],
  };

  try {
    Object.assign(report, await preflight(root, environment));
  } catch (error) {
    report.issues.push(`Preparazione fallita: ${error.message}`);
  }

  if (report.issues.length === 0 && preflightOnly) {
    report.status = "preflight-only";
  } else if (report.issues.length === 0) {
    for (const script of scripts) {
      if (
        script === "test:e2e"
        && !report.checks.some((check) => check.script === "build" && check.status === "passed")
      ) {
        report.checks.push({
          script,
          status: "not-run",
          reason: "Build fallita.",
        });
        continue;
      }
      const start = Date.now();
      let result;

      try {
        result = await runScript(script, root, environment);
      } catch (error) {
        result = {
          exitCode: 1,
          error: error.message,
        };
      }
      report.checks.push({
        script,
        ...result,
        status: result.exitCode === 0 ? "passed" : "failed",
        durationMs: Date.now() - start,
      });
    }
    report.automatedStatus = report.checks.every((check) => check.status === "passed")
      ? "passed"
      : "failed";
    if (report.automatedStatus === "failed" || report.manual.some((check) => check.status === "failed")) {
      report.status = "failed";
    } else if (report.manual.every((check) => check.status === "passed")) {
      report.status = "passed";
    } else {
      report.status = "incomplete";
    }
  }

  report.finishedAt = new Date().toISOString();
  report.exitCode = 1;
  if (["passed", "preflight-only"].includes(report.status)) {
    report.exitCode = 0;
  } else if (report.status === "incomplete") {
    report.exitCode = 2;
  }
  const output = path.join(root, "validation-results", startedAt.replace(/[:.]/g, "-"));

  await mkdir(output, {
    recursive: true,
  });
  const reportPath = path.join(output, "report.json");

  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  return {
    report,
    reportPath,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);

  if (args.includes("--help")) {
    console.log("npm run validate:final [-- --preflight]\n--preflight verifica soltanto i prerequisiti, senza validare l’app.");
  } else if (args.some((arg) => arg !== "--preflight")) {
    console.error("Opzione non riconosciuta. Usare --help.");
    process.exitCode = 1;
  } else {
    try {
      const { report, reportPath } = await validateFinal({
        preflightOnly: args.includes("--preflight"),
      });

      for (const issue of report.issues) {
        console.error(`- ${issue}`);
      }
      console.log(`\nEsito: ${report.status}; controlli automatici: ${report.automatedStatus}`);
      for (const check of report.manual) {
        console.log(`Dispositivo: ${check.id}: ${check.status}`);
      }
      console.log(`Report: ${reportPath}`);
      process.exitCode = report.exitCode;
    } catch (error) {
      console.error(`Validazione interrotta: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
