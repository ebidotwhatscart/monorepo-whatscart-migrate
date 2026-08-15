import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getCurrentUser } from "./auth";
import {
  normalizeBusinessType,
  type BusinessType,
  type ProductCustomizationOption,
  type ProductTypeDetails,
  type StoredBusinessType,
} from "../src/types/product";
import {
  productSizeValidator,
  productReturnPolicyValidator,
  productTypeDetailsValidator,
} from "./productValidators";

const BAKERY_CUSTOMIZATION_OPTIONS = new Set<ProductCustomizationOption>([
  "edible_photo_print",
  "custom_text_message",
]);

const HANDICRAFT_CUSTOMIZATION_OPTIONS = new Set<ProductCustomizationOption>([
  "custom_engraving",
  "embroidered_text",
  "customer_photo_upload",
]);

function slugifyProductName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "product";
}

function publicProductSlug(product: Pick<Doc<"products">, "name" | "slug" | "_id">) {
  return product.slug || `${slugifyProductName(product.name)}-${String(product._id).slice(-6).toLowerCase()}`;
}

async function createProductSlug(ctx: any, businessId: Id<"businesses">, name: string) {
  const base = slugifyProductName(name);
  const existing = await ctx.db
    .query("products")
    .withIndex("by_business", (q: any) => q.eq("businessId", businessId))
    .collect();
  const used = new Set(existing.map((product: Doc<"products">) => publicProductSlug(product)));
  if (!used.has(base)) return base;

  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function assertProductTypeDetailsAllowed(
  businessType: BusinessType,
  productTypeDetails?: ProductTypeDetails,
) {
  if (!productTypeDetails) {
    return;
  }

  const { audience, dietaryClassification, sizeFormat, customizationOptions } =
    productTypeDetails;
  const hasCustomizationOptions = Boolean(customizationOptions?.length);

  if (businessType === "garments") {
    if (dietaryClassification) {
      throw new Error(
        "Garment products cannot include dietary classification.",
      );
    }
    if (productTypeDetails.customizationEnabled) {
      throw new Error(
        "Garment products cannot enable customization.",
      );
    }
    if (customizationOptions?.length) {
      throw new Error("Garment products cannot include customization options.");
    }
    return;
  }

  if (businessType === "home_bakery") {
    if (audience) {
      throw new Error("Bakery products cannot include audience.");
    }
    if (sizeFormat) {
      throw new Error("Bakery products cannot include size format.");
    }
    if (productTypeDetails.customizationEnabled === false && hasCustomizationOptions) {
      throw new Error(
        "Bakery products cannot include customization options when customization is disabled.",
      );
    }
    if (hasCustomizationOptions && productTypeDetails.customizationEnabled !== true) {
      throw new Error(
        "Bakery products with customization options must enable customization.",
      );
    }
    if (
      customizationOptions?.some(
        (option) => !BAKERY_CUSTOMIZATION_OPTIONS.has(option),
      )
    ) {
      throw new Error(
        "Bakery products can only use bakery customization options.",
      );
    }
    return;
  }

  if (dietaryClassification) {
    throw new Error(
      "Handicraft products cannot include dietary classification.",
    );
  }
  if (sizeFormat) {
    throw new Error("Handicraft products cannot include size format.");
  }
  if (productTypeDetails.customizationEnabled === false && hasCustomizationOptions) {
    throw new Error(
      "Handicraft products cannot include customization options when customization is disabled.",
    );
  }
  if (hasCustomizationOptions && productTypeDetails.customizationEnabled !== true) {
    throw new Error(
      "Handicraft products with customization options must enable customization.",
    );
  }
  if (
    customizationOptions?.some(
      (option) => !HANDICRAFT_CUSTOMIZATION_OPTIONS.has(option),
    )
  ) {
    throw new Error(
      "Handicraft products can only use handicraft customization options.",
    );
  }
}

async function assertCategoryBelongsToBusiness(
  ctx: any,
  categoryId: any,
  businessId: any,
) {
  if (!categoryId) {
    return;
  }

  const category = await ctx.db.get(categoryId);
  if (!category) {
    throw new Error("Category not found.");
  }

  if (
    typeof category === "object" &&
    category !== null &&
    "businessId" in category &&
    category.businessId !== businessId
  ) {
    throw new Error("Category does not belong to this business.");
  }
}

export const createProduct = mutation({
  args: {
    businessId: v.id("businesses"),
    categoryId: v.optional(v.id("categories")),
    name: v.string(),
    description: v.string(),
    price: v.number(),
    sizes: v.optional(v.array(productSizeValidator)),
    productTypeDetails: v.optional(productTypeDetailsValidator),
    returnPolicy: v.optional(productReturnPolicyValidator),
    inStock: v.boolean(),
    imageIds: v.array(v.id("_storage")),
    sizeGuideImageId: v.optional(v.id("_storage")),
    variantGroupId: v.optional(v.string()),
    variantType: v.optional(v.string()),
    variantValue: v.optional(v.string()),
    colorName: v.optional(v.string()),
    colorSwatch: v.optional(v.string()),
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

    assertProductTypeDetailsAllowed(
      normalizeBusinessType(business.businessType as StoredBusinessType),
      args.productTypeDetails,
    );
    if (
      args.sizeGuideImageId &&
      normalizeBusinessType(business.businessType as StoredBusinessType) !== "garments"
    ) {
      throw new Error("Only garment products can include a size guide image.");
    }
    await assertCategoryBelongsToBusiness(
      ctx,
      args.categoryId,
      args.businessId,
    );

    // Check product limit (let's say 50 products max) - skip for variants
    if (!args.variantGroupId) {
      const existingProducts = await ctx.db
        .query("products")
        .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
        .collect();

      if (existingProducts.length >= 50) {
        throw new Error("Product limit reached");
      }
    }

    // Create searchable text from name and description
    const searchableText = `${args.name} ${args.description}`;

    const slug = await createProductSlug(ctx, args.businessId, args.name);

    return await ctx.db.insert("products", {
      businessId: args.businessId,
      categoryId: args.categoryId,
      name: args.name,
      slug,
      description: args.description,
      searchableText,
      price: args.price,
      sizes: args.sizes,
      productTypeDetails: args.productTypeDetails,
      returnPolicy: args.returnPolicy,
      inStock: args.inStock,
      imageIds: args.imageIds,
      sizeGuideImageId: args.sizeGuideImageId,
      variantGroupId: args.variantGroupId,
      variantType: args.variantType,
      variantValue: args.variantValue,
      colorName: args.colorName,
      colorSwatch: args.colorSwatch,
    });
  },
});

export const updateProduct = mutation({
  args: {
    productId: v.id("products"),
    categoryId: v.optional(v.id("categories")),
    name: v.string(),
    description: v.string(),
    price: v.number(),
    sizes: v.optional(v.array(productSizeValidator)),
    productTypeDetails: v.optional(productTypeDetailsValidator),
    returnPolicy: v.optional(productReturnPolicyValidator),
    inStock: v.boolean(),
    imageIds: v.array(v.id("_storage")),
    sizeGuideImageId: v.optional(v.id("_storage")),
    removeSizeGuideImage: v.optional(v.boolean()),
    colorName: v.optional(v.string()),
    colorSwatch: v.optional(v.string()),
    variantGroupId: v.optional(v.string()),
    variantType: v.optional(v.string()),
    variantValue: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const product = await ctx.db.get(args.productId);
    if (!product) {
      throw new Error("Product not found");
    }

    const business = await ctx.db.get(product.businessId);
    if (!business || (business.ownerId !== user._id && user.role !== "super_admin")) {
      throw new Error("Not authorized");
    }

    assertProductTypeDetailsAllowed(
      normalizeBusinessType(business.businessType as StoredBusinessType),
      args.productTypeDetails,
    );
    if (
      (args.sizeGuideImageId || args.removeSizeGuideImage) &&
      normalizeBusinessType(business.businessType as StoredBusinessType) !== "garments"
    ) {
      throw new Error("Only garment products can include a size guide image.");
    }
    await assertCategoryBelongsToBusiness(
      ctx,
      args.categoryId,
      product.businessId,
    );

    // Create searchable text from name and description
    const searchableText = `${args.name} ${args.description}`;

    await ctx.db.patch(args.productId, {
      categoryId: args.categoryId,
      name: args.name,
      description: args.description,
      searchableText,
      price: args.price,
      sizes: args.sizes,
      productTypeDetails: args.productTypeDetails,
      returnPolicy: args.returnPolicy,
      inStock: args.inStock,
      imageIds: args.imageIds,
      ...(args.removeSizeGuideImage
        ? { sizeGuideImageId: undefined }
        : args.sizeGuideImageId
          ? { sizeGuideImageId: args.sizeGuideImageId }
          : {}),
      colorName: args.colorName,
      colorSwatch: args.colorSwatch,
      variantGroupId: args.variantGroupId,
      variantType: args.variantType,
      variantValue: args.variantValue,
    });
  },
});

export const deleteProduct = mutation({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const product = await ctx.db.get(args.productId);
    if (!product) {
      throw new Error("Product not found");
    }

    const business = await ctx.db.get(product.businessId);
    if (!business || (business.ownerId !== user._id && user.role !== "super_admin")) {
      throw new Error("Not authorized");
    }

    await ctx.db.delete(args.productId);
  },
});

