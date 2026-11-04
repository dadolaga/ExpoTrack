// The production build embeds this function with an immutable asset list.
export function installOfflineWorker(scope, configuration) {
  const prefix = "expotrack-shell-";
  const name = `${prefix}${configuration.version}`;
  const assets = new Set(configuration.assets);

  scope.addEventListener("install", (event) => {
    event.waitUntil((async () => {
      const cache = await scope.caches.open(name);

      try {
        for (const asset of configuration.assets) {
          const response = await scope.fetch(asset, {
            cache: "reload",
          });

          if (!response.ok || response.redirected) {
            throw new Error(`Preparazione offline incompleta: ${asset}`);
          }
          await cache.put(asset, response);
        }
      } catch (error) {
        scope.console.error(error);
        await scope.caches.delete(name);

        throw error;
      }
    })());
  });

  // No skipWaiting: an update takes over only after all old tabs are closed.
  // Activation touches shell caches only, never IndexedDB, outbox or photos.
  scope.addEventListener("activate", (event) => {
    event.waitUntil((async () => {
      const keys = await scope.caches.keys();

      await Promise.all(keys.filter((key) => key.startsWith(prefix) && key !== name)
        .map((key) => scope.caches.delete(key)));
      await scope.clients.claim();
    })());
  });

  scope.addEventListener("fetch", (event) => {
    const request = event.request;
    const url = new URL(request.url);

    if (request.method !== "GET" || url.origin !== scope.location.origin || url.pathname.startsWith("/api/")) {
      return;
    }
    if (request.mode === "navigate" && !url.pathname.startsWith("/examples")) {
      // One complete, versioned client shell handles every local entity ID.
      event.respondWith((async () => {
        const cache = await scope.caches.open(name);

        return (await cache.match("/offline")) ?? scope.fetch(request);
      })());
    } else if (assets.has(url.pathname)) {
      event.respondWith((async () => {
        const cache = await scope.caches.open(name);

        return (await cache.match(url.pathname)) ?? scope.fetch(request);
      })());
    } else if (request.headers.get("RSC") === "1") {
      // The initial online page may still have the Next router. A failed RSC
      // request makes it perform a document navigation into the cached shell.
      event.respondWith(scope.fetch(request));
    }
  });
}
