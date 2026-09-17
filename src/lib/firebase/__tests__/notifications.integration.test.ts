// @vitest-environment node

import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it } from "vitest";
import type { Firestore } from "firebase-admin/firestore";

const emulatorAvailable = Boolean(
  process.env.FIREBASE_AUTH_EMULATOR_HOST &&
    process.env.FIRESTORE_EMULATOR_HOST,
);
const describeWithEmulator = emulatorAvailable ? describe : describe.skip;

if (emulatorAvailable) {
  process.env.FIREBASE_PROJECT_ID = "demo-whatscart";
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-whatscart";
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "demo-key";
  process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATORS = "true";
  process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST = "127.0.0.1";
}

const customerAccessToken = "notify_customer_token_1234567890abcdef";

let firestore: Firestore;

type EmulatorIdentity = { email: string; idToken: string; localId: string };

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
  return identity;
}

function orderBody() {
  return {
    businessId: "notify-business",
    customerAddress: "12 Market Road, Chennai",
    customerAlternateMobile: "9876543211",
    customerDoorNumber: "12",
    customerLocation: { label: "Market Road", latitude: 13.0827, longitude: 80.2707 },
    customerMobile: "9876543210",
    customerName: "Notify Customer",
    items: [
      {
        cartItemId: "notify-item",
        customizationNotes: ["Size: M"],
        name: "Client supplied name is ignored",
        price: 499,
        productId: "notify-product",
        quantity: 2,
      },
    ],
    source: "cart",
    totalAmount: 998,
  };
}

describeWithEmulator("Order notifications", () => {
  beforeAll(async () => {
    const admin = await import("../admin");
    const nextFirestore = admin.getAdminFirestore();
    if (!nextFirestore) throw new Error("Firestore emulator is unavailable.");
    firestore = nextFirestore;

    await Promise.all([
      firestore.collection("businesses").doc("notify-business").set({
        allowCreate: true,
        isEnabled: true,
        name: "Notify Store",
        orderSequence: 0,
        ownerId: "notify-owner",
      }),
      firestore.collection("products").doc("notify-product").set({
        businessId: "notify-business",
        inStock: true,
        name: "Test Tee",
        price: 499,
      }),
      firestore.collection("users").doc("notify-owner").set({ role: "owner" }),
    ]);
  });

  it("creates a notification doc for the owner when a public order is placed", async () => {
    const route = await import("../../../app/api/public/orders/route");
    const request = new NextRequest("http://commerce-store.whatscart.in/api/public/orders", {
      method: "POST",
      headers: { "x-customer-access-token": customerAccessToken },
      body: JSON.stringify(orderBody()),
    });

    const response = await route.POST(request);
    expect(response.status).toBe(200);

    const notifications = await firestore
      .collection("users")
      .doc("notify-owner")
      .collection("notifications")
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();
    expect(notifications.docs.length).toBeGreaterThan(0);
    const notification = notifications.docs[0].data();
    expect(notification.type).toBe("order");
    expect(notification.read).toBe(false);
    expect(notification.orderNumber).toBe("NOTI00001");
    expect(notification.message).toMatch(/Order NOTI00001 — ₹998/);
  });

  it("registers and removes a device token for the signed-in owner", async () => {
    const { POST, DELETE } = await import("../../../app/api/private/notifications/device/route");
    const identity = await createIdentity("notify-owner@example.test");

    const tokenValue = "fcm-token-device-0001";
    const register = new NextRequest("http://app.whatscart.in/api/private/notifications/device", {
      method: "POST",
      headers: { authorization: `Bearer ${identity.idToken}` },
      body: JSON.stringify({ token: tokenValue }),
    });
    const registerResponse = await POST(register);
    expect(registerResponse.status).toBe(200);

    const deviceDoc = await firestore
      .collection("users")
      .doc(identity.localId)
      .collection("devices")
      .doc(tokenValue)
      .get();
    expect(deviceDoc.exists).toBe(true);
    expect(deviceDoc.data()?.token).toBe(tokenValue);

    const remove = new NextRequest(
      `http://app.whatscart.in/api/private/notifications/device?token=${encodeURIComponent(tokenValue)}`,
      { method: "DELETE", headers: { authorization: `Bearer ${identity.idToken}` } },
    );
    const removeResponse = await DELETE(remove);
    expect(removeResponse.status).toBe(200);
    expect((await deviceDoc.ref.get()).exists).toBe(false);
  });

  it("marks own notifications as read", async () => {
    const { POST } = await import("../../../app/api/private/notifications/read/route");
    const identity = await createIdentity("notify-owner-2@example.test");
    const created = await firestore
      .collection("users")
      .doc(identity.localId)
      .collection("notifications")
      .add({ type: "order", orderId: "x", read: false, createdAt: Date.now() });

    const request = new NextRequest("http://app.whatscart.in/api/private/notifications/read", {
      method: "POST",
      headers: { authorization: `Bearer ${identity.idToken}` },
      body: JSON.stringify({ notificationIds: [created.id] }),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect((await created.get()).data()?.read).toBe(true);
  });
});