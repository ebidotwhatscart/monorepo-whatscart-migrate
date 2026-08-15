const IMMUTABLE_NEXT_ASSET = /^\/_next\/static\//;

function isImmutableAsset(pathname: string) {
  return IMMUTABLE_NEXT_ASSET.test(pathname);
}

function withFreshDeploymentHeaders(response: Response) {
  const headers = new Headers(response.headers);
  headers.set(
    "cache-control",
    "private, no-cache, no-store, max-age=0, must-revalidate",
  );
  headers.set("cdn-cache-control", "no-store");
  headers.set("cloudflare-cdn-cache-control", "no-store");
  headers.set("vercel-cdn-cache-control", "no-store");
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

export default {
  async fetch(request: Request): Promise<Response> {
    const pathname = new URL(request.url).pathname;

    // Next.js content-hashed chunks are immutable and safe to cache. Every
    // other response bypasses Cloudflare's cache so Vercel receives the
    // original Host, RSC, prefetch, cookie, and authorization headers.
    if (isImmutableAsset(pathname)) return fetch(request);

    const response = await fetch(new Request(request, { cache: "no-store" }));
    return withFreshDeploymentHeaders(response);
  },
};

export { isImmutableAsset, withFreshDeploymentHeaders };
