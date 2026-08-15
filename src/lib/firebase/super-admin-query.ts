"use client";

import {
  collection,
  doc,
  onSnapshot,
  type DocumentData,
  type Firestore,
  type Unsubscribe,
} from "firebase/firestore";

import { businessValue } from "./documents";

type QueryArgs = Record<string, unknown>;
type Emit = (value: unknown) => void;
type Fail = (error: Error) => void;

function requiredString(args: QueryArgs, key: string) {
  const value = args[key];
  if (typeof value !== "string" || !value) {
    throw new Error(`Firebase super-admin argument ${key} is required.`);
  }
  return value;
}

function observeBusinessList(
  firestore: Firestore,
  emit: Emit,
  fail: Fail,
) {
  const values: Record<
    "businesses" | "orders" | "products" | "users",
    DocumentData[] | undefined
  > = {
    businesses: undefined,
    orders: undefined,
    products: undefined,
    users: undefined,
  };
  let closed = false;
  const update = () => {
    if (closed || Object.values(values).some((value) => value === undefined)) {
      return;
    }
    const users = new Map(
      values.users!.map((user) => [String(user._id), user]),
    );
    const productCounts = new Map<string, number>();
    values.products!.forEach((product) => {
      const businessId = String(product.businessId ?? "");
      productCounts.set(businessId, (productCounts.get(businessId) ?? 0) + 1);
    });
    const orderCounts = new Map<string, number>();
    values.orders!.forEach((order) => {
      const businessId = String(order.businessId ?? "");
      orderCounts.set(businessId, (orderCounts.get(businessId) ?? 0) + 1);
    });
    emit(
      values.businesses!
        .map((business) => {
          const ownerId = String(business.ownerId ?? "");
          const owner = users.get(ownerId);
          return {
            _id: business._id,
            createdAt: business._creationTime,
            isEnabled: business.isEnabled !== false,
            name: business.name,
            orderCount: orderCounts.get(String(business._id)) ?? 0,
            ownerEmail: owner?.email ?? "",
            ownerId,
            ownerName: business.ownerName ?? owner?.name ?? "Unknown owner",
            productCount: productCounts.get(String(business._id)) ?? 0,
            slug: business.slug,
          };
        })
        .sort((left, right) =>
          String(left.name).localeCompare(String(right.name)),
        ),
    );
  };
  const subscribe = (
    name: keyof typeof values,
    collectionName: string,
  ): Unsubscribe =>
    onSnapshot(
      collection(firestore, collectionName),
      (snapshot) => {
        values[name] = snapshot.docs.map((entry) => ({
          ...entry.data(),
          _creationTime:
            typeof entry.data().createdAt === "number"
              ? entry.data().createdAt
              : 0,
          _id: entry.id,
        }));
        update();
      },
      fail,
    );
  const subscriptions = [
    subscribe("businesses", "businesses"),
    subscribe("orders", "orders"),
    subscribe("products", "products"),
    subscribe("users", "users"),
  ];
  return () => {
    closed = true;
    subscriptions.forEach((unsubscribe) => unsubscribe());
  };
}

export function observeFirebaseSuperAdminQuery(
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
  switch (functionName) {
    case "superAdmin:listBusinesses":
      return observeBusinessList(firestore, emit, fail);
    case "superAdmin:getBusinessForAdmin": {
      const businessId = requiredString(args, "businessId");
      return onSnapshot(
        doc(firestore, "businesses", businessId),
        (snapshot) =>
          emit(snapshot.exists() ? businessValue(snapshot) : null),
        fail,
      );
    }
    default:
      fail(
        new Error(`Firebase super-admin query is not implemented: ${functionName}`),
      );
      return () => undefined;
  }
}
