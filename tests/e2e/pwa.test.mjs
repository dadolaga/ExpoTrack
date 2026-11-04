import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  mkdtemp, readFile, rm, writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import { chromium } from "playwright";
import sharp from "sharp";

const require = createRequire(import.meta.url);

async function until(check, label, timeout = 45000) {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    if (await check()) {
      return;
    }
    await delay(100);
  }
  assert.fail(`Timeout: ${label}`);
}

async function records(page, store) {
  return page.evaluate((name) => new Promise((resolve, reject) => {
    const request = indexedDB.open("expotrack-local");

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(name);
      const all = transaction.objectStore(name).getAll();

      all.onsuccess = () => resolve(all.result);
      all.onerror = () => reject(all.error);
      transaction.oncomplete = () => db.close();
    };
  }), store);
}

async function select(page, base) {
  await page.goto(`${base}/profiles`);
  await page.getByRole("button", {
    name: "Usa il profilo Io · demo",
    exact: true,
  }).click();
  await page.getByRole("heading", {
    name: "La tua visita",
    exact: true,
  }).waitFor();
}

async function ready(page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (navigator.serviceWorker.controller === null) {
      await new Promise((resolve) => {
        navigator.serviceWorker.addEventListener("controllerchange", resolve, {
          once: true,
        });
      });
    }
  });
}

