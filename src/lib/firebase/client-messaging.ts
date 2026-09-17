import { getMessaging, getToken, onMessage } from "firebase/messaging";

import { getFirebaseClient } from "./client";

export type ForegroundOrderMessage = {
  notification?: { title?: string; body?: string };
  data?: Record<string, string>;
};

export async function requestFcmToken(registration: ServiceWorkerRegistration) {
  const client = getFirebaseClient();
  if (!client) return null;
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) return null;
  if (typeof Notification !== "undefined" && Notification.permission !== "granted") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;
  }
  return getToken(getMessaging(client.app), {
    vapidKey,
    serviceWorkerRegistration: registration,
  });
}

export function subscribeForegroundOrderMessages(
  handler: (message: ForegroundOrderMessage) => void,
) {
  const client = getFirebaseClient();
  if (!client) return () => {};
  return onMessage(getMessaging(client.app), handler);
}

async function deviceRequest(method: "POST" | "DELETE", token: string) {
  const client = getFirebaseClient();
  if (!client) return;
  const user = client.auth.currentUser;
  if (!user) return;
  const url =
    method === "DELETE"
      ? `/api/private/notifications/device?token=${encodeURIComponent(token)}`
      : "/api/private/notifications/device";
  const response = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${await user.getIdToken()}` },
    ...(method === "POST" ? { body: JSON.stringify({ token }) } : {}),
  });
  if (!response.ok) {
    throw new Error("Device registration failed.");
  }
}

export async function registerPushDevice(token: string) {
  await deviceRequest("POST", token);
}

export async function unregisterPushDevice(token: string) {
  await deviceRequest("DELETE", token);
}