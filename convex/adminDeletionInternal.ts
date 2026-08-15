import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { requireSuperAdmin } from "./auth";

const DELETE_BATCH_SIZE = 25;

const batchResultValidator = v.object({
  businessDeleted: v.boolean(),
  businesses: v.number(),
  categories: v.number(),
  products: v.number(),
  businessVariationOptions: v.number(),
  catalogs: v.number(),
  carts: v.number(),
  orders: v.number(),
  pageViews: v.number(),
  productViews: v.number(),
  productShares: v.number(),
  storageFiles: v.number(),
});

function emptyBatchResult() {
  return {
    businessDeleted: false,
    businesses: 0,
    categories: 0,
    products: 0,
    businessVariationOptions: 0,
    catalogs: 0,
    carts: 0,
    orders: 0,
    pageViews: 0,
    productViews: 0,
    productShares: 0,
    storageFiles: 0,
  };
}

export const getDeletionTarget = internalQuery({
  args: {
    identifier: v.string(),
    identifierType: v.union(v.literal("email"), v.literal("id")),
  },
  returns: v.union(
    v.null(),
    v.object({
      userId: v.id("users"),
      email: v.union(v.string(), v.null()),
      clerkId: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const administrator = await requireSuperAdmin(ctx);
    const identifier = args.identifier.trim();
    let target = null;

    if (args.identifierType === "email") {
      const normalizedEmail = identifier.toLowerCase();
      target = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", identifier))
        .first();
      if (!target && normalizedEmail !== identifier) {
        target = await ctx.db
          .query("users")
          .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
          .first();
      }
    } else {
      const convexUserId = ctx.db.normalizeId("users", identifier);
      if (convexUserId) {
        if (convexUserId === administrator._id) {
          throw new Error("This admin operation cannot delete your own account");
        }

        target = await ctx.db.get(convexUserId);
        if (!target) {
          const ownedBusiness = await ctx.db
            .query("businesses")
            .withIndex("by_owner", (q) => q.eq("ownerId", convexUserId))
            .first();
          if (!ownedBusiness) return null;

          return {
            userId: convexUserId,
            email: null,
            clerkId: null,
          };
        }
      } else {
        target = await ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q) => q.eq("clerkId", identifier))
          .first();
      }
    }

    if (!target) return null;
    if (target._id === administrator._id) {
      throw new Error("This admin operation cannot delete your own account");
    }

    return {
      userId: target._id,
      email: target.email,
      clerkId: target.clerkId,
    };
  },
});

export const getNextOwnedBusiness = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(v.null(), v.id("businesses")),
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.userId))
      .first();
    return business?._id ?? null;
  },
});

export const deleteBusinessDataBatch = internalMutation({
  args: {
    userId: v.id("users"),
    businessId: v.id("businesses"),
  },
  returns: batchResultValidator,
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const business = await ctx.db.get(args.businessId);
    if (business && business.ownerId !== args.userId) {
      throw new Error("Business does not belong to the deletion target");
    }

    const [
      categories,
      products,
      businessVariationOptions,
      catalogs,
      carts,
      orders,
      pageViews,
      productViews,
      productShares,
    ] = await Promise.all([
      ctx.db
        .query("categories")
        .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
        .take(DELETE_BATCH_SIZE),
      ctx.db
        .query("products")
        .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
        .take(DELETE_BATCH_SIZE),
      ctx.db
        .query("businessVariationOptions")
        .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
        .take(DELETE_BATCH_SIZE),
      ctx.db
        .query("catalogs")
        .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
        .take(DELETE_BATCH_SIZE),
      ctx.db
        .query("carts")
        .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
        .take(DELETE_BATCH_SIZE),
      ctx.db
        .query("orders")
        .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
        .take(DELETE_BATCH_SIZE),
      ctx.db
        .query("pageViews")
        .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
        .take(DELETE_BATCH_SIZE),
      ctx.db
        .query("productViews")
        .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
        .take(DELETE_BATCH_SIZE),
      ctx.db
        .query("productShares")
        .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
        .take(DELETE_BATCH_SIZE),
    ]);

    const rowsFound =
      categories.length +
      products.length +
      businessVariationOptions.length +
      catalogs.length +
      carts.length +
      orders.length +
      pageViews.length +
      productViews.length +
      productShares.length;

    if (rowsFound === 0) {
      let storageFiles = 0;
      if (business?.logoId) {
        const logo = await ctx.db.system.get("_storage", business.logoId);
        if (logo) {
          await ctx.storage.delete(business.logoId);
          storageFiles += 1;
        }
      }
      if (business) {
        await ctx.db.delete(business._id);
      }
      return {
        ...emptyBatchResult(),
        // Run one final batch after removing the business. Public storefront
        // mutations now require the business to exist, so this pass closes the
        // small window for an in-flight write to leave an orphaned row.
        businessDeleted: !business,
        businesses: business ? 1 : 0,
        storageFiles,
      };
    }

    const imageIds = new Set(products.flatMap((product) => product.imageIds));
    let storageFiles = 0;
    for (const imageId of imageIds) {
      const image = await ctx.db.system.get("_storage", imageId);
      if (image) {
        await ctx.storage.delete(imageId);
        storageFiles += 1;
      }
    }

    for (const row of categories) await ctx.db.delete(row._id);
    for (const row of products) await ctx.db.delete(row._id);
    for (const row of businessVariationOptions) await ctx.db.delete(row._id);
    for (const row of catalogs) await ctx.db.delete(row._id);
    for (const row of carts) await ctx.db.delete(row._id);
    for (const row of orders) await ctx.db.delete(row._id);
    for (const row of pageViews) await ctx.db.delete(row._id);
    for (const row of productViews) await ctx.db.delete(row._id);
    for (const row of productShares) await ctx.db.delete(row._id);

    return {
      businessDeleted: false,
      businesses: 0,
      categories: categories.length,
      products: products.length,
      businessVariationOptions: businessVariationOptions.length,
      catalogs: catalogs.length,
      carts: carts.length,
      orders: orders.length,
      pageViews: pageViews.length,
      productViews: productViews.length,
      productShares: productShares.length,
      storageFiles,
    };
  },
});

export const deleteUserRecord = internalMutation({
  args: { userId: v.id("users") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const target = await ctx.db.get(args.userId);
    if (!target) return false;

    const remainingBusiness = await ctx.db
      .query("businesses")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.userId))
      .first();
    if (remainingBusiness) {
      throw new Error("Cannot delete a user while owned businesses remain");
    }

    await ctx.db.delete(target._id);
    return true;
  },
});
