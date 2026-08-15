import type { DocumentData, Firestore } from "firebase-admin/firestore";

import { assertOwnedBusiness } from "./private-inventory";

type UnknownRecord = Record<string, unknown>;

const ORDER_STATUSES = new Set([
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "delivered",
  "cancelled",
]);

function requiredString(value: unknown, field: string, maxLength: number) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.trim().length > maxLength
  ) {
    throw new Error(`${field} is invalid.`);
  }
  return value.trim();
}

function optionalString(value: unknown, field: string, maxLength: number) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || value.trim().length > maxLength) {
    throw new Error(`${field} is invalid.`);
  }
  return value.trim();
}

function finiteNumber(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${field} is invalid.`);
  }
  return value;
}

function withoutUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutUndefined);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as UnknownRecord)
        .filter(([, child]) => child !== undefined)
        .map(([key, child]) => [key, withoutUndefined(child)]),
    );
  }
  return value;
}

function businessOrderPrefix(businessName: string) {
  const letters = businessName.replace(/[^a-zA-Z]/g, "").toUpperCase();
  return (letters + "XXXX").slice(0, 4);
}

function validatedNotes(value: unknown, field: string) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 20) {
    throw new Error(`${field} is invalid.`);
  }
  return value.map((line) => requiredString(line, field, 500));
}

async function validateManualItems(
  firestore: Firestore,
  businessId: string,
  value: unknown,
) {
  if (!Array.isArray(value) || !value.length || value.length > 50) {
    throw new Error("Order items are invalid.");
  }
  const items = value.map((rawItem) => {
    if (!rawItem || typeof rawItem !== "object") {
      throw new Error("Order items are invalid.");
    }
    const item = rawItem as UnknownRecord;
    const quantity = finiteNumber(item.quantity, "quantity");
    const price = finiteNumber(item.price, "price");
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      throw new Error("quantity is invalid.");
    }
    if (price < 0 || price > 100_000_000) {
      throw new Error("price is invalid.");
    }
    return {
      customizationNotes: validatedNotes(
        item.customizationNotes,
        "customizationNotes",
      ),
      image: optionalString(item.image, "image", 2_000),
      name: requiredString(item.name, "item name", 300),
      price,
      productId: optionalString(item.productId, "productId", 300),
      quantity,
    };
  });

  const productIds = [
    ...new Set(
      items
        .map((item) => item.productId)
        .filter((value): value is string => typeof value === "string"),
    ),
  ];
  const products = await Promise.all(
    productIds.map((productId) =>
      firestore.collection("products").doc(productId).get(),
    ),
  );
  if (
    products.some(
      (product) =>
        !product.exists || product.data()?.businessId !== businessId,
    )
  ) {
    throw new Error("A selected product is invalid.");
  }
  return items;
}

async function assertOrderAccess(
  firestore: Firestore,
  orderId: string,
  userId: string,
  isSuperAdmin: boolean,
) {
  const order = await firestore.collection("orders").doc(orderId).get();
  if (!order.exists) throw new Error("Order not found.");
  await assertOwnedBusiness(
    firestore,
    requiredString(order.data()?.businessId, "businessId", 300),
    userId,
    isSuperAdmin,
  );
  return order;
}

export async function createOwnedManualOrder(
  firestore: Firestore,
  userId: string,
  isSuperAdmin: boolean,
  rawBody: unknown,
) {
  if (!rawBody || typeof rawBody !== "object") {
    throw new Error("Order is invalid.");
  }
  const body = rawBody as UnknownRecord;
  const businessId = requiredString(body.businessId, "businessId", 300);
  await assertOwnedBusiness(firestore, businessId, userId, isSuperAdmin);
  const items = await validateManualItems(firestore, businessId, body.items);
  const totalAmount = items.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );
  if (
    Math.abs(finiteNumber(body.totalAmount, "totalAmount") - totalAmount) >=
    0.01
  ) {
    throw new Error("Order total is invalid.");
  }
  const status =
    body.status === undefined
      ? "confirmed"
      : requiredString(body.status, "status", 30);
  if (!ORDER_STATUSES.has(status)) throw new Error("Order status is invalid.");

  const businessRef = firestore.collection("businesses").doc(businessId);
  const orderRef = firestore.collection("orders").doc();
  const now = Date.now();
  let orderId = "";
  await firestore.runTransaction(async (transaction) => {
    const business = await transaction.get(businessRef);
    const businessData = business.data();
    if (
      !business.exists ||
      !businessData ||
      (!isSuperAdmin && businessData.ownerId !== userId)
    ) {
      throw new Error("Business access is denied.");
    }
    const orderSequence = Number(businessData.orderSequence ?? 0) + 1;
    orderId = `${businessOrderPrefix(String(businessData.name ?? ""))}${String(orderSequence).padStart(5, "0")}`;
    transaction.update(businessRef, { orderSequence });
    transaction.create(orderRef, withoutUndefined({
      businessId,
      createdAt: now,
      customerAddress: optionalString(
        body.customerAddress,
        "customerAddress",
        1_000,
      ),
      customerAlternateMobile: optionalString(
        body.customerAlternateMobile,
        "customerAlternateMobile",
        30,
      ),
      customerDoorNumber: optionalString(
        body.customerDoorNumber,
        "customerDoorNumber",
        120,
      ),
      customerMobile: requiredString(
        body.customerMobile,
        "customerMobile",
        30,
      ),
      customerName: requiredString(body.customerName, "customerName", 200),
      items,
      notes: optionalString(body.notes, "notes", 2_000),
      orderId,
      source: "manual",
      status,
      totalAmount,
      updatedAt: now,
    }) as DocumentData);
  });
  return { order: orderRef.id, orderId };
}

export async function setOwnedOrderBillingExclusion(
  firestore: Firestore,
  userId: string,
  isSuperAdmin: boolean,
  rawBody: unknown,
) {
  if (!rawBody || typeof rawBody !== "object") {
    throw new Error("Order update is invalid.");
  }
  const body = rawBody as UnknownRecord;
  const orderId = requiredString(body.orderId, "orderId", 300);
  if (typeof body.excluded !== "boolean") {
    throw new Error("excluded is invalid.");
  }
  const order = await assertOrderAccess(
    firestore,
    orderId,
    userId,
    isSuperAdmin,
  );
  await order.ref.update({
    excludedFromBilling: body.excluded,
    updatedAt: Date.now(),
  });
  return { excludedFromBilling: body.excluded, orderId: order.id };
}

export async function updateOwnedOrderNotes(
  firestore: Firestore,
  userId: string,
  isSuperAdmin: boolean,
  rawBody: unknown,
) {
  if (!rawBody || typeof rawBody !== "object") {
    throw new Error("Order update is invalid.");
  }
  const body = rawBody as UnknownRecord;
  const orderId = requiredString(body.orderId, "orderId", 300);
  const order = await assertOrderAccess(
    firestore,
    orderId,
    userId,
    isSuperAdmin,
  );
  await order.ref.update({
    notes: requiredString(body.notes, "notes", 2_000),
    updatedAt: Date.now(),
  });
  return { success: true };
}
