import { v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { assertBusinessAccess } from "./auth";

const MAX_IMAGES_PER_REVIEW = 4;
const MAX_PRODUCTS_PER_REQUEST = 20;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_REVIEW_LENGTH = 500;
const MAX_UPLOADS_PER_REQUEST =
  MAX_PRODUCTS_PER_REQUEST * MAX_IMAGES_PER_REVIEW;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const requestStatusValidator = v.union(
  v.literal("open"),
  v.literal("submitted"),
);
const reviewStatusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
);
const nullableString = v.union(v.string(), v.null());

const reviewStatsValidator = v.object({
  approvedCount: v.number(),
  averageRating: v.number(),
  ratings1: v.number(),
  ratings2: v.number(),
  ratings3: v.number(),
  ratings4: v.number(),
  ratings5: v.number(),
});

type ReviewStatus = "pending" | "approved" | "rejected";
type DatabaseCtx = QueryCtx | MutationCtx;

function normalizeToken(token: string) {
  return token.trim();
}

function validTokenShape(token: string) {
  return token.length >= 32 && token.length <= 200;
}

async function getRequestByToken(ctx: DatabaseCtx, rawToken: string) {
  const token = normalizeToken(rawToken);
  if (!validTokenShape(token)) return null;

  return await ctx.db
    .query("reviewRequests")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
}

async function generateUniqueToken(ctx: MutationCtx) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const token = `${crypto.randomUUID().replaceAll("-", "")}${crypto
      .randomUUID()
      .replaceAll("-", "")}`;
    const existing = await ctx.db
      .query("reviewRequests")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!existing) return token;
  }

  throw new Error("Could not create a secure review link. Please try again.");
}

function emptyStats() {
  return {
    approvedCount: 0,
    ratingSum: 0,
    ratings1: 0,
    ratings2: 0,
    ratings3: 0,
    ratings4: 0,
    ratings5: 0,
  };
}

function emptyPublicStats() {
  return {
    approvedCount: 0,
    averageRating: 0,
    ratings1: 0,
    ratings2: 0,
    ratings3: 0,
    ratings4: 0,
    ratings5: 0,
  };
}

function publicCustomerName(customerName: string) {
  const parts = customerName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Customer";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts.at(-1)![0].toUpperCase()}.`;
}

function ratingKey(rating: number) {
  return `ratings${rating}` as
    | "ratings1"
    | "ratings2"
    | "ratings3"
    | "ratings4"
    | "ratings5";
}

async function updateApprovedStats(
  ctx: MutationCtx,
  review: {
    productId: Id<"products">;
    businessId: Id<"businesses">;
    rating: number;
  },
  delta: 1 | -1,
) {
  const existing = await ctx.db
    .query("productReviewStats")
    .withIndex("by_product_id", (q) => q.eq("productId", review.productId))
    .unique();
  const key = ratingKey(review.rating);

  if (!existing) {
    if (delta < 0) {
      throw new Error(
        "Review totals are inconsistent. Please contact support.",
      );
    }
    await ctx.db.insert("productReviewStats", {
      productId: review.productId,
      businessId: review.businessId,
      ...emptyStats(),
      approvedCount: 1,
      ratingSum: review.rating,
      [key]: 1,
      updatedAt: Date.now(),
    });
    return;
  }

  if (existing.businessId !== review.businessId) {
    throw new Error("Review does not belong to this business.");
  }

  const nextCount = existing.approvedCount + delta;
  const nextRatingCount = existing[key] + delta;
  const nextRatingSum = existing.ratingSum + review.rating * delta;
  if (nextCount < 0 || nextRatingCount < 0 || nextRatingSum < 0) {
    throw new Error("Review totals are inconsistent. Please contact support.");
  }

  await ctx.db.patch(existing._id, {
    approvedCount: nextCount,
    ratingSum: nextRatingSum,
    [key]: nextRatingCount,
    updatedAt: Date.now(),
  });
}

