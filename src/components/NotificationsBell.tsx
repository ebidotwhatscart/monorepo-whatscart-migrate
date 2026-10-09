import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { getFirebaseClient } from "@/lib/firebase/client";
import { useOptionalFirebaseAuth } from "@/lib/firebase/auth-context";
import { enableOrderPushNotifications } from "@/hooks/useOrderNotifications";

type NotificationItem = {
  id: string;
  orderId: string;
  orderNumber: string;
  message: string;
  createdAt: number;
  read: boolean;
};

export function NotificationsBell() {
  const auth = useOptionalFirebaseAuth();
  const isSignedIn = auth?.isSignedIn ?? false;
  const user = auth?.user ?? null;
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [pushPermission, setPushPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");
  const [enablingPush, setEnablingPush] = useState(false);
  const [pushError, setPushError] = useState("");

  useEffect(() => {
    setPushPermission(
      typeof Notification === "undefined" ? "unsupported" : Notification.permission,
    );
  }, []);

  useEffect(() => {
    const client = getFirebaseClient();
    if (!client || !isSignedIn || !user) return;
    const uid = user.uid;
    const notificationsRef = collection(client.firestore, "users", uid, "notifications");

    const offUnread = onSnapshot(
      query(notificationsRef, where("read", "==", false)),
      (snapshot) => setUnread(snapshot.docs.length),
    );
    const offLatest = onSnapshot(
      query(notificationsRef, orderBy("createdAt", "desc"), limit(20)),
      (snapshot) => {
        setItems(
          snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              orderId: String(data.orderId ?? ""),
              orderNumber: String(data.orderNumber ?? ""),
              message: String(data.message ?? ""),
              createdAt: Number(data.createdAt ?? 0),
              read: Boolean(data.read),
            };
          }),
        );
      },
    );
    return () => {
      offUnread();
      offLatest();
    };
  }, [isSignedIn, user]);

  async function markRead(ids: string[]) {
    if (!ids.length) return;
    const client = getFirebaseClient();
    const authUser = client?.auth.currentUser;
    if (!authUser) return;
    try {
      await fetch("/api/private/notifications/read", {
        method: "POST",
        headers: { authorization: `Bearer ${await authUser.getIdToken()}` },
        body: JSON.stringify({ notificationIds: ids }),
      });
    } catch (error) {
      console.error("Mark-read failed:", error);
    }
  }

  function handleOpen() {
    const next = !open;
    setOpen(next);
    if (next) {
      void markRead(items.filter((item) => !item.read).map((item) => item.id));
    }
  }

  function handleItemClick(id: string, orderId: string) {
    setOpen(false);
    void markRead([id]);
    if (orderId) navigate(`/dashboard/orders/${orderId}`);
  }

  async function handleEnablePush() {
    setEnablingPush(true);
    setPushError("");
    try {
      const enabled = await enableOrderPushNotifications();
      setPushPermission(
        typeof Notification === "undefined" ? "unsupported" : Notification.permission,
      );
      if (!enabled && typeof Notification !== "undefined" && Notification.permission === "granted")
        setPushError("Could not connect this device. Check your Firebase messaging setup and try again.");
      if (!enabled && typeof Notification !== "undefined" && Notification.permission === "default")
        setPushError("Allow notifications in the browser prompt to enable order alerts.");
    } catch {
      setPushError("Could not enable order alerts. Please try again.");
    } finally {
      setEnablingPush(false);
    }
  }

  return (
    <div className="fixed right-3 top-3 z-50">
      <button
        type="button"
        aria-label="Notifications"
        onClick={handleOpen}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm"
      >
        <Bell className="h-5 w-5 text-slate-700" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-72 max-h-96 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          {isSignedIn && (pushPermission === "default" || pushPermission === "granted") && (
            <div className="border-b border-slate-100 p-3">
              <p className="mb-2 text-xs text-slate-600">Get an alert when a new order arrives.</p>
              <button
                type="button"
                disabled={enablingPush}
                onClick={() => void handleEnablePush()}
                className="w-full rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {enablingPush
                  ? "Enabling…"
                  : pushPermission === "granted"
                    ? "Set up this device"
                    : "Enable order alerts"}
              </button>
              {pushError && <p role="status" className="mt-2 text-xs text-red-600">{pushError}</p>}
            </div>
          )}
          {isSignedIn && pushPermission === "denied" && (
            <p className="border-b border-slate-100 p-3 text-xs text-slate-600">
              Notifications are blocked in browser settings. Allow them there to receive order alerts.
            </p>
          )}
          {isSignedIn && pushPermission === "unsupported" && (
            <p className="border-b border-slate-100 p-3 text-xs text-slate-600">
              Push notifications are not supported by this browser.
            </p>
          )}
          {items.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500">No notifications yet</div>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleItemClick(item.id, item.orderId)}
                className={`block w-full border-b border-slate-100 px-3 py-3 text-left text-sm hover:bg-slate-50 ${item.read ? "text-slate-500" : "font-medium text-slate-900"}`}
              >
                {item.message}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
