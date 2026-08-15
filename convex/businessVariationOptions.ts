import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getCurrentUser } from "./auth";
import { BUSINESS_TYPE_CONFIG } from "../src/components/products/businessTypeConfig";
import { normalizeBusinessType, type StoredBusinessType } from "../src/types/product";

type Context = QueryCtx | MutationCtx;

async function getOwnedBusiness(ctx: Context, businessId: Id<"businesses">) {
  const user = await getCurrentUser(ctx);
  if (!user) throw new Error("Not authenticated");
  const business = await ctx.db.get(businessId);
  if (!business || (business.ownerId !== user._id && user.role !== "super_admin")) throw new Error("Not authorized");
  return business;
}

function unique(values: string[]) {
  const seen = new Set<string>();
  return values.map((value) => value.trim()).filter((value) => {
    const key = value.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function optionsForBusiness(ctx: Context, businessId: Id<"businesses">) {
  const business = await getOwnedBusiness(ctx, businessId);
  const type = normalizeBusinessType(business.businessType as StoredBusinessType);
  const presets = BUSINESS_TYPE_CONFIG[type].variationOptions;
  const custom = await ctx.db.query("businessVariationOptions")
    .withIndex("by_business", (q) => q.eq("businessId", businessId)).collect();
  const merged = new Map(presets.map((option) => [option.variantType.toLowerCase(), {
    variantType: option.variantType,
    values: [...option.values],
  }]));
  for (const option of custom) {
    const key = option.variantType.toLowerCase();
    const current = merged.get(key);
    merged.set(key, {
      variantType: current?.variantType ?? option.variantType.trim(),
      values: unique([...(current?.values ?? []), ...option.values]),
    });
  }
  return { business, options: [...merged.values()] };
}

export const getBusinessVariationOptions = query({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, args) => (await optionsForBusiness(ctx, args.businessId)).options,
});

export const addCustomVariationType = mutation({
  args: { businessId: v.id("businesses"), variantType: v.string() },
  handler: async (ctx, args) => {
    const { business, options } = await optionsForBusiness(ctx, args.businessId);
    const variantType = args.variantType.trim();
    if (!variantType) throw new Error("Variation type is required");
    const existing = options.find((option) => option.variantType.toLowerCase() === variantType.toLowerCase());
    if (existing) return existing.variantType;
    const now = Date.now();
    await ctx.db.insert("businessVariationOptions", {
      businessId: business._id,
      variantType,
      values: [],
      createdAt: now,
      updatedAt: now,
    });
    return variantType;
  },
});

export const addCustomVariationValue = mutation({
  args: { businessId: v.id("businesses"), variantType: v.string(), value: v.string() },
  handler: async (ctx, args) => {
    const { business, options } = await optionsForBusiness(ctx, args.businessId);
    const variantType = args.variantType.trim();
    const value = args.value.trim();
    if (!variantType || !value) throw new Error("Variation type and value are required");
    const configuredType = options.find((option) => option.variantType.toLowerCase() === variantType.toLowerCase());
    if (configuredType?.values.some((item) => item.toLowerCase() === value.toLowerCase())) return value;
    const rows = await ctx.db.query("businessVariationOptions")
      .withIndex("by_business", (q) => q.eq("businessId", business._id)).collect();
    const row = rows.find((item) => item.variantType.toLowerCase() === variantType.toLowerCase());
    if (row) {
      if (row.values.some((item) => item.toLowerCase() === value.toLowerCase())) return value;
      await ctx.db.patch(row._id, { values: unique([...row.values, value]), updatedAt: Date.now() });
    } else {
      const now = Date.now();
      await ctx.db.insert("businessVariationOptions", {
        businessId: business._id,
        variantType,
        values: [value],
        createdAt: now,
        updatedAt: now,
      });
    }
    return value;
  },
});
