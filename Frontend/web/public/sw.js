// Mind Constructor's service worker: what makes the app installable, and what
// lets it open instantly — or with no connection at all — from its own copy
// of the app's files. Map data is never cached here: /api always goes to the
// network, and the app itself keeps its own offline copy of maps and the
// changes waiting to be sent (src/offline/sync.ts).
//
// Bump VERSION to drop every old cached file on the next visit.
const VERSION = "v2";
const CACHE = `mc-${VERSION}`;
const SHELL = ["/", "/manifest.webmanifest", "/icons/icon.svg", "/icons/icon-192.png", "/icons/icon-512.png"];

// The built JS/CSS the current page links to. The very first visit loads
// them before this worker is running, so without fetching them here too the
// app's page would be cached but its code wouldn't, and it couldn't start offline.
async function builtAssets() {
  try {
    const html = await (await fetch("/", { cache: "no-cache" })).text();
    return [...new Set(html.match(/\/assets\/[^"'\s)]+/g) ?? [])];
  } catch {
    return [];
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(async (cache) => {
        await cache.addAll(SHELL);
        await Promise.all((await builtAssets()).map((url) => cache.add(url).catch(() => {})));
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("mc-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Only this app's own files; the API, live updates and other sites go straight through.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/socket.io")) return;

  // Pages: the newest from the network, the cached app when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put("/", copy));
          return response;
        })
        .catch(() => caches.match("/")),
    );
    return;
  }

  // Built files carry a hash in their name and never change: cache first.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // Everything else (icons, the manifest): the cached copy now, a fresh one for next time.
  event.respondWith(
    caches.match(request).then((cached) => {
      const fresh = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fresh;
    }),
  );
});