export const createReviewRequest = mutation({
  args: {
    orderId: v.id("orders"),
  },
  returns: v.object({
    token: v.string(),
    status: requestStatusValidator,
    productCount: v.number(),
    lastSentAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found.");
    await assertBusinessAccess(ctx, order.businessId);

    const feedbackEligibleStatuses = new Set([
      "confirmed",
      "paid",
      "unpaid",
      "preparing",
      "ready",
      "delivered",
    ]);
    if (!feedbackEligibleStatuses.has(order.status)) {
      throw new Error("Confirm the order before requesting feedback.");
    }

    const existing = await ctx.db
      .query("reviewRequests")
      .withIndex("by_order_id", (q) => q.eq("orderId", order._id))
      .unique();
    if (existing) {
      const lastSentAt = Date.now();
      if (existing.status === "open") {
        await ctx.db.patch(existing._id, { lastSentAt });
      }
      return {
        token: existing.token,
        status: existing.status,
        productCount: existing.products.length,
        lastSentAt:
          existing.status === "open" ? lastSentAt : existing.lastSentAt,
      };
    }

    const uniqueProductIds = Array.from(
      new Set(
        order.items
          .map((item) => item.productId)
          .filter((productId): productId is Id<"products"> =>
            Boolean(productId),
          ),
      ),
    );
    const products = (
      await Promise.all(
        uniqueProductIds.map(async (productId) => {
          const product = await ctx.db.get(productId);
          if (!product || product.businessId !== order.businessId) return null;
          return {
            productId: product._id,
            name: product.name,
            imageId: product.imageIds[0],
          };
        }),
      )
    ).filter(
      (product): product is NonNullable<typeof product> => product !== null,
    );

    if (products.length === 0) {
      throw new Error("This order has no products that can be reviewed.");
    }
    if (products.length > MAX_PRODUCTS_PER_REQUEST) {
      throw new Error(
        `Feedback can be requested for up to ${MAX_PRODUCTS_PER_REQUEST} distinct products per order.`,
      );
    }

    const now = Date.now();
    const token = await generateUniqueToken(ctx);
    await ctx.db.insert("reviewRequests", {
      orderId: order._id,
      businessId: order.businessId,
      token,
      products,
      status: "open",
      uploadUrlsIssued: 0,
      requestedAt: now,
      lastSentAt: now,
    });

    return {
      token,
      status: "open" as const,
      productCount: products.length,
      lastSentAt: now,
    };
  },
});

export const getReviewForm = query({
  args: {
    token: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      status: requestStatusValidator,
      orderNumber: v.string(),
      customerName: v.string(),
      business: v.object({
        name: v.string(),
        slug: v.string(),
        themeColor: v.string(),
        logoUrl: nullableString,
      }),
      products: v.array(
        v.object({
          productId: v.id("products"),
          name: v.string(),
          imageUrl: nullableString,
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const request = await getRequestByToken(ctx, args.token);
    if (!request) return null;

    const [order, business] = await Promise.all([
      ctx.db.get(request.orderId),
      ctx.db.get(request.businessId),
    ]);
    if (!order || !business) return null;

    const [logoUrl, products] = await Promise.all([
      business.logoId
        ? ctx.storage.getUrl(business.logoId)
        : Promise.resolve(null),
      Promise.all(
        request.products.map(async (product) => ({
          productId: product.productId,
          name: product.name,
          imageUrl: product.imageId
            ? await ctx.storage.getUrl(product.imageId)
            : null,
        })),
      ),
    ]);

    return {
      status: request.status,
      orderNumber: order.orderId,
      customerName: order.customerName,
      business: {
        name: business.name,
        slug: business.slug,
        themeColor: business.themeColor,
        logoUrl,
      },
      products,
    };
  },
});

export const generateReviewUploadUrl = mutation({
  args: {
    token: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const request = await getRequestByToken(ctx, args.token);
    if (!request || request.status !== "open") {
      throw new Error("This review link is invalid or has already been used.");
    }
    if (request.uploadUrlsIssued >= MAX_UPLOADS_PER_REQUEST) {
      throw new Error("The upload limit for this review has been reached.");
    }

    await ctx.db.patch(request._id, {
      uploadUrlsIssued: request.uploadUrlsIssued + 1,
    });
    return await ctx.storage.generateUploadUrl();
  },
});

export const registerReviewUpload = mutation({
  args: {
    token: v.string(),
    storageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const request = await getRequestByToken(ctx, args.token);
    if (!request || request.status !== "open") {
      throw new Error("This review link is invalid or has already been used.");
    }

    const existing = await ctx.db
      .query("reviewUploads")
      .withIndex("by_storage_id", (q) => q.eq("storageId", args.storageId))
      .unique();
    if (existing) {
      if (existing.reviewRequestId !== request._id) {
        throw new Error("This upload does not belong to this review.");
      }
      return null;
    }

    const metadata = await ctx.db.system.get("_storage", args.storageId);
    if (
      !metadata ||
      !metadata.contentType ||
      !ALLOWED_IMAGE_TYPES.has(metadata.contentType) ||
      metadata.size > MAX_IMAGE_BYTES
    ) {
      throw new Error("Photos must be images no larger than 5 MB.");
    }

    const registered = await ctx.db
      .query("reviewUploads")
      .withIndex("by_request_id", (q) => q.eq("reviewRequestId", request._id))
      .take(MAX_UPLOADS_PER_REQUEST + 1);
    if (registered.length >= MAX_UPLOADS_PER_REQUEST) {
      throw new Error("The upload limit for this review has been reached.");
    }

    await ctx.db.insert("reviewUploads", {
      reviewRequestId: request._id,
      storageId: args.storageId,
      createdAt: Date.now(),
    });
    return null;
  },
});

export const submitReviews = mutation({
  args: {
    token: v.string(),
    reviews: v.array(
      v.object({
        productId: v.id("products"),
        rating: v.number(),
        comment: v.string(),
        imageIds: v.array(v.id("_storage")),
      }),
    ),
  },
  returns: v.object({
    submittedAt: v.number(),
    reviewCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const request = await getRequestByToken(ctx, args.token);
    if (!request || request.status !== "open") {
      throw new Error("This review link is invalid or has already been used.");
    }

    const order = await ctx.db.get(request.orderId);
    if (!order || order.businessId !== request.businessId) {
      throw new Error("The order for this review is no longer available.");
    }

    if (args.reviews.length !== request.products.length) {
      throw new Error("Please review every product in the order.");
    }

    const expectedProducts = new Map(
      request.products.map((product) => [product.productId, product]),
    );
    const submittedProductIds = new Set<string>();

    for (const review of args.reviews) {
      const product = expectedProducts.get(review.productId);
      if (!product || submittedProductIds.has(review.productId)) {
        throw new Error("The submitted products do not match this order.");
      }
      submittedProductIds.add(review.productId);

      if (
        !Number.isInteger(review.rating) ||
        review.rating < 1 ||
        review.rating > 5
      ) {
        throw new Error(`Choose a rating from 1 to 5 for ${product.name}.`);
      }
      const comment = review.comment.trim();
      if (comment.length > MAX_REVIEW_LENGTH) {
        throw new Error(
          `Keep the optional review within ${MAX_REVIEW_LENGTH} characters for ${product.name}.`,
        );
      }
      if (
        review.imageIds.length > MAX_IMAGES_PER_REVIEW ||
        new Set(review.imageIds).size !== review.imageIds.length
      ) {
        throw new Error(
          `Add no more than ${MAX_IMAGES_PER_REVIEW} different photos per product.`,
        );
      }

      for (const imageId of review.imageIds) {
        const registered = await ctx.db
          .query("reviewUploads")
          .withIndex("by_storage_id", (q) => q.eq("storageId", imageId))
          .unique();
        if (!registered || registered.reviewRequestId !== request._id) {
          throw new Error("One or more photos do not belong to this review.");
        }
        const metadata = await ctx.db.system.get("_storage", imageId);
        if (
          !metadata ||
          !metadata.contentType ||
          !ALLOWED_IMAGE_TYPES.has(metadata.contentType) ||
          metadata.size > MAX_IMAGE_BYTES
        ) {
          throw new Error("Photos must be images no larger than 5 MB.");
        }
      }
    }

    const existingReviews = await ctx.db
      .query("productReviews")
      .withIndex("by_request_id", (q) => q.eq("reviewRequestId", request._id))
      .take(request.products.length + 1);
    if (existingReviews.length > 0) {
      throw new Error("Feedback has already been submitted for this order.");
    }

    const now = Date.now();
    for (const review of args.reviews) {
      const product = expectedProducts.get(review.productId)!;
      await ctx.db.insert("productReviews", {
        reviewRequestId: request._id,
        orderId: request.orderId,
        businessId: request.businessId,
        productId: review.productId,
        productName: product.name,
        customerName: order.customerName,
        rating: review.rating,
        comment: review.comment.trim(),
        imageIds: review.imageIds,
        status: "pending",
        submittedAt: now,
      });
    }
    await ctx.db.patch(request._id, {
      status: "submitted",
      submittedAt: now,
    });

    return { submittedAt: now, reviewCount: args.reviews.length };
  },
});

export const getOrderReviews = query({
  args: {
    orderId: v.id("orders"),
  },
  returns: v.object({
    request: v.union(
      v.null(),
      v.object({
        status: requestStatusValidator,
        requestedAt: v.number(),
        lastSentAt: v.number(),
        submittedAt: v.optional(v.number()),
      }),
    ),
    reviews: v.array(
      v.object({
        _id: v.id("productReviews"),
        productId: v.id("products"),
        productName: v.string(),
        customerName: v.string(),
        rating: v.number(),
        comment: v.string(),
        imageUrls: v.array(v.string()),
        status: reviewStatusValidator,
        submittedAt: v.number(),
        moderatedAt: v.optional(v.number()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found.");
    await assertBusinessAccess(ctx, order.businessId);

    const request = await ctx.db
      .query("reviewRequests")
      .withIndex("by_order_id", (q) => q.eq("orderId", order._id))
      .unique();
    if (!request) return { request: null, reviews: [] };

    const reviews = await ctx.db
      .query("productReviews")
      .withIndex("by_request_id", (q) => q.eq("reviewRequestId", request._id))
      .take(request.products.length + 1);
    const hydratedReviews = await Promise.all(
      reviews.map(async (review) => ({
        _id: review._id,
        productId: review.productId,
        productName: review.productName,
        customerName: review.customerName,
        rating: review.rating,
        comment: review.comment,
        imageUrls: (
          await Promise.all(
            review.imageIds.map((imageId) => ctx.storage.getUrl(imageId)),
          )
        ).filter((url): url is string => url !== null),
        status: review.status,
        submittedAt: review.submittedAt,
        moderatedAt: review.moderatedAt,
      })),
    );

    return {
      request: {
        status: request.status,
        requestedAt: request.requestedAt,
        lastSentAt: request.lastSentAt,
        submittedAt: request.submittedAt,
      },
      reviews: hydratedReviews,
    };
  },
});

export const getBusinessReviewRequestStates = query({
  args: {
    businessId: v.id("businesses"),
  },
  returns: v.array(
    v.object({
      orderId: v.id("orders"),
      status: requestStatusValidator,
      requestedAt: v.number(),
      submittedAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    await assertBusinessAccess(ctx, args.businessId);

    const requests = await ctx.db
      .query("reviewRequests")
      .withIndex("by_business_id_and_status", (q) =>
        q.eq("businessId", args.businessId),
      )
      .collect();

    return requests.map((request) => ({
      orderId: request.orderId,
      status: request.status,
      requestedAt: request.requestedAt,
      submittedAt: request.submittedAt,
    }));
  },
});

export const moderateReview = mutation({
  args: {
    reviewId: v.id("productReviews"),
    status: reviewStatusValidator,
  },
  returns: v.object({
    status: reviewStatusValidator,
  }),
  handler: async (ctx, args) => {
    const review = await ctx.db.get(args.reviewId);
    if (!review) throw new Error("Review not found.");
    const { user } = await assertBusinessAccess(ctx, review.businessId);

    if (review.status === args.status) return { status: review.status };
    if (review.status === "approved") {
      await updateApprovedStats(ctx, review, -1);
    }
    if (args.status === "approved") {
      await updateApprovedStats(ctx, review, 1);
    }

    await ctx.db.patch(review._id, {
      status: args.status,
      moderatedAt: Date.now(),
      moderatedBy: user._id,
    });
    return { status: args.status };
  },
});

export const getApprovedProductReviews = query({
  args: {
    productId: v.id("products"),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    stats: reviewStatsValidator,
    reviews: v.array(
      v.object({
        _id: v.id("productReviews"),
        displayName: v.string(),
        rating: v.number(),
        comment: v.string(),
        imageUrls: v.array(v.string()),
        submittedAt: v.number(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    if (!Number.isInteger(limit) || limit < 1 || limit > 30) {
      throw new Error("Review limit must be between 1 and 30.");
    }

    const product = await ctx.db.get(args.productId);
    if (!product) {
      return {
        stats: emptyPublicStats(),
        reviews: [],
      };
    }

    const [storedStats, reviews] = await Promise.all([
      ctx.db
        .query("productReviewStats")
        .withIndex("by_product_id", (q) => q.eq("productId", product._id))
        .unique(),
      ctx.db
        .query("productReviews")
        .withIndex("by_product_id_and_status", (q) =>
          q.eq("productId", product._id).eq("status", "approved"),
        )
        .order("desc")
        .take(limit),
    ]);
    const totals = storedStats ?? { ...emptyStats(), ratingSum: 0 };
    const hydratedReviews = await Promise.all(
      reviews.map(async (review) => ({
        _id: review._id,
        displayName: publicCustomerName(review.customerName),
        rating: review.rating,
        comment: review.comment,
        imageUrls: (
          await Promise.all(
            review.imageIds.map((imageId) => ctx.storage.getUrl(imageId)),
          )
        ).filter((url): url is string => url !== null),
        submittedAt: review.submittedAt,
      })),
    );

    return {
      stats: {
        approvedCount: totals.approvedCount,
        averageRating:
          totals.approvedCount > 0
            ? Math.round((totals.ratingSum / totals.approvedCount) * 10) / 10
            : 0,
        ratings1: totals.ratings1,
        ratings2: totals.ratings2,
        ratings3: totals.ratings3,
        ratings4: totals.ratings4,
        ratings5: totals.ratings5,
      },
      reviews: hydratedReviews,
    };
  },
});
