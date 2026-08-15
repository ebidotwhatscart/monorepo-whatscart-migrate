// @vitest-environment node

import type { Firestore } from "firebase-admin/firestore";
import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it } from "vitest";

const emulatorAvailable = Boolean(
  process.env.FIREBASE_AUTH_EMULATOR_HOST &&
    process.env.FIRESTORE_EMULATOR_HOST &&
    process.env.FIREBASE_STORAGE_EMULATOR_HOST,
);
const describeWithEmulator = emulatorAvailable ? describe : describe.skip;

if (emulatorAvailable) {
  process.env.FIREBASE_PROJECT_ID = "demo-whatscart";
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "demo-key";
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-whatscart";
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "demo-whatscart.appspot.com";
  process.env.FIREBASE_STORAGE_BUCKET = "demo-whatscart.appspot.com";
  process.env.FIREBASE_UPLOAD_SECRET =
    "private-orders-review-upload-secret-at-least-32-chars";
  process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATORS = "true";
  process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST = "127.0.0.1";
}

type EmulatorIdentity = {
  email: string;
  idToken: string;
  localId: string;
  password: string;
};

type ObserveQuery = (
  functionName: string,
  args: Record<string, unknown>,
  emit: (value: unknown) => void,
  fail: (error: Error) => void,
  userId?: string | null,
) => () => void;

let firestore: Firestore;
let observeQuery: ObserveQuery;
let owner: EmulatorIdentity;
let otherOwner: EmulatorIdentity;
let superAdmin: EmulatorIdentity;
let manualOrderDocumentId = "";

async function createIdentity(email: string): Promise<EmulatorIdentity> {
  const password = "Test-password-123!";
  const response = await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  if (!response.ok) throw new Error(await response.text());
  const identity = (await response.json()) as {
    email: string;
    idToken: string;
    localId: string;
  };
  return { ...identity, password };
}

async function refreshIdentity(identity: EmulatorIdentity) {
  const response = await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: identity.email,
        password: identity.password,
        returnSecureToken: true,
      }),
    },
  );
  if (!response.ok) throw new Error(await response.text());
  const refreshed = (await response.json()) as { idToken: string };
  return { ...identity, idToken: refreshed.idToken };
}

function authorizedRequest(
  url: string,
  identity: EmulatorIdentity | null,
  init: ConstructorParameters<typeof NextRequest>[1] = {},
) {
  const headers = new Headers(init.headers);
  if (identity) headers.set("authorization", `Bearer ${identity.idToken}`);
  return new NextRequest(url, { ...init, headers });
}

async function orderOperation(
  identity: EmulatorIdentity | null,
  operation: string,
  args: Record<string, unknown>,
) {
  const { POST } = await import("../../../app/api/private/orders/route");
  return POST(
    authorizedRequest(
      "http://app.whatscart.in/api/private/orders",
      identity,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ args, operation }),
      },
    ),
  );
}

function firstValue(
  functionName: string,
  args: Record<string, unknown>,
  userId: string,
) {
  return new Promise<unknown>((resolve, reject) => {
    let unsubscribe: () => void = () => undefined;
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error(`Timed out waiting for ${functionName}`));
    }, 10_000);
    unsubscribe = observeQuery(
      functionName,
      args,
      (value) => {
        clearTimeout(timeout);
        queueMicrotask(unsubscribe);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        unsubscribe();
        reject(error);
      },
      userId,
    );
  });
}

function matchingValue(
  functionName: string,
  args: Record<string, unknown>,
  userId: string,
  matches: (value: unknown) => boolean,
) {
  return new Promise<unknown>((resolve, reject) => {
    let unsubscribe: () => void = () => undefined;
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error(`Timed out waiting for ${functionName}`));
    }, 10_000);
    unsubscribe = observeQuery(
      functionName,
      args,
      (value) => {
        if (!matches(value)) return;
        clearTimeout(timeout);
        unsubscribe();
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        unsubscribe();
        reject(error);
      },
      userId,
    );
  });
}

