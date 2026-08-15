import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getCurrentUser } from "./auth";
import {
  normalizeBusinessType,
  type StoredBusinessType,
} from "../src/types/product";
import { canonicalBusinessTypeValidator } from "./productValidators";
import { normalizeIndianWhatsappPhone } from "../src/lib/phone";
import { brandPaletteValidator, addressValidator } from "./schema";

function normalizeBusiness<T extends { businessType: StoredBusinessType }>(
  business: T,
) {
  return {
    ...business,
    businessType: normalizeBusinessType(business.businessType),
  };
}

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

export const createBusiness = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    themeColor: v.string(),
    brandPalette: v.optional(brandPaletteValidator),
    logoId: v.id("_storage"),
    whatsappPhone: v.string(),
    businessType: canonicalBusinessTypeValidator,
    ownerName: v.optional(v.string()),
    preferredLanguage: v.optional(v.string()),
    description: v.optional(v.string()),
    address: v.optional(addressValidator),
    serviceRegion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    // Check if slug is unique
    const existingBusiness = await ctx.db
      .query("businesses")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (existingBusiness) {
      throw new Error("Business slug already exists");
    }

    const normalizedWhatsappPhone = normalizeIndianWhatsappPhone(
      args.whatsappPhone,
    );
    if (!normalizedWhatsappPhone) {
      throw new Error("Enter a valid 10-digit WhatsApp number.");
    }

    const businessId = await ctx.db.insert("businesses", {
      name: args.name,
      slug: args.slug,
      orderSequence: 0,
      themeColor: args.themeColor,
      brandPalette: args.brandPalette,
      logoId: args.logoId,
      whatsappPhone: normalizedWhatsappPhone,
      businessType: args.businessType,
      ownerId: user._id,
      ownerName: args.ownerName,
      preferredLanguage: args.preferredLanguage,
      description: args.description,
      address: args.address,
      serviceRegion: args.serviceRegion,
    });

    return businessId;
  },
});

export const updateBusiness = mutation({
  args: {
    businessId: v.id("businesses"),
    name: v.string(),
    themeColor: v.string(),
    brandPalette: v.optional(brandPaletteValidator),
    logoId: v.optional(v.id("_storage")),
    whatsappPhone: v.string(),
    description: v.optional(v.string()),
    socialLinks: v.optional(
      v.object({
        instagram: v.optional(v.string()),
        facebook: v.optional(v.string()),
        threads: v.optional(v.string()),
        x: v.optional(v.string()),
        linkedin: v.optional(v.string()),
        youtube: v.optional(v.string()),
      }),
    ),
    ownerName: v.optional(v.string()),
    shippingBannerText: v.optional(v.string()),
    featuredProductIds: v.optional(v.array(v.id("products"))),
    address: v.optional(addressValidator),
    serviceRegion: v.optional(v.string()),
    fssaiNumber: v.optional(v.string()),
    fssaiDocId: v.optional(v.id("_storage")),
    upiId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const business = await ctx.db.get(args.businessId);
    if (!business || (business.ownerId !== user._id && user.role !== "super_admin")) {
      throw new Error("Not authorized");
    }

    const normalizedWhatsappPhone = normalizeIndianWhatsappPhone(
      args.whatsappPhone,
    );
    if (!normalizedWhatsappPhone) {
      throw new Error("Enter a valid 10-digit WhatsApp number.");
    }

    const patchFields: Record<string, unknown> = {
      name: args.name,
      themeColor: args.themeColor,
      whatsappPhone: normalizedWhatsappPhone,
    };
    if (args.brandPalette !== undefined) patchFields.brandPalette = args.brandPalette;
    if (args.logoId !== undefined) patchFields.logoId = args.logoId;
    if (args.description !== undefined) patchFields.description = args.description;
    if (args.socialLinks !== undefined) patchFields.socialLinks = args.socialLinks;
    if (args.ownerName !== undefined) patchFields.ownerName = args.ownerName;
    if (args.shippingBannerText !== undefined) patchFields.shippingBannerText = args.shippingBannerText;
    if (args.featuredProductIds !== undefined) patchFields.featuredProductIds = args.featuredProductIds;
    if (args.address !== undefined) patchFields.address = args.address;
    if (args.serviceRegion !== undefined) patchFields.serviceRegion = args.serviceRegion;
    if (args.fssaiNumber !== undefined) patchFields.fssaiNumber = args.fssaiNumber;
    if (args.fssaiDocId !== undefined) patchFields.fssaiDocId = args.fssaiDocId;
    if (args.upiId !== undefined) patchFields.upiId = args.upiId;

    await ctx.db.patch(args.businessId, patchFields);
  },
});

