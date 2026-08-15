"use client";

import {
  collection,
  onSnapshot,
  query,
  where,
  type DocumentData,
  type Firestore,
  type Query,
  type Unsubscribe,
} from "firebase/firestore";

type QueryArgs = Record<string, unknown>;
type Emit = (value: unknown) => void;
type Fail = (error: Error) => void;

function requiredString(args: QueryArgs, key: string) {
  const value = args[key];
  if (typeof value !== "string" || !value) {
    throw new Error(`Firebase analytics argument ${key} is required.`);
  }
  return value;
}

function dateRange(args: QueryArgs) {
  const range =
    args.dateRange && typeof args.dateRange === "object"
      ? (args.dateRange as QueryArgs)
      : {};
  const now = new Date();
  const todayStart = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const todayEnd = todayStart + 24 * 60 * 60 * 1_000 - 1;
  const day = 24 * 60 * 60 * 1_000;
  switch (range.type) {
    case "today":
      return { from: todayStart, to: todayEnd };
    case "yesterday":
      return { from: todayStart - day, to: todayStart - 1 };
    case "30days":
      return { from: todayStart - 29 * day, to: todayEnd };
    case "alltime":
      return { from: 0, to: Date.now() };
    case "custom": {
      if (typeof range.from !== "number" || typeof range.to !== "number") {
        throw new Error("Firebase analytics date range is invalid.");
      }
      return { from: range.from, to: range.to };
    }
    case "7days":
    default:
      return { from: todayStart - 6 * day, to: todayEnd };
  }
}

function businessRangeQuery(
  firestore: Firestore,
  collectionName: "orders" | "pageViews",
  businessId: string,
  timestampField: "createdAt" | "timestamp",
  from: number,
  to: number,
) {
  return query(
    collection(firestore, collectionName),
    where("businessId", "==", businessId),
    where(timestampField, ">=", from),
    where(timestampField, "<=", to),
  );
}

function includedOrders(orders: DocumentData[]) {
  return orders.filter(
    (order) =>
      order.status !== "cancelled" && order.excludedFromBilling !== true,
  );
}

function documents(snapshot: { docs: Array<{ data(): DocumentData }> }) {
  return snapshot.docs.map((entry) => entry.data());
}

function observeOne(
  source: Query<DocumentData>,
  compute: (values: DocumentData[]) => unknown,
  emit: Emit,
  fail: Fail,
) {
  return onSnapshot(source, (snapshot) => emit(compute(documents(snapshot))), fail);
}

function observeMany(
  sources: Query<DocumentData>[],
  compute: (values: DocumentData[][]) => unknown,
  emit: Emit,
  fail: Fail,
) {
  const values: Array<DocumentData[] | undefined> = sources.map(() => undefined);
  let closed = false;
  const subscriptions = sources.map((source, index) =>
    onSnapshot(
      source,
      (snapshot) => {
        values[index] = documents(snapshot);
        if (!closed && values.every((value) => value !== undefined)) {
          emit(compute(values as DocumentData[][]));
        }
      },
      fail,
    ),
  );
  return () => {
    closed = true;
    subscriptions.forEach((unsubscribe) => unsubscribe());
  };
}

function analyticsLimit(args: QueryArgs, fallback: number) {
  const value = args.limit;
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error("Firebase analytics limit is invalid.");
  }
  return Math.min(value, 100);
}

function topProducts(orders: DocumentData[], limit: number) {
  const stats = new Map<
    string,
    { name: string; revenue: number; sold: number }
  >();
  includedOrders(orders).forEach((order) => {
    const items = Array.isArray(order.items) ? order.items : [];
    items.forEach((rawItem) => {
      const item = rawItem as DocumentData;
      const name = typeof item.name === "string" ? item.name : "Unknown Item";
      const key =
        typeof item.productId === "string" ? item.productId : `custom_${name}`;
      const current = stats.get(key) ?? { name, revenue: 0, sold: 0 };
      const quantity = typeof item.quantity === "number" ? item.quantity : 0;
      const price = typeof item.price === "number" ? item.price : 0;
      current.sold += quantity;
      current.revenue += price * quantity;
      stats.set(key, current);
    });
  });
  return [...stats.entries()]
    .map(([productId, value]) => ({ productId, ...value }))
    .sort((left, right) => right.sold - left.sold)
    .slice(0, limit);
}

function salesTrend(orders: DocumentData[], groupBy: string) {
  const trend = new Map<string, { orders: number; revenue: number }>();
  includedOrders(orders).forEach((order) => {
    if (typeof order.createdAt !== "number") return;
    const date = new Date(order.createdAt);
    let key: string;
    if (groupBy === "week") {
      const weekStart = new Date(date);
      weekStart.setUTCDate(date.getUTCDate() - date.getUTCDay());
      key = weekStart.toISOString().split("T")[0];
    } else if (groupBy === "month") {
      key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    } else {
      key = date.toISOString().split("T")[0];
    }
    const current = trend.get(key) ?? { orders: 0, revenue: 0 };
    current.orders += 1;
    current.revenue +=
      typeof order.totalAmount === "number" ? order.totalAmount : 0;
    trend.set(key, current);
  });
  return [...trend.entries()]
    .map(([date, value]) => ({ date, ...value }))
    .sort((left, right) => left.date.localeCompare(right.date));
}