test("shell di produzione: preparazione, raccolta e riapertura offline, sync e aggiornamento senza perdita", {
  timeout: 240000,
}, async (context) => {
  // The runner compiles the real PostgreSQL fixture; it creates a unique DB and
  // temporary media and never imports into development or production archives.
  const { syncFixture } = require(path.join(process.env.EXPOTRACK_TEST_TOOLS, "tests/server/fixture.js"));
  const cleanups = [];
  const fixture = await syncFixture({
    after: (cleanup) => cleanups.push(cleanup),
  });
  const directory = await mkdtemp(path.join(tmpdir(), "expotrack-pwa-"));
  const workerPath = path.resolve("public/sw.js");
  const originalWorker = await readFile(workerPath, "utf8");

  assert.ok((await readFile(".next/BUILD_ID", "utf8")).trim());
  const socket = createServer();

  socket.listen(0, "127.0.0.1");
  await once(socket, "listening");
  const port = socket.address().port;

  await new Promise((resolve) => {
    socket.close(resolve);
  });
  const base = `http://127.0.0.1:${port}`;
  const logs = [];
  const server = spawn(process.execPath, [
    "node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port),
  ], {
    env: {
      ...process.env,
      DATABASE_URL: fixture.pool.options.connectionString,
      MEDIA_ROOT: path.join(fixture.directory, "media"),
    },
    stdio: [
      "ignore", "pipe", "pipe",
    ],
  });

  server.stdout.on("data", (data) => logs.push(String(data)));
  server.stderr.on("data", (data) => logs.push(String(data)));
  let browser;
  const errors = [];
  const options = {
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    args: ["--no-sandbox"],
    viewport: {
      width: 390,
      height: 844,
    },
  };

  function monitor(page) {
    page.on("pageerror", (error) => errors.push(error.message));
    page.setDefaultTimeout(20000);
  }

  context.after(async () => {
    await browser?.close();
    server.kill("SIGTERM");
    if (server.exitCode === null) {
      await once(server, "exit");
    }
    await writeFile(workerPath, originalWorker);
    for (const cleanup of cleanups) {
      await cleanup();
    }
    await rm(directory, {
      recursive: true,
      force: true,
    });
  });
  await until(async () => {
    try {
      return (await fetch(`${base}/api/v1/bootstrap`)).ok;
    } catch {
      return false;
    }
  }, `avvio produzione: ${logs.join("")}`);
  browser = await chromium.launchPersistentContext(path.join(directory, "phone"), options);
  let page = await browser.newPage();

  monitor(page);
  await select(page, base);
  await ready(page);
  const manifest = await (await fetch(`${base}/manifest.webmanifest`)).json();

  assert.equal(manifest.display, "standalone");
  for (const icon of manifest.icons) {
    const response = await fetch(`${base}${icon.src}`);

    assert.ok(response.ok);
    const image = await sharp(Buffer.from(await response.arrayBuffer())).metadata();

    assert.equal(`${image.width}x${image.height}`, icon.sizes);
  }
  // Browser installability evidence, separate from the pending physical phone.
  const cdp = await browser.newCDPSession(page);

  await cdp.send("Page.enable");
  const installability = await cdp.send("Page.getInstallabilityErrors");

  assert.deepEqual(installability.installabilityErrors, []);
  await browser.setOffline(true);
  // The current document still has the normal Next router. A previously unseen
  // route must enter the cached shell without waiting for any server payload.
  await page.getByRole("link", {
    name: "Prodotti",
    exact: true,
  }).click();
  await page.waitForURL(`${base}/products`);
  await page.reload();
  await page.getByRole("link", {
    name: "Prodotti",
    exact: true,
  }).waitFor();
  await page.getByRole("link", {
    name: "Stand",
    exact: true,
  }).click();
  await page.waitForURL(`${base}/stands`);
  await page.goto(`${base}/stands/demo-bags`);
  await page.getByRole("textbox", {
    name: "Nuova cosa da vedere",
    exact: true,
  }).fill("Controllo raccolto offline");
  await page.getByRole("button", {
    name: "Aggiungi elemento alla checklist",
    exact: true,
  }).click();
  await page.getByRole("checkbox", {
    name: "Controllo raccolto offline",
    exact: true,
  }).click();
  await until(() => page.getByRole("checkbox", {
    name: "Controllo raccolto offline",
    exact: true,
  }).isChecked(), "checklist salvata offline");
  await page.getByRole("link", {
    name: "Apri note stand",
    exact: true,
  }).click();
  await page.getByRole("textbox", {
    name: "Note personali sullo stand",
    exact: true,
  }).fill("Nota da conservare senza rete");
  // The existing exit guard must flush the write before client navigation.
  await page.getByRole("main").getByRole("button", {
    name: "Torna al dettaglio stand",
    exact: true,
  }).click();
  await page.getByRole("link", {
    name: "Apri note stand",
    exact: true,
  }).click();
  assert.equal(await page.getByRole("textbox", {
    name: "Note personali sullo stand",
    exact: true,
  }).inputValue(), "Nota da conservare senza rete");
  await page.goto(`${base}/products/new?stand=demo-bags&source=catalog`);
  await page.getByRole("textbox", {
    name: /Nome prodotto/,
  }).fill("Raccolta offline PWA");
  const category = page.getByRole("combobox", {
    name: /Categoria/,
  });

  assert.equal(await category.evaluate((element) => element.tagName), "INPUT");
  await page.getByRole("button", {
    name: "Apri elenco categorie",
    exact: true,
  }).click();
  assert.equal(await page.getByRole("option").count(), 3);
  await category.fill("categoria inesistente");
  await page.getByRole("status").filter({
    hasText: "Nessuna categoria trovata.",
  }).waitFor();
  await category.fill("bOr");
  await page.getByRole("option", {
    name: "Borse · demo",
    exact: true,
  }).click();
  assert.equal(await category.inputValue(), "Borse · demo");
  await page.getByLabel("Prezzo (€)", {
    exact: true,
  }).fill("0");
  await page.getByRole("button", {
    name: /Aggiungi voto: Valutazione/,
  }).click();
  await page.getByRole("slider", {
    name: "Valutazione",
    exact: true,
  }).fill("8");
  await page.getByRole("button", {
    name: /Descrizione personale/,
  }).click();
  await page.getByRole("textbox", {
    name: /Descrizione personale del prodotto/,
  }).fill("Testo conservato dopo riavvio senza rete");
  await page.getByRole("button", {
    name: "Torna al prodotto",
    exact: true,
  }).last().click();
  await page.getByRole("button", {
    name: /Fotografie/,
  }).click();
  const bytes = await sharp({
    create: {
      width: 24,
      height: 16,
      channels: 3,
      background: "#2289b0",
    },
  }).jpeg().toBuffer();

  await page.locator("input[type=file]").last().setInputFiles({
    name: "originale-pwa.jpg",
    mimeType: "image/jpeg",
    buffer: bytes,
  });
  await page.getByRole("button", {
    name: /Apri foto 1/,
  }).waitFor();
  await until(async () => (await records(page, "outbox")).some((operation) => operation.entityType === "photo"), "foto accodata offline");
  const product = (await records(page, "products")).find((entry) => entry.input.name === "Raccolta offline PWA");

  assert.ok(product?.lastValid);
  assert.equal(product.lastValid.price, 0);
  await page.getByRole("button", {
    name: "Torna al prodotto",
    exact: true,
  }).last().click();
  const editorUrl = page.url();
  const pending = (await records(page, "outbox")).map((entry) => entry.operationId ?? entry.id).sort();

  await page.reload();
  await page.getByRole("textbox", {
    name: /Nome prodotto/,
  }).waitFor();
  assert.equal(await page.getByRole("textbox", {
    name: /Nome prodotto/,
  }).inputValue(), "Raccolta offline PWA");
  await browser.close();
  browser = await chromium.launchPersistentContext(path.join(directory, "phone"), options);
  await browser.setOffline(true);
  page = await browser.newPage();
  monitor(page);
  await page.goto(editorUrl);
  await page.getByRole("textbox", {
    name: /Nome prodotto/,
  }).waitFor();
  assert.equal(await page.getByRole("slider", {
    name: "Valutazione",
    exact: true,
  }).inputValue(), "8");
  assert.deepEqual((await records(page, "outbox")).map((entry) => entry.operationId ?? entry.id).sort(), pending);
  await page.getByRole("button", {
    name: /Fotografie/,
  }).click();
  await page.getByRole("button", {
    name: /Apri foto 1/,
  }).click();
  assert.ok(await page.getByRole("dialog").isVisible());
  const assets = await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open("expotrack-local");

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction("photo_assets");
      const all = transaction.objectStore("photo_assets").getAll();

      all.onsuccess = async () => {
        const original = all.result[0].original;

        resolve(Array.from(new Uint8Array(await original.arrayBuffer())));
      };
      transaction.oncomplete = () => db.close();
    };
  }));

  assert.deepEqual(Buffer.from(assets), bytes);
  await browser.setOffline(false);
  await page.goto(`${base}/sync`);
  await page.getByRole("heading", {
    name: "Uso senza rete",
    exact: true,
  }).waitFor();
  await until(async () => (await records(page, "outbox")).length === 0, "sync automatica al ritorno online", 60000);
  const collection = await fixture.repository.collection("me", "fiera-demo-2026");

  assert.ok(collection.products.some((entry) => entry.data.id === product.id));
  assert.ok(collection.photos.some((entry) => entry.mediaStatus === "ready"));
  // An update cannot replace the running shell, even with a queued local edit.
  await browser.setOffline(true);
  await page.goto(`${base}/products/${product.id}`);
  await page.getByRole("textbox", {
    name: /Nome prodotto/,
  }).fill("Conservato durante aggiornamento");
  await until(async () => (await records(page, "outbox")).length > 0, "modifica in coda prima aggiornamento");

  await writeFile(workerPath, originalWorker.replace(/"version":"([^"]+)"/, '"version":"$1-update"'));
  assert.match(await (await fetch(`${base}/sw.js`)).text(), /-update/);
  // Keep API requests disconnected while allowing the shell update download.
  await browser.route((url) => url.pathname.startsWith("/api/v1/"), (route) => route.abort());
  await browser.setOffline(false);
  const updateErrors = [];
  const updateSession = await browser.newCDPSession(page);

  await updateSession.send("ServiceWorker.enable");
  updateSession.on("ServiceWorker.workerErrorReported", (event) => updateErrors.push(event));
  browser.on("console", (message) => {
    if (message.type() === "error") {
      updateErrors.push(message.text());
    }
  });
  assert.match(await page.evaluate(async () => (await fetch("/sw.js", {
    cache: "no-store",
  })).text()), /-update/);
  await page.evaluate(async () => {
    await (await navigator.serviceWorker.getRegistration()).update();
  });
  try {
    await until(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).waiting !== null), "nuova shell in attesa");
  } catch (error) {
    context.diagnostic(JSON.stringify(updateErrors));
    context.diagnostic(JSON.stringify(await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();

      return {
        active: registration.active?.state,
        installing: registration.installing?.state,
        waiting: registration.waiting?.state,
        caches: await caches.keys(),
      };
    })));

    throw error;
  }
  assert.ok(await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();

    return navigator.serviceWorker.controller === registration.active && registration.waiting !== registration.active;
  }));
  assert.ok((await records(page, "outbox")).length > 0);
  await page.goto(`${base}/sync`);
  await page.getByText(/Nuova versione pronta/).waitFor();
  await browser.close();
  browser = await chromium.launchPersistentContext(path.join(directory, "phone"), options);
  await browser.setOffline(true);
  page = await browser.newPage();
  monitor(page);
  await page.goto(`${base}/products/${product.id}`);
  await page.getByRole("textbox", {
    name: /Nome prodotto/,
  }).waitFor();
  assert.equal(await page.getByRole("textbox", {
    name: /Nome prodotto/,
  }).inputValue(), "Conservato durante aggiornamento");
  assert.ok((await records(page, "outbox")).length > 0);
  assert.ok((await records(page, "photo_assets")).length > 0);
  await until(() => page.evaluate(async () => (await caches.keys()).some((key) => key.endsWith("-update"))), "nuova versione attiva offline");
  await browser.close();
  browser = await chromium.launchPersistentContext(path.join(directory, "unprepared"), options);
  await browser.route((url) => url.pathname.startsWith("/api/v1/"), (route) => route.abort());
  page = await browser.newPage();
  monitor(page);
  await page.goto(`${base}/offline`);
  await page.getByRole("heading", {
    name: "Profili non disponibili",
    exact: true,
  }).waitFor();
  await ready(page);
  await browser.setOffline(true);
  await page.reload();
  await page.getByRole("button", {
    name: "Riprova",
    exact: true,
  }).waitFor();
  assert.ok((await page.getByRole("status").allTextContents()).some((message) => message.includes("primo accesso")));
  assert.deepEqual(errors, []);
});
