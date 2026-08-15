import { v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { getCurrentUser } from "./auth";

const CATALOG_ID_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function publicProductSlug(product: { name: string; slug?: string; _id: string }) {
  if (product.slug) return product.slug;
  const readable = product.name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "product";
  return `${readable}-${String(product._id).slice(-6).toLowerCase()}`;
}

function createCatalogId(): string {
  let id = "";
  for (let i = 0; i < 10; i += 1) {
    id +=
      CATALOG_ID_ALPHABET[
        Math.floor(Math.random() * CATALOG_ID_ALPHABET.length)
      ];
  }
  return id;
}

type CatalogCtx = QueryCtx | MutationCtx;

async function assertBusinessOwner(
  ctx: CatalogCtx,
  businessId: Id<"businesses">,
) {
  const user = await getCurrentUser(ctx);
  if (!user) {
    throw new Error("Not authenticated");
  }

  const business = await ctx.db.get(businessId);
  if (!business || (business.ownerId !== user._id && user.role !== "super_admin")) {
    throw new Error("Not authorized");
  }

  return business;
}

async function getProductWithDetails(ctx: QueryCtx, product: Doc<"products">) {
  const imageUrls = await Promise.all(
    product.imageIds.map((id) => ctx.storage.getUrl(id)),
  );

  let category = null;
  if (product.categoryId) {
    category = await ctx.db.get(product.categoryId);
  }

  return {
    ...product,
    slug: publicProductSlug(product),
    imageUrls: imageUrls.filter(Boolean),
    category,
  };
}

export const createCatalog = mutation({
  args: {
    businessId: v.id("businesses"),
    productIds: v.array(v.id("products")),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertBusinessOwner(ctx, args.businessId);

    const uniqueProductIds = Array.from(new Set(args.productIds));
    if (uniqueProductIds.length < 2) {
      throw new Error("Select at least two products");
    }

    const products = await Promise.all(
      uniqueProductIds.map((productId) => ctx.db.get(productId)),
    );

    const invalidProduct = products.find(
      (product) => !product || product.businessId !== args.businessId,
    );
    if (invalidProduct !== undefined) {
      throw new Error("Catalog contains invalid products");
    }

    let catalogId = createCatalogId();
    while (
      await ctx.db
        .query("catalogs")
        .withIndex("by_catalog_id", (q) => q.eq("catalogId", catalogId))
        .first()
    ) {
      catalogId = createCatalogId();
    }

    const now = Date.now();
    const catalogName =
      args.name?.trim() ||
      `Catalog ${new Date(now).toLocaleDateString("en-IN")}`;

    await ctx.db.insert("catalogs", {
      businessId: args.businessId,
      catalogId,
      name: catalogName,
      productIds: uniqueProductIds,
      createdAt: now,
      updatedAt: now,
    });

    return { catalogId };
  },
});

export const getBusinessCatalogs = query({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, args) => {
    await assertBusinessOwner(ctx, args.businessId);

    const catalogs = await ctx.db
      .query("catalogs")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .collect();

    return catalogs.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const renameCatalog = mutation({
  args: {
    catalogId: v.id("catalogs"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const catalog = await ctx.db.get(args.catalogId);
    if (!catalog) {
      throw new Error("Catalog not found");
    }

    await assertBusinessOwner(ctx, catalog.businessId);

    const name = args.name.trim();
    if (!name) {
      throw new Error("Catalog name is required");
    }

    await ctx.db.patch(args.catalogId, {
      name,
      updatedAt: Date.now(),
    });
  },
});

export const updateCatalog = mutation({
  args: {
    catalogId: v.id("catalogs"),
    name: v.string(),
    productIds: v.array(v.id("products")),
  },
  handler: async (ctx, args) => {
    const catalog = await ctx.db.get(args.catalogId);
    if (!catalog) {
      throw new Error("Catalog not found");
    }

    await assertBusinessOwner(ctx, catalog.businessId);

    const name = args.name.trim();
    if (!name) {
      throw new Error("Catalog name is required");
    }

    const uniqueProductIds = Array.from(new Set(args.productIds));
    if (uniqueProductIds.length < 2) {
      throw new Error("Select at least two products");
    }

    const products = await Promise.all(
      uniqueProductIds.map((productId) => ctx.db.get(productId)),
    );

    const invalidProduct = products.find(
      (product) => !product || product.businessId !== catalog.businessId,
    );
    if (invalidProduct !== undefined) {
      throw new Error("Catalog contains invalid products");
    }

    await ctx.db.patch(args.catalogId, {
      name,
      productIds: uniqueProductIds,
      updatedAt: Date.now(),
    });
  },
});

export const deleteCatalog = mutation({
  args: { catalogId: v.id("catalogs") },
  handler: async (ctx, args) => {
    const catalog = await ctx.db.get(args.catalogId);
    if (!catalog) {
      return;
    }

    await assertBusinessOwner(ctx, catalog.businessId);
    await ctx.db.delete(args.catalogId);
  },
});

export const getPublicCatalog = query({
  args: {
    slug: v.string(),
    catalogId: v.string(),
  },
  handler: async (ctx, args) => {
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (!business || business.isEnabled === false) {
      return null;
    }

    const catalog = await ctx.db
      .query("catalogs")
      .withIndex("by_catalog_id", (q) => q.eq("catalogId", args.catalogId))
      .first();

    if (!catalog || catalog.businessId !== business._id) {
      return null;
    }

    const logoUrl = business.logoId
      ? await ctx.storage.getUrl(business.logoId)
      : null;
    const products = await Promise.all(
      catalog.productIds.map((productId) => ctx.db.get(productId)),
    );
    const availableProducts = products.filter(
      (product): product is Doc<"products"> =>
        Boolean(
          product && product.businessId === business._id && product.inStock,
        ),
    );

    return {
      catalog,
      business: {
        ...business,
        logoUrl,
      },
      products: await Promise.all(
        availableProducts.map((product) => getProductWithDetails(ctx, product)),
      ),
    };
  },
});

export const getCatalogShareImage = query({
  args: {
    slug: v.string(),
    catalogId: v.string(),
  },
  handler: async (ctx, args) => {
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (!business || business.isEnabled === false) {
      return null;
    }

    const catalog = await ctx.db
      .query("catalogs")
      .withIndex("by_catalog_id", (q) => q.eq("catalogId", args.catalogId))
      .first();

    if (!catalog || catalog.businessId !== business._id) {
      return null;
    }

    const products = await Promise.all(
      catalog.productIds.map((productId) => ctx.db.get(productId)),
    );
    const availableProducts = products.filter(
      (product): product is Doc<"products"> =>
        Boolean(
          product && product.businessId === business._id && product.inStock,
        ),
    );

    const imageUrls = await Promise.all(
      availableProducts.map(async (product) => {
        if (product.imageIds.length > 0) {
          return ctx.storage.getUrl(product.imageIds[0]);
        }
        return null;
      }),
    );

    return {
      catalogName: catalog.name,
      businessName: business.name,
      imageUrls: imageUrls.filter((url): url is string => Boolean(url)),
      totalProducts: availableProducts.length,
    };
  },
});