// Migration: Populate searchableText for all existing products
// This is a one-time migration to add searchableText to products that don't have it
export const migrateProductsSearchableText = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    // Get all products
    const allProducts = await ctx.db.query("products").collect();

    let updatedCount = 0;
    const errors: string[] = [];

    for (const product of allProducts) {
      // Skip if searchableText already exists
      if ("searchableText" in product && product.searchableText) {
        continue;
      }

      try {
        // Verify user owns this product's business
        const business = await ctx.db.get(product.businessId);
        if (!business || (business.ownerId !== user._id && user.role !== "super_admin")) {
          errors.push(`Skipping product ${product._id} - not authorized`);
          continue;
        }

        // Generate searchableText from name and description
        const searchableText = `${product.name} ${product.description}`;

        await ctx.db.patch(product._id, {
          searchableText,
        });

        updatedCount++;
      } catch (error) {
        errors.push(`Failed to update product ${product._id}: ${error}`);
      }
    }

    return {
      updatedCount,
      totalProducts: allProducts.length,
      errors: errors.length > 0 ? errors : null,
    };
  },
});

export const getBusinessProducts = query({
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

    const products = await ctx.db
      .query("products")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .collect();

    return await Promise.all(
      products.map(async (product) => {
        const imageUrls = await Promise.all(
          product.imageIds.map((id) => ctx.storage.getUrl(id))
        );

        let category = null;
        if (product.categoryId) {
          category = await ctx.db.get(product.categoryId);
        }

        return {
          ...product,
          imageUrls: imageUrls.filter(Boolean),
          sizeGuideImageUrl: product.sizeGuideImageId
            ? await ctx.storage.getUrl(product.sizeGuideImageId)
            : null,
          category,
        };
      })
    );
  },
});

