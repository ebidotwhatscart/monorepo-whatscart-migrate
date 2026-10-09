import {
  deleteToken,
  getMessaging,
  getToken,
  isSupported,
  onMessage,
} from "firebase/messaging";

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
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return null;
  if (!(await isSupported())) return null;
  return getToken(getMessaging(client.app), {
    vapidKey,
    serviceWorkerRegistration: registration,
  });
}

/** Call from a user gesture so browsers can show their notification permission prompt. */
export async function enablePushNotifications(registration: ServiceWorkerRegistration) {
  if (typeof Notification === "undefined" || !(await isSupported())) return null;
  const permission =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();
  if (permission !== "granted") return null;
  const token = await requestFcmToken(registration);
  if (token) await registerPushDevice(token);
  return token;
}

export function subscribeForegroundOrderMessages(
  handler: (message: ForegroundOrderMessage) => void,
) {
  const client = getFirebaseClient();
  if (!client) return () => {};
  if (typeof window === "undefined") return () => {};
  try {
    return onMessage(getMessaging(client.app), handler);
  } catch {
    return () => {};
  }
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

export async function unregisterCurrentPushDevice(
  registration?: ServiceWorkerRegistration,
) {
  const client = getFirebaseClient();
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!client?.auth.currentUser || !vapidKey || !(await isSupported())) return;
  const messaging = getMessaging(client.app);
  const token = await getToken(messaging, {
    vapidKey,
    ...(registration ? { serviceWorkerRegistration: registration } : {}),
  });
  if (!token) return;
  await unregisterPushDevice(token);
  await deleteToken(messaging);
}
