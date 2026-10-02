// Bump this version whenever an app-shell file changes. Installation is atomic:
// a failed download leaves the previous active worker and its cache available.
const VERSION = "2026-10-02-1";
const scope = new URL(self.registration.scope);
const prefix = `giza-guide:${scope.pathname}:`;
const cacheName = `${prefix}${VERSION}`;
const shell = [
  "./",
  "index.html",
  "style.css",
  "app.mjs",
  "places.mjs",
  "offline.mjs",
].map((path) => new URL(path, scope).href);

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(cacheName);
      try {
        await cache.addAll(
          shell.map(
            (url) =>
              new Request(url, {
                cache: "reload",
                redirect: "error",
                credentials: "same-origin",
              }),
          ),
        );
      } catch (error) {
        await caches.delete(cacheName);
        throw error;
      }
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith(prefix) && name !== cacheName)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "ACTIVATE_UPDATE") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== scope.origin) return;
  url.search = "";
  url.hash = "";
  if (!shell.includes(url.href)) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(cacheName);
      return (await cache.match(url.href)) || fetch(event.request);
    })(),
  );
});
