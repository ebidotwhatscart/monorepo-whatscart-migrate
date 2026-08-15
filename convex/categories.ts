import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getCurrentUser } from "./auth";

export const createCategory = mutation({
  args: {
    businessId: v.id("businesses"),
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    // Verify user owns the business
    const business = await ctx.db.get(args.businessId);
    if (!business || (business.ownerId !== user._id && user.role !== "super_admin")) {
      throw new Error("Not authorized");
    }

    const existing = await ctx.db
      .query("categories")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .collect();

    const maxOrder = existing.reduce((max, c) => Math.max(max, c.order ?? 0), 0);

    return await ctx.db.insert("categories", {
      businessId: args.businessId,
      name: args.name,
      description: args.description,
      order: maxOrder + 1,
    });
  },
});

export const updateCategory = mutation({
  args: {
    categoryId: v.id("categories"),
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const category = await ctx.db.get(args.categoryId);
    if (!category) {
      throw new Error("Category not found");
    }

    const business = await ctx.db.get(category.businessId);
    if (!business || (business.ownerId !== user._id && user.role !== "super_admin")) {
      throw new Error("Not authorized");
    }

    await ctx.db.patch(args.categoryId, {
      name: args.name,
      description: args.description,
    });
  },
});

export const deleteCategory = mutation({
  args: { categoryId: v.id("categories") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const category = await ctx.db.get(args.categoryId);
    if (!category) {
      throw new Error("Category not found");
    }

    const business = await ctx.db.get(category.businessId);
    if (!business || (business.ownerId !== user._id && user.role !== "super_admin")) {
      throw new Error("Not authorized");
    }

    // Remove category from all products
    const products = await ctx.db
      .query("products")
      .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
      .collect();

    for (const product of products) {
      await ctx.db.patch(product._id, { categoryId: undefined });
    }

    await ctx.db.delete(args.categoryId);
  },
});

export const getBusinessCategories = query({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const business = await ctx.db.get(args.businessId);
    if (!business || (business.ownerId !== user._id && user.role !== "super_admin")) {
      throw new Error("Not authorized");
    }

    const cats = await ctx.db
      .query("categories")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .collect();

    return cats.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  },
});

export const getPublicCategories = query({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, args) => {
    const cats = await ctx.db
      .query("categories")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .collect();

    return cats.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  },
});

export const reorderCategories = mutation({
  args: {
    businessId: v.id("businesses"),
    orderedIds: v.array(v.id("categories")),
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

    for (let i = 0; i < args.orderedIds.length; i++) {
      await ctx.db.patch(args.orderedIds[i], { order: i + 1 });
    }
  },
});
