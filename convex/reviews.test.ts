/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

function createTestBackend() {
  return convexTest(schema, modules);
}

async function seedReviewOrder(t: ReturnType<typeof createTestBackend>) {
  return await t.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", {
      email: "owner@example.com",
      name: "Store Owner",
      clerkId: "owner-clerk",
      role: "user",
    });
    await ctx.db.insert("users", {
      email: "stranger@example.com",
      name: "Other Owner",
      clerkId: "stranger-clerk",
      role: "user",
    });
    const businessId = await ctx.db.insert("businesses", {
      name: "Kanchi House",
      slug: "kanchi-house",
      themeColor: "#056664",
      whatsappPhone: "919999999999",
      businessType: "garments",
      ownerId,
    });
    const productA = await ctx.db.insert("products", {
      businessId,
      name: "Silk Saree",
      slug: "silk-saree",
      description: "Handloom saree",
      searchableText: "silk saree handloom",
      price: 8500,
      inStock: true,
      imageIds: [],
    });
    const productB = await ctx.db.insert("products", {
      businessId,
      name: "Blouse",
      slug: "blouse",
      description: "Matching blouse",
      searchableText: "matching blouse",
      price: 1200,
      inStock: true,
      imageIds: [],
    });
    const now = 1_700_000_000_000;
    const orderId = await ctx.db.insert("orders", {
      orderId: "KANC00042",
      businessId,
      customerName: "Anu Kumar",
      customerMobile: "9876543210",
      items: [
        {
          productId: productA,
          name: "Silk Saree",
          price: 8500,
          quantity: 1,
        },
        {
          productId: productB,
          name: "Blouse",
          price: 1200,
          quantity: 1,
        },
      ],
      totalAmount: 9700,
      source: "cart",
      status: "delivered",
      createdAt: now,
      updatedAt: now,
    });
    return { businessId, orderId, productA, productB };
  });
}

describe("review lifecycle", () => {
  afterEach(() => vi.restoreAllMocks());

  it("requires the business owner and snapshots every distinct order product", async () => {
    const t = createTestBackend();
    const { orderId, productA, productB } = await seedReviewOrder(t);

    await expect(
      t.mutation(api.reviews.createReviewRequest, { orderId }),
    ).rejects.toThrow("Not authenticated");
    await expect(
      t
        .withIdentity({ subject: "stranger-clerk" })
        .mutation(api.reviews.createReviewRequest, { orderId }),
    ).rejects.toThrow("Not authorized");

    vi.spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValueOnce("11111111-1111-4111-8111-111111111111")
      .mockReturnValueOnce("22222222-2222-4222-8222-222222222222");
    const request = await t
      .withIdentity({ subject: "owner-clerk" })
      .mutation(api.reviews.createReviewRequest, { orderId });
    expect(request.status).toBe("open");
    expect(request.productCount).toBe(2);

    const form = await t.query(api.reviews.getReviewForm, {
      token: request.token,
    });
    expect(form?.products.map((product) => product.productId)).toEqual([
      productA,
      productB,
    ]);
    expect(form).not.toHaveProperty("customerMobile");
  });

  it("requires all products once and only exposes owner-approved reviews", async () => {
    const t = createTestBackend();
    const { businessId, orderId, productA, productB } = await seedReviewOrder(t);
    vi.spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValueOnce("33333333-3333-4333-8333-333333333333")
      .mockReturnValueOnce("44444444-4444-4444-8444-444444444444");
    const owner = t.withIdentity({ subject: "owner-clerk" });
    const request = await owner.mutation(api.reviews.createReviewRequest, {
      orderId,
    });

    await expect(
      t.mutation(api.reviews.submitReviews, {
        token: request.token,
        reviews: [
          {
            productId: productA,
            rating: 5,
            comment: "Excellent",
            imageIds: [],
          },
        ],
      }),
    ).rejects.toThrow("review every product");

    await t.mutation(api.reviews.submitReviews, {
      token: request.token,
      reviews: [
        { productId: productA, rating: 5, comment: "", imageIds: [] },
        { productId: productB, rating: 4, comment: "", imageIds: [] },
      ],
    });
    await expect(
      t.mutation(api.reviews.submitReviews, {
        token: request.token,
        reviews: [
          { productId: productA, rating: 5, comment: "Again", imageIds: [] },
          { productId: productB, rating: 5, comment: "Again", imageIds: [] },
        ],
      }),
    ).rejects.toThrow("already been used");

    const orderReviews = await owner.query(api.reviews.getOrderReviews, {
      orderId,
    });
    const requestStates = await owner.query(
      api.reviews.getBusinessReviewRequestStates,
      { businessId },
    );
    expect(requestStates).toEqual([
      expect.objectContaining({ orderId, status: "submitted" }),
    ]);
    const sareeReview = orderReviews.reviews.find(
      (review) => review.productId === productA,
    );
    expect(sareeReview?.status).toBe("pending");

    expect(
      (
        await t.query(api.reviews.getApprovedProductReviews, {
          productId: productA,
        })
      ).reviews,
    ).toHaveLength(0);
    await expect(
      t
        .withIdentity({ subject: "stranger-clerk" })
        .mutation(api.reviews.moderateReview, {
          reviewId: sareeReview!._id,
          status: "approved",
        }),
    ).rejects.toThrow("Not authorized");

    await owner.mutation(api.reviews.moderateReview, {
      reviewId: sareeReview!._id,
      status: "approved",
    });
    const approved = await t.query(api.reviews.getApprovedProductReviews, {
      productId: productA,
    });
    expect(approved.stats).toMatchObject({
      approvedCount: 1,
      averageRating: 5,
      ratings5: 1,
    });
    expect(approved.reviews).toEqual([
      expect.objectContaining({ displayName: "Anu K.", comment: "" }),
    ]);

    await owner.mutation(api.reviews.moderateReview, {
      reviewId: sareeReview!._id,
      status: "rejected",
    });
    const hidden = await t.query(api.reviews.getApprovedProductReviews, {
      productId: productA,
    });
    expect(hidden.stats.approvedCount).toBe(0);
    expect(hidden.reviews).toHaveLength(0);
  });
});
