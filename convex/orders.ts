import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { assertBusinessAccess, getCurrentUser } from "./auth";

// Customer-facing IDs use the first four letters of the business name and a
// five-digit sequence, for example THEC00001 for "The Coffee House".
function getBusinessOrderPrefix(businessName: string): string {
  const letters = businessName.replace(/[^a-zA-Z]/g, "").toUpperCase();
  return (letters + "XXXX").slice(0, 4);
}

// Create a new order
export const createOrder = mutation({
  args: {
    businessId: v.id("businesses"),
    customerName: v.string(),
    customerMobile: v.string(),
    customerAlternateMobile: v.string(),
    customerDoorNumber: v.string(),
    customerAddress: v.string(),
    customerLocation: v.object({
      latitude: v.number(),
      longitude: v.number(),
      label: v.optional(v.string()),
    }),
    items: v.array(
      v.object({
        cartItemId: v.optional(v.string()),
        productId: v.id("products"),
        name: v.string(),
        price: v.number(),
        quantity: v.number(),
        image: v.optional(v.string()),
        customizationNotes: v.optional(v.array(v.string())),
      }),
    ),
    totalAmount: v.number(),
    source: v.string(), // "product" or "cart"
    notes: v.optional(v.string()),
    customerNotes: v.optional(v.string()),
    customizationNotes: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const business = await ctx.db.get(args.businessId);
    if (!business) {
      throw new Error("Business not found");
    }
    if (business.isEnabled === false) {
      throw new Error("This store is currently unavailable");
    }

    const orderSequence = (business.orderSequence ?? 0) + 1;
    const orderId = `${getBusinessOrderPrefix(business.name)}${String(orderSequence).padStart(5, "0")}`;
    await ctx.db.patch(args.businessId, { orderSequence });
    const now = Date.now();

    const order = await ctx.db.insert("orders", {
      orderId,
      businessId: args.businessId,
      customerName: args.customerName,
      customerMobile: args.customerMobile,
      customerAlternateMobile: args.customerAlternateMobile,
      customerDoorNumber: args.customerDoorNumber,
      customerAddress: args.customerAddress,
      customerLocation: args.customerLocation,
      items: args.items,
      totalAmount: args.totalAmount,
      source: args.source,
      status: "pending",
      notes: args.notes,
      customerNotes: args.customerNotes,
      customizationNotes: args.customizationNotes,
      createdAt: now,
      updatedAt: now,
    });

    return { orderId, order };
  },
});

