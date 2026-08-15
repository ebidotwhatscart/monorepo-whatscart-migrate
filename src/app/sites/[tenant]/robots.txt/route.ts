import type { NextRequest } from "next/server";

import { getPublicBusinessBySlug } from "@/lib/firebase/storefront";
import { tenantOrigin } from "@/lib/tenancy/host";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ tenant: string }> },
) {
  const { tenant } = await context.params;
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "whatscart.in";
  const business = await getPublicBusinessBySlug(tenant);
  const origin = tenantOrigin(tenant, rootDomain);
  const body = business
    ? `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`
    : "User-agent: *\nDisallow: /\n";
  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

