import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const saveCart = mutation({
  args: {
    businessId: v.id("businesses"),
    cartId: v.string(),
    products: v.array(v.object({
      cartItemId: v.optional(v.string()),
      productId: v.id("products"),
      quantity: v.number(),
      name: v.string(),
      price: v.number(),
      customizationNotes: v.optional(v.array(v.string())),
    })),
    totalAmount: v.number(),
  },
  returns: v.union(v.id("carts"), v.null()),
  handler: async (ctx, args) => {
    const business = await ctx.db.get(args.businessId);
    if (!business || business.isEnabled === false) return null;

    // Check if cart already exists
    const existingCart = await ctx.db
      .query("carts")
      .withIndex("by_cart_id", (q) => q.eq("cartId", args.cartId))
      .first();

    if (existingCart) {
      await ctx.db.patch(existingCart._id, {
        products: args.products,
        totalAmount: args.totalAmount,
      });
      return existingCart._id;
    }

    return await ctx.db.insert("carts", {
      businessId: args.businessId,
      cartId: args.cartId,
      products: args.products,
      totalAmount: args.totalAmount,
      createdAt: Date.now(),
    });
  },
});

export const getCart = query({
  args: { cartId: v.string() },
  handler: async (ctx, args) => {
    const cart = await ctx.db
      .query("carts")
      .withIndex("by_cart_id", (q) => q.eq("cartId", args.cartId))
      .first();

    if (!cart) {
      return null;
    }

    const business = await ctx.db.get(cart.businessId);
    if (!business) {
      return null;
    }

    return {
      ...cart,
      business,
    };
  },
});
