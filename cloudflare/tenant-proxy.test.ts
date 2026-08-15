import { afterEach, describe, expect, it, vi } from "vitest";

import worker from "./tenant-proxy";

afterEach(() => vi.unstubAllGlobals());

describe("Cloudflare Vercel gateway", () => {
  it("preserves immutable Next.js asset caching", async () => {
    const origin = vi.fn(async () =>
      new Response("chunk", {
        headers: { "cache-control": "public, max-age=31536000, immutable" },
      }),
    );
    vi.stubGlobal("fetch", origin);

    const response = await worker.fetch(
      new Request("https://app.whatscart.in/_next/static/chunks/app.123.js"),
    );
    expect(origin).toHaveBeenCalledOnce();
    expect(response.headers.get("cache-control")).toContain("immutable");
  });

  it("bypasses edge storage and preserves Next.js request headers", async () => {
    let forwarded: Request | undefined;
    vi.stubGlobal("fetch", vi.fn(async (request: Request) => {
      forwarded = request;
      return new Response("rsc", { headers: { "content-type": "text/x-component" } });
    }));

    const response = await worker.fetch(
      new Request("https://store.whatscart.in/products/saree", {
        headers: {
          "next-router-state-tree": "tree",
          rsc: "1",
        },
      }),
    );
    expect(forwarded?.cache).toBe("no-store");
    expect(forwarded?.headers.get("rsc")).toBe("1");
    expect(forwarded?.headers.get("next-router-state-tree")).toBe("tree");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("cloudflare-cdn-cache-control")).toBe(
      "no-store",
    );
  });
});
