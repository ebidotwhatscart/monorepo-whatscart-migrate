import { describe, expect, it, vi } from "vitest";
import {
  buildOrderNotification,
  notifyNewOrder,
  type OrderNotificationInput,
} from "../notifications";

const input: OrderNotificationInput = {
  orderId: "abc123",
  orderNumber: "POSI00003",
  totalAmount: 1397,
};

function ownedBusinessShapedFirestore(ownerId: string | undefined) {
  const documentRef = { id: "notif-1", set: vi.fn(async () => {}) };
  const notificationsCollection = { doc: vi.fn(() => documentRef) };
  const usersDoc = { collection: vi.fn(() => notificationsCollection) };
  const businessDoc = { get: vi.fn(async () => ({ data: () => ({ ownerId }) })) };
  const firestore = {
    collection: vi.fn((name: string) =>
      name === "businesses"
        ? { doc: vi.fn(() => businessDoc) }
        : { doc: vi.fn(() => usersDoc) },
    ),
  } as never;
  return { firestore, documentRef };
}

describe("buildOrderNotification", () => {
  it("formats the push payload with order number and rupee total", () => {
    const message = buildOrderNotification(input);
    expect(message.notification).toEqual({
      title: "New order",
      body: "Order POSI00003 — ₹1,397",
    });
    expect(message.data).toEqual({
      orderId: "abc123",
      orderNumber: "POSI00003",
      url: "/dashboard/orders/abc123",
    });
  });

  it("formats decimals with two fraction digits", () => {
    expect(buildOrderNotification({ ...input, totalAmount: 499.5 }).notification.body).toBe(
      "Order POSI00003 — ₹499.50",
    );
  });
});

describe("notifyNewOrder", () => {
  it("returns null when the business has no owner", async () => {
    const { firestore } = ownedBusinessShapedFirestore(undefined);
    const sendPush = vi.fn();
    const result = await notifyNewOrder(firestore, "business-1", input, sendPush as never);
    expect(result).toBeNull();
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("writes a notification doc and pushes to the owner", async () => {
    const ownerId = "owner-uid";
    const { firestore, documentRef } = ownedBusinessShapedFirestore(ownerId);
    const sendPush = vi.fn(async () => ({ sent: 1 }));

    const result = await notifyNewOrder(firestore, "business-1", input, sendPush as never);

    expect(result).toEqual({ ownerId, notificationId: "notif-1", sent: 1 });
    expect(documentRef.set).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "order",
        orderId: "abc123",
        orderNumber: "POSI00003",
        read: false,
        createdAt: expect.any(Number),
      }),
    );
    expect(sendPush).toHaveBeenCalledWith(
      firestore,
      ownerId,
      expect.objectContaining({
        notification: expect.objectContaining({ title: "New order" }),
      }),
    );
  });

  it("still returns the doc when push fails", async () => {
    const ownerId = "owner-uid";
    const { firestore } = ownedBusinessShapedFirestore(ownerId);
    const sendPush = vi.fn(async () => {
      throw new Error("fcm down");
    });

    await expect(
      notifyNewOrder(firestore, "business-1", input, sendPush as never),
    ).resolves.toEqual({ ownerId, notificationId: "notif-1", sent: 0 });
  });
});