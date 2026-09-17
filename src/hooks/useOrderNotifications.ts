import { useEffect, useRef } from "react";

import { useOptionalFirebaseAuth } from "@/lib/firebase/auth-context";
import {
  registerPushDevice,
  requestFcmToken,
  subscribeForegroundOrderMessages,
  unregisterPushDevice,
} from "@/lib/firebase/client-messaging";

import { useRegisterSW } from "./useRegisterSW";

let liveRegistration: ServiceWorkerRegistration | null = null;

export function useOrderNotifications() {
  const auth = useOptionalFirebaseAuth();
  const isSignedIn = auth?.isSignedIn ?? false;
  const isLoaded = auth?.isLoaded ?? false;
  const user = auth?.user ?? null;
  const signedInRef = useRef(false);
  signedInRef.current = isSignedIn;

  useRegisterSW({
    onRegisteredSW: (_url, registration) => {
      liveRegistration = registration ?? null;
      if (signedInRef.current) void registerToken(liveRegistration);
    },
  });

  useEffect(() => {
    if (!isLoaded || !signedInRef.current || !user) return;
    if (liveRegistration) void registerToken(liveRegistration);
  }, [isLoaded, isSignedIn, user]);

  useEffect(() => {
    if (!isSignedIn) return;
    return subscribeForegroundOrderMessages((message) => {
      const title = message.notification?.title ?? "New order";
      const body = message.notification?.body ?? "";
      if (typeof window !== "undefined" && "Notification" in window) {
        if (window.Notification?.permission === "granted") {
          new window.Notification(title, { body, icon: "/pwa-192x192.png" });
        }
      }
    });
  }, [isSignedIn]);

  useEffect(() => {
    if (isSignedIn) return;
    if (liveRegistration) {
      void clearToken();
    }
    return () => {};
  }, [isSignedIn]);
}

async function registerToken(registration: ServiceWorkerRegistration | null) {
  if (!registration) return;
  try {
    const token = await requestFcmToken(registration);
    if (!token) return;
    await registerPushDevice(token);
  } catch (error) {
    console.error("Push registration failed:", error);
  }
}

async function clearToken() {
  const { getFirebaseClient } = await import("@/lib/firebase/client");
  const client = getFirebaseClient();
  const user = client?.auth.currentUser;
  if (!user) return;
  const { getToken, deleteToken, getMessaging } = await import("firebase/messaging");
  try {
    const messaging = getMessaging(client.app);
    const current = await getToken(messaging, {
      serviceWorkerRegistration: liveRegistration ?? undefined,
    });
    if (current) {
      await unregisterPushDevice(current);
      await deleteToken(messaging);
    }
  } catch {
    return;
  }
}