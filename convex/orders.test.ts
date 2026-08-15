/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

function createTestBackend() {
  return convexTest(schema, modules);
}

async function seedOrders(t: ReturnType<typeof createTestBackend>) {
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
    const createdAt = Date.now() - 1_000;
    const orderId = await ctx.db.insert("orders", {
      orderId: "KANC00001",
      businessId,
      customerName: "Anu Kumar",
      customerMobile: "9876543210",
      items: [{ name: "Silk Saree", price: 500, quantity: 1 }],
      totalAmount: 500,
      source: "cart",
      status: "confirmed",
      createdAt,
      updatedAt: createdAt,
    });
    await ctx.db.insert("orders", {
      orderId: "KANC00002",
      businessId,
      customerName: "Devi Raj",
      customerMobile: "9876543211",
      items: [{ name: "Cotton Kurta", price: 300, quantity: 1 }],
      totalAmount: 300,
      source: "cart",
      status: "confirmed",
      createdAt,
      updatedAt: createdAt,
    });
    return { businessId, orderId };
  });
}

describe("order billing exclusion", () => {
  it("requires business access and removes only the selected order from metrics", async () => {
    const t = createTestBackend();
    const { businessId, orderId } = await seedOrders(t);
    const dateRange = { type: "alltime" as const };

    expect(
      await t.query(api.analytics.getTotalRevenue, { businessId, dateRange }),
    ).toBe(800);
    expect(
      await t.query(api.analytics.getTotalOrders, { businessId, dateRange }),
    ).toBe(2);

    await expect(
      t.mutation(api.orders.setOrderBillingExclusion, {
        orderId,
        excluded: true,
      }),
    ).rejects.toThrow("Not authenticated");
    await expect(
      t
        .withIdentity({ subject: "stranger-clerk" })
        .mutation(api.orders.setOrderBillingExclusion, {
          orderId,
          excluded: true,
        }),
    ).rejects.toThrow("Not authorized");

    await t
      .withIdentity({ subject: "owner-clerk" })
      .mutation(api.orders.setOrderBillingExclusion, {
        orderId,
        excluded: true,
      });

    const detail = await t
      .withIdentity({ subject: "owner-clerk" })
      .query(api.orders.getBusinessOrderDetail, { orderId });
    expect(detail?.excludedFromBilling).toBe(true);
    expect(
      await t.query(api.analytics.getTotalRevenue, { businessId, dateRange }),
    ).toBe(300);
    expect(
      await t.query(api.analytics.getTotalOrders, { businessId, dateRange }),
    ).toBe(1);
    expect(
      await t.query(api.orders.getBusinessOrders, { businessId }),
    ).toHaveLength(2);
    expect(
      await t.query(api.orders.getBusinessOrderStats, { businessId }),
    ).toEqual(
      expect.objectContaining({
        total: 2,
        confirmed: 2,
        totalRevenue: 300,
      }),
    );
  });

  it("can restore an excluded order to billing", async () => {
    const t = createTestBackend();
    const { businessId, orderId } = await seedOrders(t);

    await t.run(async (ctx) => {
      await ctx.db.patch(orderId, { excludedFromBilling: true });
    });
    const restored = await t
      .withIdentity({ subject: "owner-clerk" })
      .mutation(api.orders.setOrderBillingExclusion, {
        orderId,
        excluded: false,
      });

    expect(restored.excludedFromBilling).toBe(false);
    expect(
      await t.query(api.analytics.getTotalRevenue, {
        businessId,
        dateRange: { type: "alltime" },
      }),
    ).toBe(800);
  });
});
