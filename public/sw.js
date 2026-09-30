const CACHE = "orbis-shell-v3";
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(async cache => {
    await cache.addAll(["/", "/favicon.svg", "/manifest.webmanifest"]);
    const manifest = await fetch("/offline-assets.json", { cache: "no-store" });
    if (!manifest.ok) throw new Error("Arquivos offline indisponíveis.");
    const assets = await manifest.json();
    await cache.addAll(assets);
  }));
  self.skipWaiting();
});
self.addEventListener("activate", event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("orbis-shell-") && key !== CACHE).map(key => caches.delete(key)))),
    self.clients.claim(),
  ]));
});
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then(response => {
      if (response.ok && response.headers.get("content-type")?.includes("text/html")) {
        const copy = response.clone();
        void caches.open(CACHE).then(cache => cache.put("/", copy));
      }
      return response;
    }).catch(async () => (await caches.match("/")) || Response.error()));
    return;
  }
  if (!url.pathname.startsWith("/_next/") && !url.pathname.startsWith("/assets/")) return;
  event.respondWith(caches.match(request).then(hit => hit || fetch(request).then(response => {
    if (response.ok) {
      const copy = response.clone();
      void caches.open(CACHE).then(cache => cache.put(request, copy));
    }
    return response;
  })));
});
