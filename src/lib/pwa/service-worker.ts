export function serviceWorkerSource(deploymentVersion: string) {
  const version = JSON.stringify(`whatscart-${deploymentVersion}`);
  return `const CACHE_VERSION = ${version};\n` + String.raw`
const CACHE_PREFIX = "whatscart-";
const LEGACY_CACHE_NAMES = new Set([
  "images-cache",
  "convex-api-live",
  "clerk-auth",
]);
const LEGACY_CACHE_PREFIXES = ["workbox-precache-", "workbox-runtime-"];
const OFFLINE_ASSETS = [
  "/manifest.webmanifest",
  "/app-icon-512x512.png",
  "/pwa-192x192.png",
  "/pwa-512x512.png",
];

async function cacheSuccessful(request, response) {
  if (response.ok) {
    const cache = await caches.open(CACHE_VERSION);
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request, fallback) {
  try {
    return await cacheSuccessful(request, await fetch(request));
  } catch {
    const cache = await caches.open(CACHE_VERSION);
    return (await cache.match(request)) || (fallback ? cache.match(fallback) : undefined);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(OFFLINE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                (key.startsWith(CACHE_PREFIX) && key !== CACHE_VERSION) ||
                LEGACY_CACHE_NAMES.has(key) ||
                LEGACY_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)),
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") void self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (
    url.pathname.startsWith("/api/") ||
    url.pathname === "/sw.js" ||
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("firebaseio.com")
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "/"));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(CACHE_VERSION).then((cache) => cache.match(request)).then(
        (cached) => cached || fetch(request).then((response) => cacheSuccessful(request, response)),
      ),
    );
    return;
  }

  if (request.destination === "image") {
    event.respondWith(networkFirst(request));
  }
});
`;
}
