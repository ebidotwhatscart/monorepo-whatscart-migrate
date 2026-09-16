import type { Firestore } from "firebase-admin/firestore";

import { getAdminMessaging } from "./admin";

export type OrderNotificationInput = {
  orderId: string;
  orderNumber: string;
  totalAmount: number;
};

export function formatOrderAmountValue(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function buildOrderNotification(input: OrderNotificationInput) {
  const body = `Order ${input.orderNumber} — ₹${formatOrderAmountValue(input.totalAmount)}`;
  return {
    notification: { title: "New order", body },
    data: {
      orderId: input.orderId,
      orderNumber: input.orderNumber,
      url: `/dashboard/orders/${input.orderId}`,
    },
  };
}

type PushMessage = ReturnType<typeof buildOrderNotification>;

export async function sendPushToOwner(
  firestore: Firestore,
  ownerId: string,
  message: PushMessage,
) {
  const snapshot = await firestore
    .collection("users")
    .doc(ownerId)
    .collection("devices")
    .get();
  const tokens = snapshot.docs
    .map((document) => document.data().token)
    .filter((token): token is string => typeof token === "string" && token.length > 0);
  const messaging = getAdminMessaging();
  if (!tokens.length || !messaging) return { sent: 0 };
  const result = await messaging.sendEach(
    tokens.map((token) => ({ token, ...message })),
  );
  return { sent: result.responses.filter((response) => response.success).length };
}

export async function notifyNewOrder(
  firestore: Firestore,
  businessId: string,
  input: OrderNotificationInput,
  sendPush: typeof sendPushToOwner = sendPushToOwner,
) {
  const business = await firestore.collection("businesses").doc(businessId).get();
  const ownerId = business.data()?.ownerId;
  if (typeof ownerId !== "string" || !ownerId) return null;

  const notificationRef = firestore
    .collection("users")
    .doc(ownerId)
    .collection("notifications")
    .doc();
  const now = Date.now();
  const message = buildOrderNotification(input);
  await notificationRef.set({
    type: "order",
    orderId: input.orderId,
    orderNumber: input.orderNumber,
    message: message.notification.body,
    createdAt: now,
    read: false,
  });

  let sent = 0;
  try {
    const result = await sendPush(firestore, ownerId, message);
    sent = result.sent;
  } catch (error) {
    console.error("Order push notification failed:", error);
  }
  return { ownerId, notificationId: notificationRef.id, sent };
}