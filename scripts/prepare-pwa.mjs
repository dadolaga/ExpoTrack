import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";

async function staticAssets(directory, prefix) {
  const entries = await readdir(directory, {
    withFileTypes: true,
  });
  const nested = await Promise.all(entries.map(async (entry) => {
    if (entry.isDirectory()) {
      return staticAssets(`${directory}/${entry.name}`, `${prefix}/${entry.name}`);
    }

    return entry.name.endsWith(".map") ? [] : [`${prefix}/${entry.name}`];
  }));

  return nested.flat().sort();
}

const assets = [
  "/offline",
  "/manifest.webmanifest",
  "/brand/expotrack-icon.png",
  "/brand/pwa-192.png",
  "/brand/pwa-512.png",
  "/brand/apple-touch-icon.png",
  ...await staticAssets(".next/static", "/_next/static"),
];
const build = await readFile(".next/BUILD_ID", "utf8");
const template = await readFile("src/lib/pwa/service-worker.js", "utf8");
const version = createHash("sha256").update(build).update(template).digest("hex").slice(0, 20);
const configuration = JSON.stringify({
  version,
  assets,
});

await writeFile("public/sw.js", `${template.replace("export function", "function")}\ninstallOfflineWorker(self, ${configuration});\n`);
console.log(`PWA: ${assets.length} risorse nella shell ${version}.`);
