import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/seo/sitemap",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const slug = new URL(request.url).searchParams.get("slug");
    if (!slug) return new Response("Missing slug", { status: 400 });
    const data = await ctx.runQuery(api.businesses.getPublicSitemap, { slug });
    if (!data) return new Response("Store not found", { status: 404 });
    return new Response(JSON.stringify(data), {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300" },
    });
  }),
});

http.route({
  path: "/share-meta/store",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const slug = new URL(request.url).searchParams.get("slug");
    if (!slug) return json({ error: "Missing slug" }, 400);

    const data = await ctx.runQuery(api.businesses.getPublicStoreSeoData, { slug });
    if (!data) return json({ error: "Store not found" }, 404);

    return json({
      type: "store",
      title: `${data.business.name} | WhatsCart Store`,
      description: data.business.description?.trim() ||
        `Shop products from ${data.business.name}${data.business.serviceRegion ? ` in ${data.business.serviceRegion}` : ""}.`,
      image: data.business.logoUrl || null,
      imageAlt: `${data.business.name} logo`,
      url: "/",
      siteName: data.business.name,
      businessName: data.business.name,
      businessDescription: data.business.description,
      serviceRegion: data.business.serviceRegion,
      categories: data.categories,
      products: data.products,
    });
  }),
});

http.route({
  path: "/share-meta/product",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug");
    const productId = url.searchParams.get("productId") || undefined;
    const productSlug = url.searchParams.get("productSlug") || undefined;

    if (!slug || (!productId && !productSlug)) {
      return json({ error: "Missing slug or productSlug" }, 400);
    }

    const data = await ctx.runQuery(api.products.getPublicProductShareData, {
      slug,
      productId,
      productSlug,
    });

    if (!data) {
      return json({ error: "Product not found" }, 404);
    }

    const image = data.product.imageUrls[0] ?? "";
    const description = [
      data.product.categoryName,
      data.product.description?.trim(),
    ]
      .filter(Boolean)
      .join(" • ")
      .slice(0, 220);

    return json({
      type: "product",
      title: `${data.product.name} | ${data.business.name}`,
      description: description || `Shop ${data.product.name} from ${data.business.name}.`,
      image,
      imageAlt: `${data.product.name} from ${data.business.name}`,
      url: `/store/${data.business.slug}/products/${data.product.slug}`,
      productSlug: data.product.slug,
      productName: data.product.name,
      businessName: data.business.name,
      price: data.product.price,
      currency: "INR",
      availability: "https://schema.org/InStock",
      siteName: data.business.name,
    });
  }),
});

http.route({
  path: "/share-meta/catalog",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug");
    const catalogId = url.searchParams.get("catalogId");

    if (!slug || !catalogId) {
      return json({ error: "Missing slug or catalogId" }, 400);
    }

    const data = await ctx.runQuery(api.catalogs.getPublicCatalog, {
      slug,
      catalogId,
    });

    if (!data) {
      return json({ error: "Collection not found" }, 404);
    }

    const ogImagePath = `/share-image/catalog?slug=${encodeURIComponent(slug)}&catalogId=${encodeURIComponent(catalogId)}`;

    return json({
      type: "website",
      title: `${data.catalog.name} | ${data.business.name}`,
      description: `${data.products.length} products from ${data.business.name}.`,
      image: ogImagePath,
      imageAlt: `${data.catalog.name} collection from ${data.business.name}`,
      url: `/store/${data.business.slug}/catalog/${data.catalog.catalogId}`,
      siteName: data.business.name,
      businessName: data.business.name,
      products: data.products.map((product) => ({
        slug: product.slug,
        name: product.name,
        description: product.description,
        price: product.price,
        image: product.imageUrls?.[0] ?? null,
      })),
    });
  }),
});

http.route({
  path: "/share-image/catalog",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug");
    const catalogId = url.searchParams.get("catalogId");

    if (!slug || !catalogId) {
      return new Response("Missing slug or catalogId", { status: 400 });
    }

    const data = await ctx.runQuery(api.catalogs.getCatalogShareImage, {
      slug,
      catalogId,
    });

    if (!data) {
      return new Response("Collection not found", { status: 404 });
    }

    const svg = buildCollectionOgSvg({
      title: data.catalogName,
      businessName: data.businessName,
      imageUrls: data.imageUrls,
      totalProducts: data.totalProducts,
    });

    return new Response(svg, {
      headers: {
        "content-type": "image/svg+xml; charset=utf-8",
        "cache-control": "public, max-age=21600, s-maxage=86400",
      },
    });
  }),
});

export default http;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}

function buildCollectionOgSvg({
  title,
  businessName,
  imageUrls,
  totalProducts,
}: {
  title: string;
  businessName: string;
  imageUrls: string[];
  totalProducts: number;
}) {
  const visibleImages = imageUrls.slice(0, 4);
  const remainingCount = Math.max(totalProducts - 4, 0);

  // 2x2 grid covering the full 1200x630 canvas like CollectionThumbnail
  const grid = [
    { x: 0, y: 0, width: 600, height: 315 },
    { x: 600, y: 0, width: 600, height: 315 },
    { x: 0, y: 315, width: 600, height: 315 },
    { x: 600, y: 315, width: 600, height: 315 },
  ];

  const imageTiles = grid
    .map((tile, index) => {
      const imageUrl = visibleImages[index];
      const overlay =
        index === 3 && remainingCount > 0
          ? `<rect x="${tile.x}" y="${tile.y}" width="${tile.width}" height="${tile.height}" fill="rgba(15,23,42,0.6)" />
             <text x="${tile.x + tile.width / 2}" y="${tile.y + tile.height / 2 + 18}" text-anchor="middle" font-size="96" font-family="Arial, sans-serif" font-weight="700" fill="#ffffff">+${remainingCount}</text>`
          : "";

      if (imageUrl) {
        return `
          <clipPath id="clip-${index}">
            <rect x="${tile.x}" y="${tile.y}" width="${tile.width}" height="${tile.height}" />
          </clipPath>
          <image href="${escapeXml(imageUrl)}" x="${tile.x}" y="${tile.y}" width="${tile.width}" height="${tile.height}" preserveAspectRatio="xMidYMid slice" clip-path="url(#clip-${index})" />
          ${overlay}
        `;
      }

      return `
        <rect x="${tile.x}" y="${tile.y}" width="${tile.width}" height="${tile.height}" fill="#e2e8f0" />
        ${overlay}
      `;
    })
    .join("");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
      <rect width="1200" height="630" fill="#f1f5f9" />
      ${imageTiles}
    </svg>
  `;
}

function truncateText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