const manualOrder = {
  businessId: "private-orders-business",
  customerAddress: "Market Road, Chennai",
  customerDoorNumber: "22",
  customerMobile: "9876543210",
  customerName: "Manual Customer",
  items: [
    {
      name: "Owner Product",
      price: 450,
      productId: "private-orders-product",
      quantity: 2,
    },
    { name: "Custom Gift Wrap", price: 50, quantity: 1 },
  ],
  notes: "Created from the dashboard",
  status: "confirmed",
  totalAmount: 950,
};

describeWithEmulator("Firebase private orders", () => {
  beforeAll(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    [owner, otherOwner, superAdmin] = await Promise.all([
      createIdentity(`orders-owner-${suffix}@example.test`),
      createIdentity(`orders-other-${suffix}@example.test`),
      createIdentity(`orders-admin-${suffix}@example.test`),
    ]);
    const admin = await import("../admin");
    const adminFirestore = admin.getAdminFirestore();
    if (!adminFirestore) throw new Error("Firestore emulator is unavailable.");
    firestore = adminFirestore;
    const adminAuth = admin.getAdminAuth();
    if (!adminAuth) throw new Error("Auth emulator is unavailable.");
    await adminAuth.setCustomUserClaims(superAdmin.localId, {
      super_admin: true,
    });
    superAdmin = await refreshIdentity(superAdmin);
    await Promise.all([
      firestore.collection("users").doc(owner.localId).set({
        email: owner.email,
        name: "Orders Owner",
        role: "user",
      }),
      firestore.collection("users").doc(otherOwner.localId).set({
        email: otherOwner.email,
        name: "Other Owner",
        role: "user",
      }),
      firestore.collection("users").doc(superAdmin.localId).set({
        email: superAdmin.email,
        name: "Super Admin",
        role: "super_admin",
      }),
      firestore.collection("businesses").doc("private-orders-business").set({
        isEnabled: true,
        name: "Private Orders Store",
        orderSequence: 0,
        ownerId: owner.localId,
        slug: "private-orders-store",
        themeColor: "#0f766e",
      }),
      firestore.collection("businesses").doc("private-orders-other").set({
        isEnabled: true,
        name: "Other Store",
        orderSequence: 0,
        ownerId: otherOwner.localId,
        slug: "private-orders-other",
      }),
      firestore.collection("products").doc("private-orders-product").set({
        businessId: "private-orders-business",
        imageUrls: ["https://example.test/owner-product.png"],
        inStock: true,
        name: "Owner Product",
        price: 450,
      }),
      firestore.collection("products").doc("private-orders-other-product").set({
        businessId: "private-orders-other",
        imageUrls: [],
        inStock: true,
        name: "Other Product",
        price: 1,
      }),
      firestore.collection("orders").doc("private-orders-other-order").set({
        businessId: "private-orders-other",
        createdAt: Date.now(),
        customerMobile: "9999999999",
        customerName: "Other Customer",
        items: [],
        orderId: "OTHE00001",
        source: "manual",
        status: "confirmed",
        totalAmount: 0,
        updatedAt: Date.now(),
      }),
    ]);
    ({ observeFirebasePublicQuery: observeQuery } = await import("../public-query"));
  });

  it("validates and transactionally creates owner manual orders", async () => {
    const manipulatedTotal = await orderOperation(
      owner,
      "orders:createManualOrder",
      { ...manualOrder, totalAmount: 1 },
    );
    expect(manipulatedTotal.status).toBe(400);

    const crossBusinessProduct = await orderOperation(
      owner,
      "orders:createManualOrder",
      {
        ...manualOrder,
        items: [
          {
            name: "Other Product",
            price: 1,
            productId: "private-orders-other-product",
            quantity: 1,
          },
        ],
        totalAmount: 1,
      },
    );
    expect(crossBusinessProduct.status).toBe(400);

    const unauthorized = await orderOperation(
      otherOwner,
      "orders:createManualOrder",
      manualOrder,
    );
    expect(unauthorized.status).toBe(400);
    const anonymous = await orderOperation(
      null,
      "orders:createManualOrder",
      manualOrder,
    );
    expect(anonymous.status).toBe(401);

    const response = await orderOperation(
      owner,
      "orders:createManualOrder",
      manualOrder,
    );
    expect(response.status).toBe(200);
    const created = (await response.json()) as {
      order: string;
      orderId: string;
    };
    manualOrderDocumentId = created.order;
    expect(created.orderId).toBe("PRIV00001");
    expect(
      (
        await firestore
          .collection("businesses")
          .doc("private-orders-business")
          .get()
      ).data()?.orderSequence,
    ).toBe(1);
  });

  it("authorizes billing, notes, and status updates", async () => {
    const denied = await orderOperation(
      otherOwner,
      "orders:setOrderBillingExclusion",
      { excluded: true, orderId: manualOrderDocumentId },
    );
    expect(denied.status).toBe(400);

    const billing = await orderOperation(
      owner,
      "orders:setOrderBillingExclusion",
      { excluded: true, orderId: manualOrderDocumentId },
    );
    expect(billing.status).toBe(200);
    const notes = await orderOperation(owner, "orders:updateOrderNotes", {
      notes: "Owner-only internal note",
      orderId: manualOrderDocumentId,
    });
    expect(notes.status).toBe(200);

    const { POST: updateStatus } = await import(
      "../../../app/api/private/orders/status/route"
    );
    const status = await updateStatus(
      authorizedRequest(
        "http://app.whatscart.in/api/private/orders/status",
        owner,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            orderId: manualOrderDocumentId,
            status: "preparing",
          }),
        },
      ),
    );
    expect(status.status).toBe(200);
    expect(
      (
        await firestore.collection("orders").doc(manualOrderDocumentId).get()
      ).data(),
    ).toMatchObject({
      excludedFromBilling: true,
      notes: "Owner-only internal note",
      status: "preparing",
    });
  });

  it("streams only the signed-in owner's order data without refresh", async () => {
    const { signInWithEmailAndPassword, signOut } = await import("firebase/auth");
    const { doc, getDoc } = await import("firebase/firestore");
    const client = (await import("../client")).getFirebaseClient();
    if (!client) throw new Error("Firebase client emulator is unavailable.");
    await signInWithEmailAndPassword(client.auth, owner.email, owner.password);

    expect(
      (
        await getDoc(doc(client.firestore, "orders", manualOrderDocumentId))
      ).exists(),
    ).toBe(true);
    await expect(
      getDoc(doc(client.firestore, "orders", "private-orders-other-order")),
    ).rejects.toMatchObject({ code: "permission-denied" });

    const orders = (await firstValue(
      "orders:getBusinessOrders",
      { businessId: "private-orders-business" },
      owner.localId,
    )) as Array<Record<string, unknown>>;
    expect(orders.map((order) => order._id)).toContain(manualOrderDocumentId);

    const detail = (await firstValue(
      "orders:getBusinessOrderDetail",
      { orderId: manualOrderDocumentId },
      owner.localId,
    )) as Record<string, unknown>;
    expect(detail).toMatchObject({
      _id: manualOrderDocumentId,
      business: { _id: "private-orders-business" },
      itemsDetailed: [
        { product: { _id: "private-orders-product" } },
        { product: null },
      ],
    });

    const liveUpdate = new Promise<void>((resolve, reject) => {
      let unsubscribe: () => void = () => undefined;
      const timeout = setTimeout(() => {
        unsubscribe();
        reject(new Error("Timed out waiting for a live order update"));
      }, 10_000);
      unsubscribe = observeQuery(
        "orders:getBusinessOrders",
        { businessId: "private-orders-business" },
        (value) => {
          const liveOrders = value as Array<Record<string, unknown>>;
          const order = liveOrders.find(
            (candidate) => candidate._id === manualOrderDocumentId,
          );
          if (order?.status === "ready") {
            clearTimeout(timeout);
            unsubscribe();
            resolve();
          }
        },
        reject,
        owner.localId,
      );
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    await firestore
      .collection("orders")
      .doc(manualOrderDocumentId)
      .update({ status: "ready", updatedAt: Date.now() });
    await liveUpdate;

    await signOut(client.auth);
    await expect(
      getDoc(doc(client.firestore, "orders", manualOrderDocumentId)),
    ).rejects.toMatchObject({ code: "permission-denied" });
  }, 20_000);

  it("computes owner analytics and streams new events without refresh", async () => {
    const timestamp = Date.now();
    await Promise.all([
      firestore.collection("orders").doc("private-analytics-order").set({
        businessId: "private-orders-business",
        createdAt: timestamp,
        customerMobile: "9123456789",
        customerName: "Analytics Customer",
        items: [
          {
            name: "Owner Product",
            price: 600,
            productId: "private-orders-product",
            quantity: 2,
          },
        ],
        orderId: "PRIV00002",
        source: "cart",
        status: "delivered",
        totalAmount: 1_200,
        updatedAt: timestamp,
      }),
      firestore.collection("pageViews").doc("private-page-view-1").set({
        businessId: "private-orders-business",
        pageUrl: "/",
        referrer: "",
        sessionId: "analytics-session-1",
        timestamp,
        utmSource: "instagram",
      }),
      firestore.collection("pageViews").doc("private-page-view-2").set({
        businessId: "private-orders-business",
        pageUrl: "/product/private-orders-product",
        referrer: "",
        sessionId: "analytics-session-1",
        timestamp,
        utmSource: "instagram",
      }),
      firestore.collection("pageViews").doc("private-page-view-3").set({
        businessId: "private-orders-business",
        pageUrl: "/",
        referrer: "",
        sessionId: "analytics-session-2",
        timestamp,
      }),
      firestore.collection("pageViews").doc("private-page-view-other").set({
        businessId: "private-orders-other",
        pageUrl: "/",
        referrer: "",
        sessionId: "other-session",
        timestamp,
      }),
      firestore.collection("productViews").doc("private-product-view-1").set({
        businessId: "private-orders-business",
        productId: "private-orders-product",
        sessionId: "analytics-session-1",
        timestamp,
      }),
      firestore.collection("productViews").doc("private-product-view-2").set({
        businessId: "private-orders-business",
        productId: "private-orders-product",
        sessionId: "analytics-session-2",
        timestamp,
      }),
      firestore.collection("productShares").doc("private-product-share-1").set({
        businessId: "private-orders-business",
        channel: "whatsapp",
        productId: "private-orders-product",
        sessionId: "analytics-session-1",
        timestamp,
      }),
    ]);

    const { signInWithEmailAndPassword, signOut } = await import("firebase/auth");
    const { doc, getDoc, setDoc } = await import("firebase/firestore");
    const client = (await import("../client")).getFirebaseClient();
    if (!client) throw new Error("Firebase client emulator is unavailable.");
    await signInWithEmailAndPassword(client.auth, owner.email, owner.password);
    const args = {
      businessId: "private-orders-business",
      dateRange: { type: "today" },
    };

    await expect(
      matchingValue(
        "analytics:getTotalRevenue",
        args,
        owner.localId,
        (value) => value === 1_200,
      ),
    ).resolves.toBe(1_200);
    await expect(
      matchingValue(
        "analytics:getTotalOrders",
        args,
        owner.localId,
        (value) => value === 1,
      ),
    ).resolves.toBe(1);
    await expect(
      matchingValue(
        "analytics:getTotalVisitors",
        args,
        owner.localId,
        (value) => value === 2,
      ),
    ).resolves.toBe(2);
    await expect(
      matchingValue(
        "analytics:getTotalPageViews",
        args,
        owner.localId,
        (value) => value === 3,
      ),
    ).resolves.toBe(3);
    await expect(
      matchingValue(
        "analytics:getTopProducts",
        { ...args, limit: 5 },
        owner.localId,
        (value) => Array.isArray(value) && value.length === 1,
      ),
    ).resolves.toMatchObject([
      {
        name: "Owner Product",
        productId: "private-orders-product",
        revenue: 1_200,
        sold: 2,
      },
    ]);
    await expect(
      matchingValue(
        "analytics:getTopCustomers",
        { ...args, limit: 5 },
        owner.localId,
        (value) => Array.isArray(value) && value.length === 1,
      ),
    ).resolves.toMatchObject([
      {
        mobile: "9123456789",
        orders: 1,
        totalSpend: 1_200,
      },
    ]);
    await expect(
      matchingValue(
        "analytics:getTrafficSources",
        args,
        owner.localId,
        (value) => Array.isArray(value) && value.length === 2,
      ),
    ).resolves.toMatchObject([
      { count: 2, percentage: 67, source: "instagram" },
      { count: 1, percentage: 33, source: "organic" },
    ]);
    await expect(
      matchingValue(
        "analytics:getProductPerformance",
        {
          businessId: "private-orders-business",
          productId: "private-orders-product",
        },
        owner.localId,
        (value) =>
          Boolean(
            value &&
              typeof value === "object" &&
              (value as { totalViews?: number }).totalViews === 2,
          ),
      ),
    ).resolves.toEqual({ timesShared: 1, totalViews: 2 });
    await expect(
      matchingValue(
        "analytics:getConversionRate",
        args,
        owner.localId,
        (value) => value === 50,
      ),
    ).resolves.toBe(50);

    await expect(
      getDoc(doc(client.firestore, "pageViews", "private-page-view-other")),
    ).rejects.toMatchObject({ code: "permission-denied" });
    await expect(
      setDoc(doc(client.firestore, "pageViews", "client-write-denied"), {
        businessId: "private-orders-business",
        sessionId: "forged",
        timestamp,
      }),
    ).rejects.toMatchObject({ code: "permission-denied" });

    const livePageViews = new Promise<void>((resolve, reject) => {
      let unsubscribe: () => void = () => undefined;
      const timeout = setTimeout(() => {
        unsubscribe();
        reject(new Error("Timed out waiting for a live analytics update"));
      }, 10_000);
      unsubscribe = observeQuery(
        "analytics:getTotalPageViews",
        args,
        (value) => {
          if (value === 4) {
            clearTimeout(timeout);
            unsubscribe();
            resolve();
          }
        },
        reject,
        owner.localId,
      );
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    await firestore.collection("pageViews").doc("private-page-view-live").set({
      businessId: "private-orders-business",
      pageUrl: "/live",
      referrer: "",
      sessionId: "analytics-session-3",
      timestamp: Date.now(),
    });
    await livePageViews;
    await signOut(client.auth);
  }, 20_000);

  it("runs the public review, upload, and owner moderation lifecycle", async () => {
    const { POST: privateReviews } = await import(
      "../../../app/api/private/reviews/route"
    );
    const privateOperation = (
      identity: EmulatorIdentity,
      operation: string,
      args: Record<string, unknown>,
    ) =>
      privateReviews(
        authorizedRequest(
          "http://app.whatscart.in/api/private/reviews",
          identity,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ args, operation }),
          },
        ),
      );

    const deniedRequest = await privateOperation(
      otherOwner,
      "reviews:createReviewRequest",
      { orderId: manualOrderDocumentId },
    );
    expect(deniedRequest.status).toBe(400);
    const createRequest = await privateOperation(
      owner,
      "reviews:createReviewRequest",
      { orderId: manualOrderDocumentId },
    );
    expect(createRequest.status).toBe(200);
    const requestResult = (await createRequest.json()) as {
      productCount: number;
      status: string;
      token: string;
    };
    expect(requestResult).toMatchObject({ productCount: 1, status: "open" });
    expect(requestResult.token).toMatch(/^[a-f0-9]{64}$/);

    const { GET: reviewForm, POST: publicReviews } = await import(
      "../../../app/api/public/reviews/route"
    );
    const formResponse = await reviewForm(
      new NextRequest(
        `http://private-orders-store.whatscart.in/api/public/reviews?token=${requestResult.token}`,
      ),
    );
    expect(formResponse.status).toBe(200);
    await expect(formResponse.json()).resolves.toMatchObject({
      business: { name: "Private Orders Store" },
      customerName: "Manual Customer",
      orderNumber: "PRIV00001",
      products: [{ productId: "private-orders-product" }],
      status: "open",
    });

    const publicOperation = (
      operation: string,
      args: Record<string, unknown>,
    ) =>
      publicReviews(
        new NextRequest(
          "http://private-orders-store.whatscart.in/api/public/reviews",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ args, operation }),
          },
        ),
      );
    const authorizeUpload = await publicOperation(
      "reviews:generateReviewUploadUrl",
      { token: requestResult.token },
    );
    expect(authorizeUpload.status).toBe(200);
    const uploadUrl = (await authorizeUpload.json()) as string;
    const { POST: upload } = await import(
      "../../../app/api/public/uploads/route"
    );
    const uploadResponse = await upload(
      new NextRequest(uploadUrl, {
        method: "POST",
        headers: { "content-type": "image/png" },
        body: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      }),
    );
    expect(uploadResponse.status).toBe(200);
    const { storageId } = (await uploadResponse.json()) as {
      storageId: string;
    };
    expect(storageId).toMatch(
      /^review-uploads\/[A-Za-z0-9_-]+\/[0-9a-f-]{36}$/,
    );
    const register = await publicOperation("reviews:registerReviewUpload", {
      storageId,
      token: requestResult.token,
    });
    expect(register.status).toBe(200);

    const badSubmission = await publicOperation("reviews:submitReviews", {
      reviews: [
        {
          comment: "Wrong product",
          imageIds: [storageId],
          productId: "private-orders-other-product",
          rating: 5,
        },
      ],
      token: requestResult.token,
    });
    expect(badSubmission.status).toBe(400);
    const submit = await publicOperation("reviews:submitReviews", {
      reviews: [
        {
          comment: "Excellent owner product",
          imageIds: [storageId],
          productId: "private-orders-product",
          rating: 5,
        },
      ],
      token: requestResult.token,
    });
    expect(submit.status).toBe(200);
    await expect(submit.json()).resolves.toMatchObject({ reviewCount: 1 });
    const duplicate = await publicOperation("reviews:submitReviews", {
      reviews: [],
      token: requestResult.token,
    });
    expect(duplicate.status).toBe(400);

    const reviewSnapshot = await firestore
      .collection("productReviews")
      .where("orderId", "==", manualOrderDocumentId)
      .get();
    expect(reviewSnapshot.size).toBe(1);
    const reviewId = reviewSnapshot.docs[0].id;
    expect(reviewSnapshot.docs[0].data()).toMatchObject({
      imageIds: [storageId],
      imageUrls: [expect.stringContaining("127.0.0.1:9199")],
      status: "pending",
    });

    const deniedModeration = await privateOperation(
      otherOwner,
      "reviews:moderateReview",
      { reviewId, status: "approved" },
    );
    expect(deniedModeration.status).toBe(400);
    const approved = await privateOperation(owner, "reviews:moderateReview", {
      reviewId,
      status: "approved",
    });
    expect(approved.status).toBe(200);
    expect(
      (
        await firestore
          .collection("productReviewStats")
          .doc("private-orders-product")
          .get()
      ).data(),
    ).toMatchObject({ approvedCount: 1, ratingSum: 5, ratings5: 1 });

    const { signInWithEmailAndPassword, signOut } = await import("firebase/auth");
    const client = (await import("../client")).getFirebaseClient();
    if (!client) throw new Error("Firebase client emulator is unavailable.");
    await signInWithEmailAndPassword(client.auth, owner.email, owner.password);
    await expect(
      matchingValue(
        "reviews:getBusinessReviewRequestStates",
        { businessId: "private-orders-business" },
        owner.localId,
        (value) =>
          Array.isArray(value) &&
          value.some(
            (entry) =>
              (entry as { orderId?: string }).orderId === manualOrderDocumentId,
          ),
      ),
    ).resolves.toMatchObject([
      { orderId: manualOrderDocumentId, status: "submitted" },
    ]);
    await expect(
      matchingValue(
        "reviews:getOrderReviews",
        { orderId: manualOrderDocumentId },
        owner.localId,
        (value) =>
          Boolean(
            value &&
              typeof value === "object" &&
              Array.isArray((value as { reviews?: unknown[] }).reviews) &&
              (value as { reviews: unknown[] }).reviews.length === 1,
          ),
      ),
    ).resolves.toMatchObject({
      request: { status: "submitted" },
      reviews: [{ _id: reviewId, status: "approved" }],
    });
    await expect(
      matchingValue(
        "reviews:getApprovedProductReviews",
        { limit: 20, productId: "private-orders-product" },
        owner.localId,
        (value) =>
          Boolean(
            value &&
              typeof value === "object" &&
              (value as { stats?: { approvedCount?: number } }).stats
                ?.approvedCount === 1,
          ),
      ),
    ).resolves.toMatchObject({
      reviews: [
        {
          comment: "Excellent owner product",
          displayName: expect.any(String),
          imageUrls: [expect.stringContaining("127.0.0.1:9199")],
          rating: 5,
        },
      ],
      stats: { approvedCount: 1, averageRating: 5, ratings5: 1 },
    });
    await signOut(client.auth);
  }, 30_000);

  it("enforces super-admin listing, toggles, and confirmed full deletion", async () => {
    const { signInWithEmailAndPassword, signOut } = await import("firebase/auth");
    const client = (await import("../client")).getFirebaseClient();
    if (!client) throw new Error("Firebase client emulator is unavailable.");

    await signInWithEmailAndPassword(client.auth, owner.email, owner.password);
    await expect(
      firstValue("superAdmin:listBusinesses", {}, owner.localId),
    ).rejects.toMatchObject({ code: "permission-denied" });
    await signOut(client.auth);

    await signInWithEmailAndPassword(
      client.auth,
      superAdmin.email,
      superAdmin.password,
    );
    const businesses = (await matchingValue(
      "superAdmin:listBusinesses",
      {},
      superAdmin.localId,
      (value) => Array.isArray(value) && value.length >= 2,
    )) as Array<Record<string, unknown>>;
    expect(businesses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          _id: "private-orders-business",
          ownerEmail: owner.email,
          productCount: 1,
        }),
        expect.objectContaining({
          _id: "private-orders-other",
          ownerEmail: otherOwner.email,
        }),
      ]),
    );
    await expect(
      matchingValue(
        "superAdmin:getBusinessForAdmin",
        { businessId: "private-orders-business" },
        superAdmin.localId,
        (value) => Boolean(value),
      ),
    ).resolves.toMatchObject({
      _id: "private-orders-business",
      ownerId: owner.localId,
    });

    const { POST: superAdminOperation } = await import(
      "../../../app/api/private/super-admin/route"
    );
    const operation = (
      identity: EmulatorIdentity,
      operationName: string,
      args: Record<string, unknown>,
    ) =>
      superAdminOperation(
        authorizedRequest(
          "http://admin.whatscart.in/api/private/super-admin",
          identity,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ args, operation: operationName }),
          },
        ),
      );
    const ordinaryToggle = await operation(
      owner,
      "superAdmin:setBusinessEnabled",
      { businessId: "private-orders-business", isEnabled: false },
    );
    expect(ordinaryToggle.status).toBe(403);
    const disabled = await operation(
      superAdmin,
      "superAdmin:setBusinessEnabled",
      { businessId: "private-orders-business", isEnabled: false },
    );
    expect(disabled.status).toBe(200);
    expect(
      (
        await firestore
          .collection("businesses")
          .doc("private-orders-business")
          .get()
      ).data()?.isEnabled,
    ).toBe(false);
    const enabled = await operation(
      superAdmin,
      "superAdmin:setBusinessEnabled",
      { businessId: "private-orders-business", isEnabled: true },
    );
    expect(enabled.status).toBe(200);

    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const disposable = await createIdentity(
      `disposable-owner-${suffix}@example.test`,
    );
    const disposableBusinessId = `disposable-business-${suffix}`;
    const disposableProductId = `disposable-product-${suffix}`;
    const { userUploadPrefix } = await import("../upload-token");
    const disposableStoragePath = `${userUploadPrefix(disposable.localId)}/deletion-test.png`;
    const admin = await import("../admin");
    const storage = admin.getAdminStorage();
    const adminAuth = admin.getAdminAuth();
    if (!storage || !adminAuth) {
      throw new Error("Firebase Admin emulators are unavailable.");
    }
    await Promise.all([
      firestore.collection("users").doc(disposable.localId).set({
        email: disposable.email,
        name: "Disposable Owner",
        role: "user",
      }),
      firestore.collection("businesses").doc(disposableBusinessId).set({
        createdAt: Date.now(),
        isEnabled: true,
        logoId: disposableStoragePath,
        name: "Disposable Store",
        orderSequence: 1,
        ownerId: disposable.localId,
        slug: `disposable-store-${suffix}`,
        themeColor: "#112233",
      }),
      firestore.collection("products").doc(disposableProductId).set({
        businessId: disposableBusinessId,
        imageIds: [disposableStoragePath],
        imageUrls: [],
        inStock: true,
        name: "Disposable Product",
        price: 1,
      }),
      firestore.collection("orders").doc(`disposable-order-${suffix}`).set({
        businessId: disposableBusinessId,
        createdAt: Date.now(),
        customerMobile: "9000000000",
        customerName: "Disposable Customer",
        items: [],
        orderId: "DISP00001",
        source: "manual",
        status: "confirmed",
        totalAmount: 0,
        updatedAt: Date.now(),
      }),
      firestore.collection("pageViews").doc(`disposable-view-${suffix}`).set({
        businessId: disposableBusinessId,
        pageUrl: "/",
        referrer: "",
        sessionId: "disposable-session",
        timestamp: Date.now(),
      }),
      storage.bucket().file(disposableStoragePath).save(
        new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
        { metadata: { contentType: "image/png" }, resumable: false },
      ),
    ]);

    const deniedDeletion = await operation(
      owner,
      "adminDeletion:deleteUserAndOwnedDataByEmail",
      { confirmEmail: disposable.email, email: disposable.email },
    );
    expect(deniedDeletion.status).toBe(403);
    const selfDeletion = await operation(
      superAdmin,
      "adminDeletion:deleteUserAndOwnedDataByEmail",
      { confirmEmail: superAdmin.email, email: superAdmin.email },
    );
    expect(selfDeletion.status).toBe(400);
    const deletion = await operation(
      superAdmin,
      "adminDeletion:deleteUserAndOwnedDataByEmail",
      { confirmEmail: disposable.email, email: disposable.email },
    );
    expect(deletion.status).toBe(200);
    await expect(deletion.json()).resolves.toMatchObject({
      businesses: 1,
      authAccount: "deleted",
      orders: 1,
      pageViews: 1,
      products: 1,
      storageFiles: 1,
      users: 1,
    });
    expect(
      (await firestore.collection("businesses").doc(disposableBusinessId).get())
        .exists,
    ).toBe(false);
    expect(
      (await firestore.collection("products").doc(disposableProductId).get())
        .exists,
    ).toBe(false);
    await expect(adminAuth.getUser(disposable.localId)).rejects.toMatchObject({
      code: "auth/user-not-found",
    });
    await expect(
      storage.bucket().file(disposableStoragePath).exists(),
    ).resolves.toEqual([false]);
    await signOut(client.auth);
  }, 30_000);
});
