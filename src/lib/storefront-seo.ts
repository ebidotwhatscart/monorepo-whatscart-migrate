export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function buildStorefrontSitemapXml(
  origin: string,
  productSlugs: string[],
  catalogIds: string[] = [],
) {
  const normalizedOrigin = origin.replace(/\/+$/, "");
  const locations = [
    `${normalizedOrigin}/`,
    ...productSlugs
      .filter(Boolean)
      .map((slug) => `${normalizedOrigin}/products/${encodeURIComponent(slug)}`),
    ...catalogIds
      .filter(Boolean)
      .map((catalogId) => `${normalizedOrigin}/catalog/${encodeURIComponent(catalogId)}`),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${locations
    .map((location) => `  <url><loc>${escapeXml(location)}</loc></url>`)
    .join("\n")}\n</urlset>\n`;
}