export const getPublicProducts = query({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, args) => {
    const products = await ctx.db
      .query("products")
      .withIndex("by_business_and_stock", (q) =>
        q.eq("businessId", args.businessId).eq("inStock", true)
      )
      .collect();

    return await Promise.all(
      products.map(async (product) => {
        const imageUrls = await Promise.all(
          product.imageIds.map((id) => ctx.storage.getUrl(id))
        );

        let category = null;
        if (product.categoryId) {
          category = await ctx.db.get(product.categoryId);
        }

        return {
          ...product,
          imageUrls: imageUrls.filter(Boolean),
          sizeGuideImageUrl: product.sizeGuideImageId
            ? await ctx.storage.getUrl(product.sizeGuideImageId)
            : null,
          category,
        };
      })
    );
  },
});

export const getProduct = query({
  args: {
    productId: v.id("products"),
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product) {
      return null;
    }

    if (product.businessId !== args.businessId) {
      return null;
    }

    const imageUrls = await Promise.all(
      product.imageIds.map((id) => ctx.storage.getUrl(id))
    );

    let category = null;
    if (product.categoryId) {
      category = await ctx.db.get(product.categoryId);
    }

    return {
      ...product,
      imageUrls: imageUrls.filter(Boolean),
      sizeGuideImageUrl: product.sizeGuideImageId
        ? await ctx.storage.getUrl(product.sizeGuideImageId)
        : null,
      category,
    };
  },
});

