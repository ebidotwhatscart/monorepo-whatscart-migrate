import { useEffect, useRef } from "react";

import { useOptionalFirebaseAuth } from "@/lib/firebase/auth-context";
import {
  registerPushDevice,
  requestFcmToken,
  subscribeForegroundOrderMessages,
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
      if (
        typeof window !== "undefined" &&
        window.Notification?.permission === "granted" &&
        liveRegistration
      ) {
        const url = message.data?.url ?? "/dashboard/orders";
        void liveRegistration.showNotification(title, {
          body,
          icon: "/pwa-192x192.png",
          badge: "/pwa-192x192.png",
          data: { url },
        });
      }
    });
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

export async function enableOrderPushNotifications() {
  if (!liveRegistration) {
    if (!("serviceWorker" in navigator)) return false;
    try {
      liveRegistration = await navigator.serviceWorker.ready;
    } catch {
      return false;
    }
  }
  try {
    const { enablePushNotifications } = await import(
      "@/lib/firebase/client-messaging"
    );
    return Boolean(await enablePushNotifications(liveRegistration));
  } catch (error) {
    console.error("Push registration failed:", error);
    return false;
  }
}
