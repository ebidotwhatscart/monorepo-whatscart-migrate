# Order Notifications for Store Owner — Design Spec

Date: 2026-09-16
Status: Approved
Branch: feature/notification

## Goal

When a customer places an order on a storefront, the store owner receives a
push notification and an in-app notification. Push delivery uses Firebase Cloud
Messaging (FCM); in-app uses a Firestore notifications list with a bell.

## Recipient & trigger

- Recipient: store owner only.
- Trigger: customer order created through `createPublicOrder` (the checkout
  path). Manual owner orders do NOT notify.
- Notification content: order number + total. Click targets the order detail
  page.

## Architecture

```
Storefront checkout
  └─ POST /api/public/orders
       ├─ createPublicOrder() → Firestore `orders` (status: pending)
       └─ NEW: notifyNewOrder()  (firebase-admin, inside same API route)
            ├─ writes in-app doc → users/{ownerId}/notifications/{nid}
            └─ admin.messaging().send() to each owner device token
```

No Cloud Functions. firebase-admin already installed; runs on Vercel.

## FCM web push

1. **Token registration (client)** — when owner is logged in on the dashboard
   (`app.whatscart.in`), a hook requests notification permission then
   `getToken(messaging, { vapidKey, serviceWorkerRegistration })`. Token is sent
   to a new protected API route and stored at `users/{uid}/devices/{token}`
   (multi-device safe).
2. **Service worker** — new `/firebase-messaging-sw.js` route using
   `firebase/messaging/sw`; `onBackgroundMessage` → `showNotification`. Separate
   from the existing caching SW at `/sw.js`.
3. **Send** — inside order API route, after Firestore write succeeds:
   ```
   admin.messaging().send({
     token,
     notification: { title: "New order", body: "Order POSI00003 — ₹1,397" },
     data: { orderId, orderNumber },
   })
   ```
4. **Click** — `onMessage` (foreground) and SW `notificationclick` navigate to
   the order detail page using `data.orderId`.

## In-app bell

- Notification docs at `users/{uid}/notifications/{nid}`:
  ```
  { type: "order", orderId, orderNumber, message, createdAt, read: boolean }
  ```
- Bell in dashboard header with unread count via live `onSnapshot`; list +
  "mark read".

## Firestore rules

- `users/{uid}/devices/{token}` — owner-only write + read.
- `users/{uid}/notifications/{doc}` — owner-only read; writes via Admin rules
  only (client writes denied).

## Config

- New env: `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.
- Add `token` claim / VAPID config to `.env.example`.

## Testing

- Unit: message builder + notify helper (message shape, token targeting).
- Integration (emulator): order POST writes notification doc; token
  registration route stores token; rules enforce owner-only access.
- Existing dashboard-order-flow tests kept green.

## Out of scope

- Customer notifications on status change.
- WhatsApp fallback.
- Multi-branch/manual order notifications.