export const getRelatedProducts = query({
  args: {
    businessId: v.id("businesses"),
    categoryId: v.optional(v.id("categories")),
    excludeProductId: v.id("products"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 5;
    const hydrateProducts = async (products: Doc<"products">[]) =>
      Promise.all(
        products.map(async (product) => {
          const imageUrls = await Promise.all(
            product.imageIds.map((id) => ctx.storage.getUrl(id))
          );

          let category = null;
          if (product.categoryId) {
            category = await ctx.db.get(product.categoryId);
          }

          return {
            ...product,
            imageUrls: imageUrls.filter(Boolean),
            category,
          };
        })
      );

    const pickRandomProducts = (products: Doc<"products">[]) =>
      products
        .map((value) => ({ value, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map(({ value }) => value)
        .slice(0, limit);

    const allBusinessProducts = await ctx.db
      .query("products")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .collect();

    const otherProducts = allBusinessProducts.filter(
      (product) => product._id !== args.excludeProductId && product.inStock === true
    );

    if (!args.categoryId) {
      return hydrateProducts(pickRandomProducts(otherProducts));
    }

    const categoryProducts = allBusinessProducts.filter(
      (p) =>
        p.categoryId === args.categoryId &&
        p._id !== args.excludeProductId &&
        p.inStock === true
    );

    const candidates = categoryProducts.length > 0 ? categoryProducts : otherProducts;

    return hydrateProducts(pickRandomProducts(candidates));
  },
});

export const getPublicProductShareData = query({
  args: {
    slug: v.string(),
    productId: v.optional(v.string()),
    productSlug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (!business || business.isEnabled === false) {
      return null;
    }

    const requestedProductId = args.productId
      ? ctx.db.normalizeId("products", args.productId)
      : null;
    let product = requestedProductId ? await ctx.db.get(requestedProductId) : null;
    if (!product && args.productSlug) {
      product = await ctx.db
        .query("products")
        .withIndex("by_business_and_slug", (q) =>
          q.eq("businessId", business._id).eq("slug", args.productSlug!),
        )
        .first();
      if (!product) {
        const products = await ctx.db
          .query("products")
          .withIndex("by_business", (q) => q.eq("businessId", business._id))
          .collect();
        product = products.find((candidate) => publicProductSlug(candidate) === args.productSlug) ?? null;
      }
      if (!product) {
        const legacyProductId = ctx.db.normalizeId("products", args.productSlug);
        product = legacyProductId ? await ctx.db.get(legacyProductId) : null;
      }
    }
    if (!product || product.businessId !== business._id || !product.inStock) {
      return null;
    }

    const imageUrls = await Promise.all(
      product.imageIds.map((id) => ctx.storage.getUrl(id))
    );

    let category = null;
    if (product.categoryId) {
      category = await ctx.db.get(product.categoryId);
    }

    return {
      business: {
        name: business.name,
        slug: business.slug,
      },
      product: {
        _id: product._id,
        slug: publicProductSlug(product),
        name: product.name,
        description: product.description,
        price: product.price,
        imageUrls: imageUrls.filter(Boolean),
        categoryName: category?.name ?? null,
      },
    };
  },
});

export const getPublicProductBySlug = query({
  args: {
    slug: v.string(),
    productSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (!business || business.isEnabled === false) return null;

    let product = await ctx.db
      .query("products")
      .withIndex("by_business_and_slug", (q) =>
        q.eq("businessId", business._id).eq("slug", args.productSlug),
      )
      .first();
    if (!product) {
      const products = await ctx.db
        .query("products")
        .withIndex("by_business", (q) => q.eq("businessId", business._id))
        .collect();
      product = products.find((candidate) => publicProductSlug(candidate) === args.productSlug) ?? null;
    }
    if (!product) {
      const legacyProductId = ctx.db.normalizeId("products", args.productSlug);
      product = legacyProductId ? await ctx.db.get(legacyProductId) : null;
    }
    if (!product || !product.inStock) return null;

    const imageUrls = await Promise.all(product.imageIds.map((id) => ctx.storage.getUrl(id)));
    const category = product.categoryId ? await ctx.db.get(product.categoryId) : null;
    return {
      ...product,
      slug: publicProductSlug(product),
      imageUrls: imageUrls.filter(Boolean),
      sizeGuideImageUrl: product.sizeGuideImageId
        ? await ctx.storage.getUrl(product.sizeGuideImageId)
        : null,
      category,
    };
  },
});

export const getProductVariants = query({
  args: {
    productId: v.id("products"),
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product || product.businessId !== args.businessId) {
      return [];
    }

    const groupId = product.variantGroupId;
    if (!groupId) {
      return [];
    }

    const variants = await ctx.db
      .query("products")
      .withIndex("by_variant_group", (q) => q.eq("variantGroupId", groupId))
      .collect();

    return await Promise.all(
      variants.map(async (variant) => {
        const imageUrls = await Promise.all(
          variant.imageIds.map((id) => ctx.storage.getUrl(id)),
        );

        let category = null;
        if (variant.categoryId) {
          category = await ctx.db.get(variant.categoryId);
        }

        return {
          ...variant,
          imageUrls: imageUrls.filter(Boolean),
          category,
        };
      }),
    );
  },
});

export const searchProducts = query({
  args: {
    businessId: v.id("businesses"),
    searchTerm: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.searchTerm.trim()) {
      return [];
    }

    const products = await ctx.db
      .query("products")
      .withSearchIndex("search_products", (q) =>
        q
          .search("searchableText", args.searchTerm)
          .eq("businessId", args.businessId)
          .eq("inStock", true)
      )
      .take(20);

    return await Promise.all(
      products.map(async (product) => {
        const imageUrls = await Promise.all(
          product.imageIds.map((id) => ctx.storage.getUrl(id))
        );

        let category = null;
        if (product.categoryId) {
          category = await ctx.db.get(product.categoryId);
        }

        return {
          ...product,
          imageUrls: imageUrls.filter(Boolean),
          category,
        };
      })
    );
  },
});
