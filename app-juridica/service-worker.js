const CACHE_NAME = "vemalex-sesiones-v6";
const APP_SHELL = "./";
const APP_ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=web-install-2",
  "./app.js?v=web-install-2",
  "./config.js?v=web-install-2",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "../assets/logo-vemalex.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(APP_ASSETS.map((asset) => cache.add(asset)))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(APP_SHELL).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached || fetch(event.request)
    )
  );
});