export const generateCustomerUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const resolveCustomerUploadUrl = mutation({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

// Get order by orderId
export const getOrderByOrderId = query({
  args: {
    orderId: v.string(),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db
      .query("orders")
      .withIndex("by_order_id", (q) => q.eq("orderId", args.orderId))
      .first();

    if (!order) {
      return null;
    }

    // Get business info
    const business = await ctx.db.get(order.businessId);

    return {
      ...order,
      business,
    };
  },
});

// Get orders by business ID
export const getBusinessOrders = query({
  args: {
    businessId: v.id("businesses"),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let ordersQuery;

    if (args.status) {
      ordersQuery = ctx.db
        .query("orders")
        .withIndex("by_business_status", (q) =>
          q.eq("businessId", args.businessId).eq("status", args.status!),
        );
    } else {
      ordersQuery = ctx.db
        .query("orders")
        .withIndex("by_business", (q) => q.eq("businessId", args.businessId));
    }

    const orders = await ordersQuery.order("desc").collect();

    return orders;
  },
});

export const getBusinessOrderDetail = query({
  args: {
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const order = await ctx.db.get(args.orderId);
    if (!order) {
      return null;
    }

    const business = await ctx.db.get(order.businessId);
    if (
      !business ||
      (business.ownerId !== user._id && user.role !== "super_admin")
    ) {
      throw new Error("Not authorized");
    }

    const itemsDetailed = await Promise.all(
      order.items.map(async (item) => {
        const product = item.productId
          ? await ctx.db.get(item.productId)
          : null;

        const imageUrls = product
          ? (
              await Promise.all(
                product.imageIds.map((id) => ctx.storage.getUrl(id)),
              )
            ).filter(Boolean)
          : item.image
            ? [item.image]
            : [];

        const category = product?.categoryId
          ? await ctx.db.get(product.categoryId)
          : null;

        return {
          ...item,
          product: product
            ? {
                ...product,
                imageUrls,
                category,
              }
            : null,
        };
      }),
    );

    return {
      ...order,
      business,
      itemsDetailed,
    };
  },
});

// Get orders by customer mobile
export const getOrdersByMobile = query({
  args: {
    mobile: v.string(),
  },
  handler: async (ctx, args) => {
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_customer_mobile", (q) =>
        q.eq("customerMobile", args.mobile),
      )
      .order("desc")
      .collect();

    // Get business info for each order
    const ordersWithBusiness = await Promise.all(
      orders.map(async (order) => {
        const business = await ctx.db.get(order.businessId);
        return {
          ...order,
          business,
        };
      }),
    );

    return ordersWithBusiness;
  },
});

// Update order status
export const updateOrderStatus = mutation({
  args: {
    orderId: v.id("orders"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    await ctx.db.patch(args.orderId, {
      status: args.status,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Keep an order in operational history while excluding it from billing and analytics.
export const setOrderBillingExclusion = mutation({
  args: {
    orderId: v.id("orders"),
    excluded: v.boolean(),
  },
  returns: v.object({
    orderId: v.id("orders"),
    excludedFromBilling: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    await assertBusinessAccess(ctx, order.businessId);
    await ctx.db.patch(args.orderId, {
      excludedFromBilling: args.excluded,
      updatedAt: Date.now(),
    });

    return {
      orderId: order._id,
      excludedFromBilling: args.excluded,
    };
  },
});

// Update order notes
export const updateOrderNotes = mutation({
  args: {
    orderId: v.id("orders"),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    await ctx.db.patch(args.orderId, {
      notes: args.notes,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Get order stats for business
export const getBusinessOrderStats = query({
  args: {
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args) => {
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .collect();

    const stats = {
      total: orders.length,
      pending: 0,
      confirmed: 0,
      preparing: 0,
      ready: 0,
      delivered: 0,
      cancelled: 0,
      totalRevenue: 0,
    };

    orders.forEach((order) => {
      stats[order.status as keyof typeof stats]++;
      if (order.status !== "cancelled" && order.excludedFromBilling !== true) {
        stats.totalRevenue += order.totalAmount;
      }
    });

    return stats;
  },
});

// Create a manual / offline order (merchant entered)
export const createManualOrder = mutation({
  args: {
    businessId: v.id("businesses"),
    customerName: v.string(),
    customerMobile: v.string(),
    customerAlternateMobile: v.optional(v.string()),
    customerDoorNumber: v.optional(v.string()),
    customerAddress: v.optional(v.string()),
    items: v.array(
      v.object({
        productId: v.optional(v.id("products")),
        name: v.string(),
        price: v.number(),
        quantity: v.number(),
        image: v.optional(v.string()),
        customizationNotes: v.optional(v.array(v.string())),
      }),
    ),
    totalAmount: v.number(),
    status: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const business = await ctx.db.get(args.businessId);
    if (
      !business ||
      (business.ownerId !== user._id && user.role !== "super_admin")
    ) {
      throw new Error("Not authorized");
    }

    const orderSequence = (business.orderSequence ?? 0) + 1;
    const orderId = `${getBusinessOrderPrefix(business.name)}${String(orderSequence).padStart(5, "0")}`;
    await ctx.db.patch(args.businessId, { orderSequence });
    const now = Date.now();

    const order = await ctx.db.insert("orders", {
      orderId,
      businessId: args.businessId,
      customerName: args.customerName,
      customerMobile: args.customerMobile,
      customerAlternateMobile: args.customerAlternateMobile,
      customerDoorNumber: args.customerDoorNumber,
      customerAddress: args.customerAddress,
      items: args.items,
      totalAmount: args.totalAmount,
      source: "manual",
      status: args.status ?? "confirmed",
      notes: args.notes,
      createdAt: now,
      updatedAt: now,
    });

    return { orderId, order };
  },
});
