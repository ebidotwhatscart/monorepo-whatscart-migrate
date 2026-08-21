import { type NextRequest, NextResponse } from "next/server";

import { normalizeHostname, tenantFromHostname } from "./lib/tenancy/host";

export function proxy(request: NextRequest) {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "whatscart.in";
  const hostname = normalizeHostname(
    request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
  );
  const pathname = request.nextUrl.pathname;

  // Tenant hostnames share application infrastructure and public assets with the
  // apex deployment. Keep those requests out of the tenant page rewrite so the
  // service worker, API routes, and fingerprinted Next.js assets remain reachable.
  const isSharedInfrastructurePath =
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/.well-known/") ||
    pathname === "/sw.js" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/manifest.json" ||
    (pathname.includes(".") &&
      pathname !== "/robots.txt" &&
      pathname !== "/sitemap.xml");

  if (isSharedInfrastructurePath) return NextResponse.next();

  if (hostname === `app.${rootDomain}` && pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Keep migration-era /store links, while sending the initial request through
  // the server-rendered tenant route so catalog content is in the first HTML.
  const legacyStoreMatch =
    hostname === `app.${rootDomain}`
      ? pathname.match(/^\/store\/([^/]+)(?:\/(.*))?$/)
      : null;
  if (legacyStoreMatch) {
    const [, tenant, rest] = legacyStoreMatch;
    const destination = request.nextUrl.clone();
    destination.pathname = `/sites/${tenant}${rest ? `/${rest}` : ""}`;
    return NextResponse.rewrite(destination);
  }

  const tenant = tenantFromHostname(hostname, rootDomain);
  if (!tenant || pathname.startsWith("/sites/")) return NextResponse.next();

  const destination = request.nextUrl.clone();
  destination.pathname = `/sites/${tenant}${pathname}`;
  const response = NextResponse.rewrite(destination);
  response.headers.set(
    "cache-control",
    "private, no-cache, no-store, max-age=0, must-revalidate",
  );
  response.headers.set("cdn-cache-control", "no-store");
  response.headers.set("vercel-cdn-cache-control", "no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
