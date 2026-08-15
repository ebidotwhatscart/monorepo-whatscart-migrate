import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireSuperAdmin } from "./auth";

const businessSummaryValidator = v.object({
  _id: v.id("businesses"),
  name: v.string(),
  slug: v.string(),
  ownerId: v.id("users"),
  ownerName: v.string(),
  ownerEmail: v.string(),
  ownerClerkId: v.union(v.string(), v.null()),
  productCount: v.number(),
  orderCount: v.number(),
  createdAt: v.number(),
  isEnabled: v.boolean(),
});

export const listBusinesses = query({
  args: {},
  returns: v.array(businessSummaryValidator),
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    const businesses = await ctx.db.query("businesses").take(500);

    return Promise.all(
      businesses
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(async (business) => {
          const owner = await ctx.db.get(business.ownerId);
          const [products, orders] = await Promise.all([
            ctx.db
              .query("products")
              .withIndex("by_business", (q) => q.eq("businessId", business._id))
              .take(1_001),
            ctx.db
              .query("orders")
              .withIndex("by_business", (q) => q.eq("businessId", business._id))
              .take(1_001),
          ]);

          return {
            _id: business._id,
            name: business.name,
            slug: business.slug,
            ownerId: business.ownerId,
            ownerName: business.ownerName ?? owner?.name ?? "Unknown owner",
            ownerEmail: owner?.email ?? "",
            ownerClerkId: owner?.clerkId ?? null,
            productCount: products.length,
            orderCount: orders.length,
            createdAt: business._creationTime,
            isEnabled: business.isEnabled !== false,
          };
        }),
    );
  },
});

export const setBusinessEnabled = mutation({
  args: {
    businessId: v.id("businesses"),
    isEnabled: v.boolean(),
  },
  returns: v.object({
    businessId: v.id("businesses"),
    isEnabled: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const business = await ctx.db.get(args.businessId);
    if (!business) throw new Error("Business not found");

    await ctx.db.patch(business._id, { isEnabled: args.isEnabled });
    return { businessId: business._id, isEnabled: args.isEnabled };
  },
});

export const getBusinessForAdmin = query({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const business = await ctx.db.get(args.businessId);
    if (!business) return null;
    const logoUrl = business.logoId ? await ctx.storage.getUrl(business.logoId) : null;
    return { ...business, logoUrl };
  },
});
