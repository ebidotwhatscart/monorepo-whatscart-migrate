import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it } from "vitest";
import type { Firestore } from "firebase-admin/firestore";

const emulatorAvailable = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const describeWithEmulator = emulatorAvailable ? describe : describe.skip;

if (emulatorAvailable) {
  process.env.FIREBASE_PROJECT_ID = "demo-whatscart";
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-whatscart";
}

const customerAccessToken = "notify_customer_token_1234567890abcdef";

let firestore: Firestore;

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
});