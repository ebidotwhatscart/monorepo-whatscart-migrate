import { createHash, randomBytes } from "node:crypto";
import type {
  DocumentData,
  DocumentSnapshot,
  Firestore,
} from "firebase-admin/firestore";

type UnknownRecord = Record<string, unknown>;

const ACCESS_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,256}$/;
const INDIAN_MOBILE_PATTERN = /^[6-9]\d{9}$/;
const MAX_ITEMS = 100;

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

function publicDocument(
  snapshot: DocumentSnapshot<DocumentData>,
): UnknownRecord & { _creationTime: number; _id: string } {
  const data = snapshot.data() ?? {};
  const createdAt = data.createdAt;
  return {
    ...data,
    _creationTime:
      typeof createdAt === "number"
        ? createdAt
        : typeof data._creationTime === "number"
          ? data._creationTime
          : 0,
    _id: snapshot.id,
  };
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

export function validateCustomerAccessToken(token: string | null) {
  if (!token || !ACCESS_TOKEN_PATTERN.test(token)) {
    throw new Error("Customer access token is invalid.");
  }
  return token;
}

export function hashCustomerAccessToken(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

export function accessTokenMatches(token: string | null, hash: unknown) {
  return Boolean(
    token &&
      ACCESS_TOKEN_PATTERN.test(token) &&
      typeof hash === "string" &&
      hashCustomerAccessToken(token) === hash,
  );
}

function getBusinessOrderPrefix(businessName: string) {
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

type ValidatedItem = {
  cartItemId?: string;
  customizationNotes?: string[];
  image?: string;
  name: string;
  price: number;
  productId: string;
  quantity: number;
};

async function validateItems(
  firestore: Firestore,
  businessId: string,
  value: unknown,
): Promise<{ items: ValidatedItem[]; totalAmount: number }> {
  if (!Array.isArray(value) || !value.length || value.length > MAX_ITEMS) {
    throw new Error("Order items are invalid.");
  }

  const input = value as UnknownRecord[];
  const productIds = input.map((item) =>
    requiredString(item.productId, "productId", 160),
  );
  const uniqueIds = [...new Set(productIds)];
  const snapshots = await firestore.getAll(
    ...uniqueIds.map((id) => firestore.collection("products").doc(id)),
  );
  const products = new Map(
    snapshots.filter((snapshot) => snapshot.exists).map((snapshot) => [
      snapshot.id,
      snapshot.data()!,
    ]),
  );

  const items = input.map((item, index): ValidatedItem => {
    const productId = productIds[index];
    const product = products.get(productId);
    if (
      !product ||
      product.businessId !== businessId ||
      product.inStock === false
    ) {
      throw new Error("A selected product is unavailable.");
    }

    const quantity = finiteNumber(item.quantity, "quantity");
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      throw new Error("Item quantity is invalid.");
    }
    const suppliedPrice = finiteNumber(item.price, "price");
    const allowedPrices = [
      product.price,
      ...(Array.isArray(product.sizes)
        ? product.sizes.map((size: UnknownRecord) => size.price)
        : []),
    ].filter(
      (price): price is number =>
        typeof price === "number" && Number.isFinite(price) && price >= 0,
    );
    if (
      suppliedPrice < 0 ||
      (!allowedPrices.some((price) => Math.abs(price - suppliedPrice) < 0.01) &&
       !allowedPrices.some((price) => suppliedPrice <= price + 0.01))
    ) {
      throw new Error("A selected product price is invalid.");
    }

    const imageUrls = Array.isArray(product.imageUrls)
      ? product.imageUrls.filter((url): url is string => typeof url === "string")
      : [];
    return {
      cartItemId: optionalString(item.cartItemId, "cartItemId", 240),
      customizationNotes: validatedNotes(
        item.customizationNotes,
        "customizationNotes",
      ),
      image: imageUrls[0],
      name: requiredString(product.name, "product name", 300),
      price: suppliedPrice,
      productId,
      quantity,
    };
  });

  return {
    items,
    totalAmount: items.reduce(
      (total, item) => total + item.price * item.quantity,
      0,
    ),
  };
}

export async function createPublicOrder(
  firestore: Firestore,
  rawBody: unknown,
  rawCustomerAccessToken: string | null,
) {
  if (!rawBody || typeof rawBody !== "object") {
    throw new Error("Order is invalid.");
  }
  const body = rawBody as UnknownRecord;
  const customerAccessToken = validateCustomerAccessToken(
    rawCustomerAccessToken,
  );
  const businessId = requiredString(body.businessId, "businessId", 160);
  const businessRef = firestore.collection("businesses").doc(businessId);
  const businessSnapshot = await businessRef.get();
  const business = businessSnapshot.data();
  if (!businessSnapshot.exists || !business) {
    throw new Error("Business not found.");
  }
  if (business.isEnabled === false) {
    throw new Error("This store is currently unavailable.");
  }

  const customerName = requiredString(body.customerName, "customerName", 200);
  const customerMobile = requiredString(
    body.customerMobile,
    "customerMobile",
    10,
  );
  const customerAlternateMobile = requiredString(
    body.customerAlternateMobile,
    "customerAlternateMobile",
    10,
  );
  if (
    !INDIAN_MOBILE_PATTERN.test(customerMobile) ||
    !INDIAN_MOBILE_PATTERN.test(customerAlternateMobile)
  ) {
    throw new Error("Customer mobile number is invalid.");
  }
  const customerDoorNumber = requiredString(
    body.customerDoorNumber,
    "customerDoorNumber",
    120,
  );
  const customerAddress = requiredString(
    body.customerAddress,
    "customerAddress",
    1_000,
  );
  const location = body.customerLocation as UnknownRecord | undefined;
  if (!location || typeof location !== "object") {
    throw new Error("Customer location is invalid.");
  }
  const latitude = finiteNumber(location.latitude, "latitude");
  const longitude = finiteNumber(location.longitude, "longitude");
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error("Customer location is invalid.");
  }
  const { items, totalAmount } = await validateItems(
    firestore,
    businessId,
    body.items,
  );
  const discountAmount =
    typeof body.discountAmount === "number" &&
    Number.isFinite(body.discountAmount) &&
    body.discountAmount > 0
      ? body.discountAmount
      : 0;
  const expectedTotal = Math.max(0, totalAmount - discountAmount);
  const suppliedTotal = finiteNumber(body.totalAmount, "totalAmount");
  if (Math.abs(suppliedTotal - expectedTotal) >= 0.05 && Math.abs(suppliedTotal - totalAmount) >= 0.05) {
    throw new Error("Order total is invalid.");
  }
  const finalTotalAmount = Math.abs(suppliedTotal - expectedTotal) < 0.05 ? suppliedTotal : totalAmount;
  const source = requiredString(body.source, "source", 20);
  if (source !== "cart" && source !== "product") {
    throw new Error("Order source is invalid.");
  }

  const orderAccessToken = randomBytes(32).toString("base64url");
  const now = Date.now();
  const orderRef = firestore.collection("orders").doc();
  let orderId = "";
  await firestore.runTransaction(async (transaction) => {
    const freshBusiness = await transaction.get(businessRef);
    const data = freshBusiness.data();
    if (!freshBusiness.exists || !data || data.isEnabled === false) {
      throw new Error("This store is currently unavailable.");
    }
    const orderSequence = Number(data.orderSequence ?? 0) + 1;
    orderId = `${getBusinessOrderPrefix(String(data.name ?? ""))}${String(orderSequence).padStart(5, "0")}`;
    transaction.update(businessRef, { orderSequence });
    transaction.create(
      orderRef,
      withoutUndefined({
        businessId,
        createdAt: now,
        customerAccessHash: hashCustomerAccessToken(customerAccessToken),
        customerAddress,
        customerAlternateMobile,
        customerDoorNumber,
        customerLocation: {
          label: optionalString(location.label, "location label", 300),
          latitude,
          longitude,
        },
        customerMobile,
        customerName,
        customerNotes: optionalString(body.customerNotes, "customerNotes", 2_000),
        customizationNotes: validatedNotes(
          body.customizationNotes,
          "customizationNotes",
        ),
        discountAmount: typeof body.discountAmount === "number" && Number.isFinite(body.discountAmount) && body.discountAmount > 0 ? body.discountAmount : undefined,
        couponCode: optionalString(body.couponCode, "couponCode", 50),
        items,
        notes: optionalString(body.notes, "notes", 2_000),
        orderAccessHash: hashCustomerAccessToken(orderAccessToken),
        orderId,
        source,
        status: "pending",
        totalAmount: finalTotalAmount,
        updatedAt: now,
      }) as DocumentData,
    );
  });

  return { accessToken: orderAccessToken, order: orderRef.id, orderId, totalAmount: finalTotalAmount };
}

export async function savePublicCart(
  firestore: Firestore,
  rawBody: unknown,
  rawCustomerAccessToken: string | null,
  rawOrderAccessToken: string | null,
) {
  if (!rawBody || typeof rawBody !== "object") {
    throw new Error("Cart is invalid.");
  }
  const body = rawBody as UnknownRecord;
  const customerAccessToken = validateCustomerAccessToken(
    rawCustomerAccessToken,
  );
  const orderAccessToken = validateCustomerAccessToken(rawOrderAccessToken);
  const businessId = requiredString(body.businessId, "businessId", 160);
  const cartId = requiredString(body.cartId, "cartId", 160);
  if (cartId.includes("/")) throw new Error("cartId is invalid.");
  const business = await firestore.collection("businesses").doc(businessId).get();
  if (!business.exists || business.data()?.isEnabled === false) return null;
  const { items, totalAmount } = await validateItems(
    firestore,
    businessId,
    body.products,
  );
  const suppliedTotal = finiteNumber(body.totalAmount, "totalAmount");
  if (Math.abs(suppliedTotal - totalAmount) >= 0.01) {
    throw new Error("Cart total is invalid.");
  }
  await firestore
    .collection("carts")
    .doc(cartId)
    .set(
      withoutUndefined({
        accessHash: hashCustomerAccessToken(orderAccessToken),
        businessId,
        cartId,
        createdAt: Date.now(),
        customerAccessHash: hashCustomerAccessToken(customerAccessToken),
        products: items.map(({ image: _image, ...item }) => item),
        totalAmount,
      }) as DocumentData,
      { merge: true },
    );
  return cartId;
}

export async function getPublicCart(
  firestore: Firestore,
  cartId: string,
  customerAccessToken: string | null,
  orderAccessToken: string | null,
) {
  if (!cartId || cartId.length > 160 || cartId.includes("/")) return null;
  const snapshot = await firestore.collection("carts").doc(cartId).get();
  if (!snapshot.exists) return null;
  const cart = snapshot.data()!;
  if (
    !accessTokenMatches(orderAccessToken, cart.accessHash) &&
    !accessTokenMatches(customerAccessToken, cart.customerAccessHash)
  ) {
    return null;
  }
  const business = await firestore
    .collection("businesses")
    .doc(String(cart.businessId))
    .get();
  if (!business.exists) return null;
  return { ...publicDocument(snapshot), business: publicDocument(business) };
}

export async function findPublicOrder(
  firestore: Firestore,
  orderId: string,
) {
  if (!orderId || orderId.length > 160) return null;
  const snapshot = await firestore
    .collection("orders")
    .where("orderId", "==", orderId)
    .limit(1)
    .get();
  return snapshot.empty ? null : snapshot.docs[0];
}

export async function hydratedOrder(
  firestore: Firestore,
  orderSnapshot: DocumentSnapshot<DocumentData>,
) {
  const order = publicDocument(orderSnapshot);
  const business = await firestore
    .collection("businesses")
    .doc(String(order.businessId))
    .get();
  return {
    ...order,
    business: business.exists ? publicDocument(business) : null,
  };
}

export async function getOrdersForCustomer(
  firestore: Firestore,
  mobile: string,
  rawCustomerAccessToken: string | null,
) {
  if (!INDIAN_MOBILE_PATTERN.test(mobile)) return [];
  const token = validateCustomerAccessToken(rawCustomerAccessToken);
  const snapshot = await firestore
    .collection("orders")
    .where("customerMobile", "==", mobile)
    .where("customerAccessHash", "==", hashCustomerAccessToken(token))
    .orderBy("createdAt", "desc")
    .get();
  return Promise.all(snapshot.docs.map((order) => hydratedOrder(firestore, order)));
}

export async function updateOwnedOrderStatus(
  firestore: Firestore,
  orderDocumentId: string,
  status: string,
  ownerUid: string,
  isSuperAdmin = false,
) {
  const allowedStatuses = new Set([
    "pending",
    "confirmed",
    "preparing",
    "ready",
    "delivered",
    "cancelled",
  ]);
  if (!allowedStatuses.has(status)) throw new Error("Order status is invalid.");
  const orderRef = firestore.collection("orders").doc(orderDocumentId);
  await firestore.runTransaction(async (transaction) => {
    const order = await transaction.get(orderRef);
    if (!order.exists) throw new Error("Order not found.");
    const businessRef = firestore
      .collection("businesses")
      .doc(String(order.data()!.businessId));
    const business = await transaction.get(businessRef);
    if (
      !business.exists ||
      (!isSuperAdmin && business.data()?.ownerId !== ownerUid)
    ) {
      throw new Error("Order access is denied.");
    }
    transaction.update(orderRef, { status, updatedAt: Date.now() });
  });
  return { success: true };
}
