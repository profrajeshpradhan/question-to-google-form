/* Question to Google Form — service worker.
 *
 * Caching rules:
 *  - Never cache /api/* (auth callbacks, sessions, tokens, form creation) or /dashboard / /login
 *    (authenticated or session-dependent pages). These always go to the network.
 *  - Build assets (/_next/static/*) and icons: cache-first (they are content-hashed / static).
 *  - Public pages: network-first; when offline, fall back to a cached copy or the /offline page.
 */
const VERSION = "v1";
const STATIC_CACHE = `qgf-static-${VERSION}`;
const PAGE_CACHE = `qgf-pages-${VERSION}`;
const OFFLINE_URL = "/offline";
const PUBLIC_PAGES = ["/", "/privacy", "/terms", "/support", OFFLINE_URL];
const NEVER_CACHE = [/^\/api\//, /^\/dashboard/, /^\/login/];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PAGE_CACHE).then((cache) => cache.addAll([OFFLINE_URL])).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("qgf-") && ![STATIC_CACHE, PAGE_CACHE].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (NEVER_CACHE.some((re) => re.test(url.pathname))) {
    // Network only. For page navigations, show the offline page if the network is down.
    if (request.mode === "navigate") {
      event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    }
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && PUBLIC_PAGES.includes(url.pathname)) {
            const copy = response.clone();
            caches.open(PAGE_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match(OFFLINE_URL))),
    );
  }
});
