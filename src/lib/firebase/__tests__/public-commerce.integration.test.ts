// @vitest-environment node

import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it } from "vitest";
import type { Firestore } from "firebase-admin/firestore";

const emulatorAvailable = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const describeWithEmulator = emulatorAvailable ? describe : describe.skip;

if (emulatorAvailable) {
  process.env.FIREBASE_PROJECT_ID = "demo-whatscart";
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-whatscart";
}

const customerAccessToken = "customer_access_token_1234567890abcdef";

let firestore: Firestore;
let commerce: typeof import("../public-commerce");
let orderDocumentId: string;
let orderId: string;
let orderAccessToken: string;

function orderBody(overrides: Record<string, unknown> = {}) {
  return {
    businessId: "commerce-business",
    customerAddress: "12 Market Road, Chennai",
    customerAlternateMobile: "9876543211",
    customerDoorNumber: "12",
    customerLocation: {
      label: "Market Road",
      latitude: 13.0827,
      longitude: 80.2707,
    },
    customerMobile: "9876543210",
    customerName: "Commerce Customer",
    items: [
      {
        cartItemId: "commerce-item",
        customizationNotes: ["Size: M"],
        name: "Client supplied name is ignored",
        price: 499,
        productId: "commerce-product",
        quantity: 2,
      },
    ],
    source: "cart",
    totalAmount: 998,
    ...overrides,
  };
}

describeWithEmulator("Firebase public commerce", () => {
  beforeAll(async () => {
    const admin = await import("../admin");
    const nextFirestore = admin.getAdminFirestore();
    if (!nextFirestore) throw new Error("Firestore emulator is unavailable.");
    firestore = nextFirestore;
    commerce = await import("../public-commerce");

    await Promise.all([
      firestore.collection("businesses").doc("commerce-business").set({
        isEnabled: true,
        name: "Commerce Store",
        orderSequence: 0,
        ownerId: "commerce-owner",
        slug: "commerce-store",
        themeColor: "#123456",
        whatsappPhone: "919876543210",
      }),
      firestore.collection("products").doc("commerce-product").set({
        businessId: "commerce-business",
        imageUrls: ["https://example.test/product.png"],
        inStock: true,
        name: "Canonical Product",
        price: 499,
        sizes: [{ price: 549, size: "L" }],
      }),
    ]);
  });

  it("creates a transactionally numbered order from server-validated products", async () => {
    const result = await commerce.createPublicOrder(
      firestore,
      orderBody(),
      customerAccessToken,
    );
    orderDocumentId = result.order;
    orderId = result.orderId;
    orderAccessToken = result.accessToken;

    expect(result.orderId).toBe("COMM00001");
    expect(result.accessToken.length).toBeGreaterThan(32);
    const order = await firestore.collection("orders").doc(result.order).get();
    expect(order.data()).toMatchObject({
      customerMobile: "9876543210",
      items: [
        expect.objectContaining({
          name: "Canonical Product",
          price: 499,
          quantity: 2,
        }),
      ],
      status: "pending",
      totalAmount: 998,
    });
    expect(order.data()).not.toHaveProperty("customerAccessToken");
    expect(order.data()).not.toHaveProperty("orderAccessToken");
  });

  it("rejects client-side price and total manipulation", async () => {
    await expect(
      commerce.createPublicOrder(
        firestore,
        orderBody({
          items: [
            {
              name: "Canonical Product",
              price: 1,
              productId: "commerce-product",
              quantity: 2,
            },
          ],
          totalAmount: 2,
        }),
        customerAccessToken,
      ),
    ).rejects.toThrow("price is invalid");

    await expect(
      commerce.createPublicOrder(
        firestore,
        orderBody({ totalAmount: 1 }),
        customerAccessToken,
      ),
    ).rejects.toThrow("total is invalid");
  });

  it("protects order, order-history, and saved-cart reads with capability tokens", async () => {
    await commerce.savePublicCart(
      firestore,
      {
        businessId: "commerce-business",
        cartId: orderId,
        products: orderBody().items,
        totalAmount: 998,
      },
      customerAccessToken,
      orderAccessToken,
    );

    await expect(
      commerce.getPublicCart(
        firestore,
        orderId,
        "wrong_customer_access_token_123456789",
        "wrong_order_access_token_123456789012",
      ),
    ).resolves.toBeNull();
    await expect(
      commerce.getPublicCart(firestore, orderId, null, orderAccessToken),
    ).resolves.toMatchObject({
      business: expect.objectContaining({ name: "Commerce Store" }),
      products: [expect.objectContaining({ name: "Canonical Product" })],
    });

    await expect(
      commerce.getOrdersForCustomer(
        firestore,
        "9876543210",
        "wrong_customer_access_token_123456789",
      ),
    ).resolves.toEqual([]);
    await expect(
      commerce.getOrdersForCustomer(
        firestore,
        "9876543210",
        customerAccessToken,
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        business: expect.objectContaining({ name: "Commerce Store" }),
        orderId,
      }),
    ]);
  });

  it("returns an order only with its capability and denies anonymous access", async () => {
    const { GET } = await import(
      "../../../app/api/public/orders/route"
    );
    const denied = await GET(
      new NextRequest(
        `http://commerce-store.whatscart.in/api/public/orders?orderId=${orderId}`,
      ),
    );
    expect(denied.status).toBe(404);

    const allowed = await GET(
      new NextRequest(
        `http://commerce-store.whatscart.in/api/public/orders?orderId=${orderId}`,
        { headers: { "x-order-access-token": orderAccessToken } },
      ),
    );
    expect(allowed.status).toBe(200);
    await expect(allowed.json()).resolves.toMatchObject({
      _id: orderDocumentId,
      orderId,
    });
    expect(allowed.headers.get("cache-control")).toContain("no-store");
  });

  it("allows only the owning business to update status", async () => {
    await expect(
      commerce.updateOwnedOrderStatus(
        firestore,
        orderDocumentId,
        "confirmed",
        "not-the-owner",
      ),
    ).rejects.toThrow("access is denied");
    await expect(
      commerce.updateOwnedOrderStatus(
        firestore,
        orderDocumentId,
        "confirmed",
        "commerce-owner",
      ),
    ).resolves.toEqual({ success: true });
    await expect(
      firestore.collection("orders").doc(orderDocumentId).get(),
    ).resolves.toMatchObject({
      exists: true,
    });
    expect(
      (await firestore.collection("orders").doc(orderDocumentId).get()).data()
        ?.status,
    ).toBe("confirmed");
  });

  it("rejects an unauthenticated order-status API request", async () => {
    const { POST } = await import(
      "../../../app/api/private/orders/status/route"
    );
    const response = await POST(
      new NextRequest(
        "http://app.whatscart.in/api/private/orders/status",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            orderId: orderDocumentId,
            status: "delivered",
          }),
        },
      ),
    );
    expect(response.status).toBe(401);
    expect(
      (await firestore.collection("orders").doc(orderDocumentId).get()).data()
        ?.status,
    ).toBe("confirmed");
  });
});