function topCustomers(orders: DocumentData[], limit: number) {
  const stats = new Map<
    string,
    { name: string; orders: number; totalSpend: number }
  >();
  includedOrders(orders).forEach((order) => {
    if (typeof order.customerMobile !== "string") return;
    const current = stats.get(order.customerMobile) ?? {
      name:
        typeof order.customerName === "string" ? order.customerName : "Customer",
      orders: 0,
      totalSpend: 0,
    };
    current.orders += 1;
    current.totalSpend +=
      typeof order.totalAmount === "number" ? order.totalAmount : 0;
    stats.set(order.customerMobile, current);
  });
  return [...stats.entries()]
    .map(([mobile, value]) => ({ mobile, ...value }))
    .sort((left, right) => right.totalSpend - left.totalSpend)
    .slice(0, limit);
}

export function observeFirebaseAnalyticsQuery(
  firestore: Firestore,
  functionName: string,
  args: QueryArgs,
  userId: string | null,
  emit: Emit,
  fail: Fail,
): Unsubscribe {
  if (!userId) {
    emit(undefined);
    return () => undefined;
  }
  const businessId = requiredString(args, "businessId");
  const { from, to } = dateRange(args);
  const orders = businessRangeQuery(
    firestore,
    "orders",
    businessId,
    "createdAt",
    from,
    to,
  );
  const pageViews = businessRangeQuery(
    firestore,
    "pageViews",
    businessId,
    "timestamp",
    from,
    to,
  );

  switch (functionName) {
    case "analytics:getTotalRevenue":
      return observeOne(
        orders,
        (values) =>
          includedOrders(values).reduce(
            (total, order) =>
              total +
              (typeof order.totalAmount === "number" ? order.totalAmount : 0),
            0,
          ),
        emit,
        fail,
      );
    case "analytics:getTotalOrders":
      return observeOne(
        orders,
        (values) => includedOrders(values).length,
        emit,
        fail,
      );
    case "analytics:getTotalVisitors":
      return observeOne(
        pageViews,
        (values) =>
          new Set(
            values
              .map((value) => value.sessionId)
              .filter((value): value is string => typeof value === "string"),
          ).size,
        emit,
        fail,
      );
    case "analytics:getTotalPageViews":
      return observeOne(pageViews, (values) => values.length, emit, fail);
    case "analytics:getTopProducts":
      return observeOne(
        orders,
        (values) => topProducts(values, analyticsLimit(args, 10)),
        emit,
        fail,
      );
    case "analytics:getSalesTrend": {
      const groupBy =
        args.groupBy === "week" || args.groupBy === "month"
          ? args.groupBy
          : "day";
      return observeOne(
        orders,
        (values) => salesTrend(values, groupBy),
        emit,
        fail,
      );
    }
    case "analytics:getTrafficSources":
      return observeOne(
        pageViews,
        (values) => {
          const counts = new Map<string, number>();
          values.forEach((value) => {
            const source =
              typeof value.utmSource === "string" && value.utmSource
                ? value.utmSource
                : "organic";
            counts.set(source, (counts.get(source) ?? 0) + 1);
          });
          return [...counts.entries()]
            .map(([source, count]) => ({
              count,
              percentage: values.length
                ? Math.round((count / values.length) * 100)
                : 0,
              source,
            }))
            .sort((left, right) => right.count - left.count);
        },
        emit,
        fail,
      );
    case "analytics:getTopCustomers":
      return observeOne(
        orders,
        (values) => topCustomers(values, analyticsLimit(args, 10)),
        emit,
        fail,
      );
    case "analytics:getConversionRate":
      return observeMany(
        [pageViews, orders],
        ([views, orderValues]) => {
          const visitors = new Set(
            views
              .map((view) => view.sessionId)
              .filter((value): value is string => typeof value === "string"),
          ).size;
          return visitors
            ? Math.round((includedOrders(orderValues).length / visitors) * 100)
            : 0;
        },
        emit,
        fail,
      );
    case "analytics:getProductPerformance": {
      const productId = requiredString(args, "productId");
      const views = query(
        collection(firestore, "productViews"),
        where("businessId", "==", businessId),
        where("productId", "==", productId),
      );
      const shares = query(
        collection(firestore, "productShares"),
        where("businessId", "==", businessId),
        where("productId", "==", productId),
      );
      return observeMany(
        [views, shares],
        ([viewValues, shareValues]) => ({
          timesShared: shareValues.length,
          totalViews: viewValues.length,
        }),
        emit,
        fail,
      );
    }
    default:
      fail(new Error(`Firebase analytics query is not implemented: ${functionName}`));
      return () => undefined;
  }
}
