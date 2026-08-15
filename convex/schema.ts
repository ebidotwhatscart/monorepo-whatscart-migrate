import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  productSizeValidator,
  productReturnPolicyValidator,
  productTypeDetailsValidator,
  storedBusinessTypeValidator,
} from "./productValidators";

export const brandPaletteValidator = v.object({
  seedColor: v.string(),
  mode: v.union(v.literal("light"), v.literal("dark")),
  colors: v.array(v.string()),
  primaryColor: v.string(),
});

export const addressValidator = v.object({
  buildingNo: v.string(),
  street: v.string(),
  town: v.string(),
  district: v.string(),
  pincode: v.string(),
  state: v.string(),
  country: v.string(),
});

const applicationTables = {
  businesses: defineTable({
    name: v.string(),
    slug: v.string(),
    orderSequence: v.optional(v.number()),
    themeColor: v.string(),
    brandPalette: v.optional(brandPaletteValidator),
    logoId: v.optional(v.id("_storage")),
    whatsappPhone: v.string(),
    businessType: storedBusinessTypeValidator,
    ownerId: v.id("users"),
    ownerName: v.optional(v.string()),
    preferredLanguage: v.optional(v.string()),
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
    shippingBannerText: v.optional(v.string()),
    featuredProductIds: v.optional(v.array(v.id("products"))),
    address: v.optional(addressValidator),
    serviceRegion: v.optional(v.string()),
    fssaiNumber: v.optional(v.string()),
    fssaiDocId: v.optional(v.id("_storage")),
    upiId: v.optional(v.string()),
    // Existing stores remain enabled until a super admin explicitly disables them.
    isEnabled: v.optional(v.boolean()),
  })
    .index("by_slug", ["slug"])
    .index("by_owner", ["ownerId"]),

  categories: defineTable({
    businessId: v.id("businesses"),
    name: v.string(),
    description: v.optional(v.string()),
    order: v.optional(v.number()),
  }).index("by_business", ["businessId"]),

  products: defineTable({
    businessId: v.id("businesses"),
    categoryId: v.optional(v.id("categories")),
    name: v.string(),
    // Optional for backwards-compatible schema rollout; public URLs fall back
    // to a deterministic slug for older rows until they are edited.
    slug: v.optional(v.string()),
    description: v.string(),
    searchableText: v.string(),
    price: v.number(),
    sizes: v.optional(v.array(productSizeValidator)),
    productTypeDetails: v.optional(productTypeDetailsValidator),
    returnPolicy: v.optional(productReturnPolicyValidator),
    inStock: v.boolean(),
    imageIds: v.array(v.id("_storage")),
    // Garment-only optional image, kept separate so it is always last in the
    // customer-facing product carousel.
    sizeGuideImageId: v.optional(v.id("_storage")),
    variantGroupId: v.optional(v.string()),
    variantType: v.optional(v.string()),
    variantValue: v.optional(v.string()),
    colorName: v.optional(v.string()),
    colorSwatch: v.optional(v.string()),
  })
    .index("by_business", ["businessId"])
    .index("by_business_and_slug", ["businessId", "slug"])
    .index("by_business_and_stock", ["businessId", "inStock"])
    .index("by_category", ["categoryId"])
    .index("by_variant_group", ["variantGroupId"])
    .searchIndex("search_products", {
      searchField: "searchableText",
      filterFields: ["businessId", "inStock"],
    }),

  businessVariationOptions: defineTable({
    businessId: v.id("businesses"),
    variantType: v.string(),
    values: v.array(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_business", ["businessId"])
    .index("by_business_variant_type", ["businessId", "variantType"]),

  catalogs: defineTable({
    businessId: v.id("businesses"),
    catalogId: v.string(),
    name: v.string(),
    productIds: v.array(v.id("products")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_catalog_id", ["catalogId"])
    .index("by_business", ["businessId"]),

  carts: defineTable({
    businessId: v.id("businesses"),
    cartId: v.string(),
    products: v.array(
      v.object({
        cartItemId: v.optional(v.string()),
        productId: v.id("products"),
        quantity: v.number(),
        name: v.optional(v.string()),
        price: v.optional(v.number()),
        customizationNotes: v.optional(v.array(v.string())),
      }),
    ),
    totalAmount: v.number(),
    createdAt: v.number(),
  })
    .index("by_cart_id", ["cartId"])
    .index("by_business", ["businessId"]),

  orders: defineTable({
    orderId: v.string(), // Customer-facing order ID
    businessId: v.id("businesses"),
    customerName: v.string(),
    customerMobile: v.string(),
    customerAlternateMobile: v.optional(v.string()),
    customerDoorNumber: v.optional(v.string()),
    customerAddress: v.optional(v.string()),
    customerLocation: v.optional(
      v.object({
        latitude: v.number(),
        longitude: v.number(),
        label: v.optional(v.string()),
      }),
    ),
    items: v.array(
      v.object({
        cartItemId: v.optional(v.string()),
        productId: v.optional(v.id("products")),
        name: v.string(),
        price: v.number(),
        quantity: v.number(),
        image: v.optional(v.string()),
        customizationNotes: v.optional(v.array(v.string())),
      }),
    ),
    totalAmount: v.number(),
    source: v.string(), // "product" or "cart"
    status: v.string(), // pending, confirmed, preparing, ready, delivered, cancelled
    excludedFromBilling: v.optional(v.boolean()),
    notes: v.optional(v.string()), // Customer notes
    customerNotes: v.optional(v.string()),
    customizationNotes: v.optional(v.array(v.string())),
    utmSource: v.optional(v.string()), // whatsapp, instagram, facebook, organic
    utmMedium: v.optional(v.string()), // share, ad, post
    utmCampaign: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_order_id", ["orderId"])
    .index("by_business", ["businessId"])
    .index("by_business_status", ["businessId", "status"])
    .index("by_customer_mobile", ["customerMobile"])
    .index("by_business_utm", ["businessId", "utmSource"]),

  reviewRequests: defineTable({
    orderId: v.id("orders"),
    businessId: v.id("businesses"),
    token: v.string(),
    products: v.array(
      v.object({
        productId: v.id("products"),
        name: v.string(),
        imageId: v.optional(v.id("_storage")),
      }),
    ),
    status: v.union(v.literal("open"), v.literal("submitted")),
    uploadUrlsIssued: v.number(),
    requestedAt: v.number(),
    lastSentAt: v.number(),
    submittedAt: v.optional(v.number()),
  })
    .index("by_order_id", ["orderId"])
    .index("by_token", ["token"])
    .index("by_business_id_and_status", ["businessId", "status"]),

  reviewUploads: defineTable({
    reviewRequestId: v.id("reviewRequests"),
    storageId: v.id("_storage"),
    createdAt: v.number(),
  })
    .index("by_request_id", ["reviewRequestId"])
    .index("by_storage_id", ["storageId"]),

  productReviews: defineTable({
    reviewRequestId: v.id("reviewRequests"),
    orderId: v.id("orders"),
    businessId: v.id("businesses"),
    productId: v.id("products"),
    productName: v.string(),
    customerName: v.string(),
    rating: v.number(),
    comment: v.string(),
    imageIds: v.array(v.id("_storage")),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
    submittedAt: v.number(),
    moderatedAt: v.optional(v.number()),
    moderatedBy: v.optional(v.id("users")),
  })
    .index("by_request_id", ["reviewRequestId"])
    .index("by_order_id", ["orderId"])
    .index("by_order_id_and_product_id", ["orderId", "productId"])
    .index("by_business_id_and_status", ["businessId", "status"])
    .index("by_product_id_and_status", ["productId", "status"]),

  productReviewStats: defineTable({
    productId: v.id("products"),
    businessId: v.id("businesses"),
    approvedCount: v.number(),
    ratingSum: v.number(),
    ratings1: v.number(),
    ratings2: v.number(),
    ratings3: v.number(),
    ratings4: v.number(),
    ratings5: v.number(),
    updatedAt: v.number(),
  })
    .index("by_product_id", ["productId"])
    .index("by_business_id", ["businessId"]),

  pageViews: defineTable({
    businessId: v.id("businesses"),
    sessionId: v.string(),
    pageUrl: v.string(),
    referrer: v.string(),
    utmSource: v.optional(v.string()),
    utmMedium: v.optional(v.string()),
    utmCampaign: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_business", ["businessId"])
    .index("by_business_timestamp", ["businessId", "timestamp"])
    .index("by_session", ["sessionId"]),

  productViews: defineTable({
    businessId: v.id("businesses"),
    productId: v.id("products"),
    sessionId: v.string(),
    timestamp: v.number(),
  })
    .index("by_business", ["businessId"])
    .index("by_business_product", ["businessId", "productId"])
    .index("by_product", ["productId"]),

  productShares: defineTable({
    businessId: v.id("businesses"),
    productId: v.id("products"),
    sessionId: v.string(),
    channel: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_business", ["businessId"])
    .index("by_business_product", ["businessId", "productId"])
    .index("by_product", ["productId"]),
};

export default defineSchema({
  users: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    clerkId: v.string(),
    role: v.optional(v.union(v.literal("user"), v.literal("super_admin"))),
  })
    .index("by_email", ["email"])
    .index("by_clerk_id", ["clerkId"]),
  ...applicationTables,
});
