// @vitest-environment node

import { describe, expect, it } from "vitest";

import { serviceWorkerSource } from "../service-worker";

describe("deployment service worker", () => {
  it("changes its cache namespace with every deployment", () => {
    expect(serviceWorkerSource("deployment-a")).toContain(
      'const CACHE_VERSION = "whatscart-deployment-a"',
    );
    expect(serviceWorkerSource("deployment-b")).not.toBe(
      serviceWorkerSource("deployment-a"),
    );
  });

  it("activates updates immediately and removes old application caches", () => {
    const source = serviceWorkerSource("current");

    expect(source).toContain("self.skipWaiting()");
    expect(source).toContain("self.clients.claim()");
    expect(source).toContain("key !== CACHE_VERSION");
    expect(source).toContain("caches.delete(key)");
    expect(source).toContain('"images-cache"');
    expect(source).toContain('"workbox-precache-"');
  });

  it("uses the network for mutable pages, images, APIs, and Firebase", () => {
    const source = serviceWorkerSource("current");

    expect(source).toContain('request.mode === "navigate"');
    expect(source).toContain("event.respondWith(networkFirst(request, \"/\"))");
    expect(source).toContain('request.destination === "image"');
    expect(source).toContain("event.respondWith(networkFirst(request))");
    expect(source).toContain('url.pathname.startsWith("/api/")');
    expect(source).toContain('url.hostname.includes("googleapis.com")');
  });

  it("uses cache-first only for Next.js content-hashed static assets", () => {
    const source = serviceWorkerSource("current");

    expect(source).toContain('url.pathname.startsWith("/_next/static/")');
    expect(source.match(/cached \|\| fetch/g)).toHaveLength(1);
    expect(source).not.toContain("caches.match(");
    expect(source).toContain("cache.match(request)");
  });
});
