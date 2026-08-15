import type { NextRequest } from "next/server";

import {
  getPublicBusinessBySlug,
  getPublicCatalogIds,
  getPublicProducts,
} from "@/lib/firebase/storefront";
import { tenantOrigin } from "@/lib/tenancy/host";
import { buildStorefrontSitemapXml } from "@/lib/storefront-seo";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ tenant: string }> },
) {
  const { tenant } = await context.params;
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "whatscart.in";
  const business = await getPublicBusinessBySlug(tenant);
  if (!business) return new Response("Not found", { status: 404 });

  const origin = tenantOrigin(tenant, rootDomain);
  const [products, catalogIds] = await Promise.all([
    getPublicProducts(business.id),
    getPublicCatalogIds(business.id),
  ]);
  const body = buildStorefrontSitemapXml(
    origin,
    products.map((product) => product.slug),
    catalogIds,
  );
  return new Response(body, {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
}