export const getFeaturedProducts = query({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, args) => {
    const business = await ctx.db.get(args.businessId);
    if (!business?.featuredProductIds || business.featuredProductIds.length === 0) {
      return [];
    }

    const products = await Promise.all(
      business.featuredProductIds.map((id) => ctx.db.get(id)),
    );

    const resolved = await Promise.all(
      products
        .filter((p): p is NonNullable<typeof p> => p !== null)
        .map(async (product) => {
          const imageUrls = await Promise.all(
            product.imageIds.map((id) => ctx.storage.getUrl(id)),
          );
          return {
            ...product,
            imageUrls,
          };
        }),
    );

    return resolved;
  },
});

export const checkSlugAvailability = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("businesses")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    return !existing;
  },
});

export const getUserBusiness = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return null;
    }

    const business = await ctx.db
      .query("businesses")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .first();

    if (!business) {
      return null;
    }

    let logoUrl = null;
    if (business.logoId) {
      logoUrl = await ctx.storage.getUrl(business.logoId);
    }
    let fssaiDocUrl = null;
    if (business.fssaiDocId) {
      fssaiDocUrl = await ctx.storage.getUrl(business.fssaiDocId);
    }

    return {
      ...normalizeBusiness(business),
      logoUrl,
      fssaiDocUrl,
    };
  },
});

export const getBusinessBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (!business || business.isEnabled === false) {
      return null;
    }

    let logoUrl = null;
    if (business.logoId) {
      logoUrl = await ctx.storage.getUrl(business.logoId);
    }
    let fssaiDocUrl = null;
    if (business.fssaiDocId) {
      fssaiDocUrl = await ctx.storage.getUrl(business.fssaiDocId);
    }

    return {
      ...normalizeBusiness(business),
      logoUrl,
      fssaiDocUrl,
    };
  },
});

/** Public, bounded content used to render the initial crawlable storefront shell. */
export const getPublicStoreSeoData = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (!business || business.isEnabled === false) return null;

    const [products, categories] = await Promise.all([
      ctx.db
        .query("products")
        .withIndex("by_business_and_stock", (q) =>
          q.eq("businessId", business._id).eq("inStock", true),
        )
        .take(100),
      ctx.db
        .query("categories")
        .withIndex("by_business", (q) => q.eq("businessId", business._id))
        .take(50),
    ]);

    const publicProducts = await Promise.all(
      products.map(async (product) => ({
        slug: publicProductSlug(product),
        name: product.name,
        description: product.description,
        price: product.price,
        categoryId: product.categoryId ?? null,
        image: product.imageIds[0]
          ? await ctx.storage.getUrl(product.imageIds[0])
          : null,
      })),
    );

    return {
      business: {
        name: business.name,
        slug: business.slug,
        description: business.description ?? null,
        logoUrl: business.logoId ? await ctx.storage.getUrl(business.logoId) : null,
        serviceRegion: business.serviceRegion ?? null,
      },
      categories: categories.map((category) => ({
        name: category.name,
        description: category.description ?? null,
      })),
      products: publicProducts,
    };
  },
});

export const getPublicSitemap = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (!business || business.isEnabled === false) return null;

    const [products, catalogs] = await Promise.all([
      ctx.db.query("products").withIndex("by_business", (q) => q.eq("businessId", business._id)).take(500),
      ctx.db.query("catalogs").withIndex("by_business", (q) => q.eq("businessId", business._id)).take(200),
    ]);

    return {
      slug: business.slug,
      products: products
        .filter((product) => product.inStock)
        .map((product) => ({
          slug: publicProductSlug(product),
        })),
      catalogIds: catalogs.map((catalog) => catalog.catalogId),
    };
  },
});

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    return await ctx.storage.generateUploadUrl();
  },
});
