import { NextResponse } from "next/server";

// A worker installed by an earlier production build can keep serving that
// cached shell on localhost even while `next dev` serves the updated sources.
// Replace it with a worker without a fetch handler, then unregister it.
// Existing documents and all local user data are preserved.
const developmentWorker = `
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    await self.clients.claim();
    await self.registration.unregister();
  })());
});
`;

export function proxy() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.next();
  }

  return new NextResponse(developmentWorker, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
      "Service-Worker-Allowed": "/",
    },
  });
}

export const config = {
  matcher: "/sw.js",
};
