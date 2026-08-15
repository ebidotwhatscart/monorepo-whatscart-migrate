import type { NextRequest } from "next/server";

import {
  getPublicBusinessBySlug,
  getPublicProducts,
} from "@/lib/firebase/storefront";
import { tenantOrigin } from "@/lib/tenancy/host";

export const dynamic = "force-dynamic";

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ tenant: string }> },
) {
  const { tenant } = await context.params;
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "whatscart.in";
  const business = await getPublicBusinessBySlug(tenant);
  if (!business) return new Response("Not found", { status: 404 });

  const origin = tenantOrigin(tenant, rootDomain);
  const products = await getPublicProducts(business.id);
  const locations = [
    `${origin}/`,
    ...products.map((product) => `${origin}/products/${product.slug}`),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${locations
    .map((location) => `  <url><loc>${escapeXml(location)}</loc></url>`)
    .join("\n")}\n</urlset>\n`;
  return new Response(body, {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
}

