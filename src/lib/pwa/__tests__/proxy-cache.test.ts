// @vitest-environment node

import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";

import { proxy } from "../../../proxy";

const previousRootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;

afterEach(() => {
  if (previousRootDomain === undefined) {
    delete process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  } else {
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = previousRootDomain;
  }
});

function tenantRequest(pathname: string) {
  return new NextRequest(`https://demo-store.whatscart.in${pathname}`, {
    headers: { host: "demo-store.whatscart.in" },
  });
}

describe("tenant cache routing", () => {
  it("rewrites tenant pages and prevents edge caching", () => {
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = "whatscart.in";
    const response = proxy(tenantRequest("/products/green-shirt"));

    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "https://demo-store.whatscart.in/sites/demo-store/products/green-shirt",
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("cdn-cache-control")).toBe("no-store");
    expect(response.headers.get("vercel-cdn-cache-control")).toBe("no-store");
  });

  it.each([
    "/sw.js",
    "/api/public/uploads/authorize",
    "/_next/static/chunks/app.js",
    "/manifest.webmanifest",
    "/app-icon-512x512.png",
    "/.well-known/assetlinks.json",
  ])("does not rewrite shared infrastructure path %s", (pathname) => {
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = "whatscart.in";
    const response = proxy(tenantRequest(pathname));

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it.each(["/robots.txt", "/sitemap.xml"])(
    "keeps tenant SEO path %s on the tenant route",
    (pathname) => {
      process.env.NEXT_PUBLIC_ROOT_DOMAIN = "whatscart.in";
      const response = proxy(tenantRequest(pathname));

      expect(response.headers.get("x-middleware-rewrite")).toContain(
        `/sites/demo-store${pathname}`,
      );
    },
  );
});
