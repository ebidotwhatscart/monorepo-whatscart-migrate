import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const dateRangeValidator = v.union(
  v.object({ type: v.literal("today") }),
  v.object({ type: v.literal("yesterday") }),
  v.object({ type: v.literal("7days") }),
  v.object({ type: v.literal("30days") }),
  v.object({ type: v.literal("alltime") }),
  v.object({ type: v.literal("custom"), from: v.number(), to: v.number() }),
);

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date): Date {
  const end = startOfDay(date);
  end.setDate(end.getDate() + 1);
  end.setMilliseconds(end.getMilliseconds() - 1);
  return end;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getDateRange(range: { type: string; from?: number; to?: number }): {
  from: number;
  to: number;
} {
  const nowDate = new Date();
  const now = nowDate.getTime();
  const todayStart = startOfDay(nowDate);
  const todayEnd = endOfDay(nowDate);

  switch (range.type) {
    case "today":
      return { from: todayStart.getTime(), to: todayEnd.getTime() };
    case "yesterday": {
      const yesterday = addDays(todayStart, -1);
      return { from: yesterday.getTime(), to: endOfDay(yesterday).getTime() };
    }
    case "7days":
      return {
        from: addDays(todayStart, -6).getTime(),
        to: todayEnd.getTime(),
      };
    case "30days":
      return {
        from: addDays(todayStart, -29).getTime(),
        to: todayEnd.getTime(),
      };
    case "alltime":
      return { from: 0, to: now };
    case "custom":
      return { from: range.from!, to: range.to! };
    default:
      return {
        from: addDays(todayStart, -6).getTime(),
        to: todayEnd.getTime(),
      };
  }
}

function isIncludedInBusinessMetrics(order: {
  status: string;
  excludedFromBilling?: boolean;
}): boolean {
  return order.status !== "cancelled" && order.excludedFromBilling !== true;
}

export const trackPageView = mutation({
  args: {
    businessId: v.id("businesses"),
    pageUrl: v.optional(v.string()),
    sessionId: v.string(),
    referrer: v.optional(v.string()),
    utmSource: v.optional(v.string()),
    utmMedium: v.optional(v.string()),
    utmCampaign: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const business = await ctx.db.get(args.businessId);
    if (!business || business.isEnabled === false) return null;

    await ctx.db.insert("pageViews", {
      businessId: args.businessId,
      sessionId: args.sessionId,
      pageUrl: args.pageUrl || "/",
      referrer: args.referrer || "",
      utmSource: args.utmSource,
      utmMedium: args.utmMedium,
      utmCampaign: args.utmCampaign,
      timestamp: Date.now(),
    });
    return null;
  },
});

export const trackProductView = mutation({
  args: {
    businessId: v.id("businesses"),
    productId: v.id("products"),
    sessionId: v.string(),
    utmSource: v.optional(v.string()),
    utmMedium: v.optional(v.string()),
    utmCampaign: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [business, product] = await Promise.all([
      ctx.db.get(args.businessId),
      ctx.db.get(args.productId),
    ]);
    if (
      !business ||
      business.isEnabled === false ||
      !product ||
      product.businessId !== args.businessId
    ) {
      return null;
    }

    await ctx.db.insert("productViews", {
      businessId: args.businessId,
      productId: args.productId,
      sessionId: args.sessionId,
      timestamp: Date.now(),
    });
    await ctx.db.insert("pageViews", {
      businessId: args.businessId,
      sessionId: args.sessionId,
      pageUrl: `/product/${args.productId}`,
      referrer: "",
      utmSource: args.utmSource,
      utmMedium: args.utmMedium,
      utmCampaign: args.utmCampaign,
      timestamp: Date.now(),
    });
    return null;
  },
});

export const trackProductShare = mutation({
  args: {
    businessId: v.id("businesses"),
    productId: v.id("products"),
    sessionId: v.string(),
    channel: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [business, product] = await Promise.all([
      ctx.db.get(args.businessId),
      ctx.db.get(args.productId),
    ]);
    if (
      !business ||
      business.isEnabled === false ||
      !product ||
      product.businessId !== args.businessId
    ) {
      return null;
    }

    await ctx.db.insert("productShares", {
      businessId: args.businessId,
      productId: args.productId,
      sessionId: args.sessionId,
      channel: args.channel,
      timestamp: Date.now(),
    });
    return null;
  },
});

// Query functions

export const getTotalVisitors = query({
  args: {
    businessId: v.id("businesses"),
    dateRange: dateRangeValidator,
  },
  handler: async (ctx, args) => {
    const { from, to } = getDateRange(args.dateRange);
    const views = await ctx.db
      .query("pageViews")
      .withIndex("by_business_timestamp", (q) =>
        q
          .eq("businessId", args.businessId)
          .gte("timestamp", from)
          .lte("timestamp", to),
      )
      .collect();

    const uniqueSessions = new Set(views.map((v) => v.sessionId));
    return uniqueSessions.size;
  },
});

export const getTotalPageViews = query({
  args: {
    businessId: v.id("businesses"),
    dateRange: dateRangeValidator,
  },
  handler: async (ctx, args) => {
    const { from, to } = getDateRange(args.dateRange);
    const views = await ctx.db
      .query("pageViews")
      .withIndex("by_business_timestamp", (q) =>
        q
          .eq("businessId", args.businessId)
          .gte("timestamp", from)
          .lte("timestamp", to),
      )
      .collect();
    return views.length;
  },
});

export const getTrafficSources = query({
  args: {
    businessId: v.id("businesses"),
    dateRange: dateRangeValidator,
  },
  handler: async (ctx, args) => {
    const { from, to } = getDateRange(args.dateRange);
    const views = await ctx.db
      .query("pageViews")
      .withIndex("by_business_timestamp", (q) =>
        q
          .eq("businessId", args.businessId)
          .gte("timestamp", from)
          .lte("timestamp", to),
      )
      .collect();

    const total = views.length;
    const sourceCounts: Record<string, number> = {};

    views.forEach((v) => {
      const source = v.utmSource || "organic";
      sourceCounts[source] = (sourceCounts[source] || 0) + 1;
    });

    return Object.entries(sourceCounts)
      .map(([source, count]) => ({
        source,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  },
});

export const getSalesTrend = query({
  args: {
    businessId: v.id("businesses"),
    dateRange: dateRangeValidator,
    groupBy: v.optional(
      v.union(v.literal("day"), v.literal("week"), v.literal("month")),
    ),
  },
  handler: async (ctx, args) => {
    const { from, to } = getDateRange(args.dateRange);
    const groupBy = args.groupBy || "day";

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .collect();

    const filteredOrders = orders.filter(
      (o) =>
        o.createdAt >= from &&
        o.createdAt <= to &&
        isIncludedInBusinessMetrics(o),
    );

    const trend: Record<string, { revenue: number; orders: number }> = {};

    filteredOrders.forEach((order) => {
      const date = new Date(order.createdAt);
      let key: string;

      if (groupBy === "day") {
        key = date.toISOString().split("T")[0];
      } else if (groupBy === "week") {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split("T")[0];
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      }

      if (!trend[key]) {
        trend[key] = { revenue: 0, orders: 0 };
      }
      trend[key].revenue += order.totalAmount;
      trend[key].orders += 1;
    });

    return Object.entries(trend)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  },
});

export const getTopProducts = query({
  args: {
    businessId: v.id("businesses"),
    dateRange: dateRangeValidator,
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { from, to } = getDateRange(args.dateRange);
    const limit = args.limit || 10;

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .collect();

    const filteredOrders = orders.filter(
      (o) =>
        o.createdAt >= from &&
        o.createdAt <= to &&
        isIncludedInBusinessMetrics(o),
    );

    const productStats: Record<
      string,
      { name: string; sold: number; revenue: number }
    > = {};

    const products = await ctx.db
      .query("products")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .collect();

    const productMap = new Map(products.map((p) => [p._id, p.name]));

    filteredOrders.forEach((order) => {
      order.items.forEach((item) => {
        const itemKey = item.productId ?? `custom_${item.name}`;
        if (!productStats[itemKey]) {
          productStats[itemKey] = {
            name:
              item.name ||
              (item.productId ? productMap.get(item.productId) : undefined) ||
              "Unknown Item",
            sold: 0,
            revenue: 0,
          };
        }
        productStats[itemKey].sold += item.quantity;
        productStats[itemKey].revenue += item.price * item.quantity;
      });
    });

    return Object.entries(productStats)
      .map(([productId, data]) => ({ productId, ...data }))
      .sort((a, b) => b.sold - a.sold)
      .slice(0, limit);
  },
});

export const getTopCustomers = query({
  args: {
    businessId: v.id("businesses"),
    dateRange: dateRangeValidator,
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { from, to } = getDateRange(args.dateRange);
    const limit = args.limit || 10;

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .collect();

    const filteredOrders = orders.filter(
      (o) =>
        o.createdAt >= from &&
        o.createdAt <= to &&
        isIncludedInBusinessMetrics(o),
    );

    const customerStats: Record<
      string,
      { name: string; totalSpend: number; orders: number }
    > = {};

    filteredOrders.forEach((order) => {
      const mobile = order.customerMobile;
      if (!customerStats[mobile]) {
        customerStats[mobile] = {
          name: order.customerName,
          totalSpend: 0,
          orders: 0,
        };
      }
      customerStats[mobile].totalSpend += order.totalAmount;
      customerStats[mobile].orders += 1;
    });

    return Object.entries(customerStats)
      .map(([mobile, data]) => ({ mobile, ...data }))
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, limit);
  },
});

export const getTotalRevenue = query({
  args: {
    businessId: v.id("businesses"),
    dateRange: dateRangeValidator,
  },
  handler: async (ctx, args) => {
    const { from, to } = getDateRange(args.dateRange);

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .collect();

    const filteredOrders = orders.filter(
      (o) =>
        o.createdAt >= from &&
        o.createdAt <= to &&
        isIncludedInBusinessMetrics(o),
    );

    return filteredOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  },
});

export const getTotalOrders = query({
  args: {
    businessId: v.id("businesses"),
    dateRange: dateRangeValidator,
  },
  handler: async (ctx, args) => {
    const { from, to } = getDateRange(args.dateRange);

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .collect();

    const filteredOrders = orders.filter(
      (o) =>
        o.createdAt >= from &&
        o.createdAt <= to &&
        isIncludedInBusinessMetrics(o),
    );

    return filteredOrders.length;
  },
});

export const getConversionRate = query({
  args: {
    businessId: v.id("businesses"),
    dateRange: dateRangeValidator,
  },
  handler: async (ctx, args) => {
    const { from, to } = getDateRange(args.dateRange);

    const uniqueSessions = await ctx.db
      .query("pageViews")
      .withIndex("by_business_timestamp", (q) =>
        q
          .eq("businessId", args.businessId)
          .gte("timestamp", from)
          .lte("timestamp", to),
      )
      .collect();

    const sessions = new Set(uniqueSessions.map((v) => v.sessionId));
    const uniqueVisitors = sessions.size;

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .collect();

    const orderCount = orders.filter(
      (o) =>
        o.createdAt >= from &&
        o.createdAt <= to &&
        isIncludedInBusinessMetrics(o),
    ).length;

    return uniqueVisitors > 0
      ? Math.round((orderCount / uniqueVisitors) * 100)
      : 0;
  },
});

export const getProductPerformance = query({
  args: {
    businessId: v.id("businesses"),
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product || product.businessId !== args.businessId) {
      return {
        totalViews: 0,
        timesShared: 0,
      };
    }

    const views = await ctx.db
      .query("productViews")
      .withIndex("by_business_product", (q) =>
        q.eq("businessId", args.businessId).eq("productId", args.productId),
      )
      .collect();

    const shares = await ctx.db
      .query("productShares")
      .withIndex("by_business_product", (q) =>
        q.eq("businessId", args.businessId).eq("productId", args.productId),
      )
      .collect();

    return {
      totalViews: views.length,
      timesShared: shares.length,
    };
  },
});
