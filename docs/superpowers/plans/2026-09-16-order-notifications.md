# Order Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Notify the store owner via FCM web push + an in-app bell when a customer places an order on a storefront.

**Architecture:** After `createPublicOrder` succeeds in POST `/api/public/orders`, the route calls `notifyNewOrder()` (firebase-admin): it writes an in-app notification doc at `users/{ownerId}/notifications/{id}` then best-effort FCM-sends to all of the owner's registered device tokens at `users/{ownerId}/devices/{token}`. Client side: a hook registers the owner's push token after sign-in, a bell (mounted in `BusinessLayout`) lists notifications live, and the existing caching service worker is extended with FCM background handling (single SW at `/sw.js` — a second SW at root scope would conflict). No Cloud Functions; runs on Vercel.

**Tech Stack:** Next.js 16 route handlers, firebase-admin (firestore + messaging), firebase/messaging (client), Vitest + Firebase emulator.

> **SPEC REVISION (flagged during planning):** The approved spec called for a separate `/firebase-messaging-sw.js`. The existing caching service worker registers `/sw.js` at root scope (`src/hooks/useRegisterSW.ts:43`), and two service workers cannot both control the root scope — they would replace each other. Revision: extend the existing single SW with FCM compat `importScripts` + `onBackgroundMessage` + `notificationclick`. Everything else in the spec is unchanged.

## Global Constraints

- TypeScript strict mode; `@/*` path alias maps to `./src/*`. No code comments.
- Convention commits (repo style: `feat:`, `fix:`, `docs:` lowercase).
- API routes return `noStoreHeaders` (copy from existing routes) on every JSON response and `503` when Firebase Admin is not configured.
- Private routes authenticate via `verifyFirebaseRequest(request)` (`src/lib/firebase/server-auth.ts`), handling `FirebaseRequestAuthError` (401/503) separately from 400.
- Integration tests gate on `process.env.FIRESTORE_EMULATOR_HOST` and set `FIREBASE_PROJECT_ID` / `NEXT_PUBLIC_FIREBASE_PROJECT_ID` to `demo-whatscart` (mirror `src/lib/firebase/__tests__/public-commerce.integration.test.ts:7-13`). Run via `firebase:emulators` + `vitest`.
- Do not break the zero-visual-drift contract; no changes to storefront checkout UI.
- Order creation failures must NOT be caused by notification failures — `notifyNewOrder` is best-effort, wrapped in `.catch()` in the route.
- FCM gstatic compat SDK version must match installed `firebase@12.x`. Verify the exact path exists at `https://www.gstatic.com/firebasejs/VERSION/firebase-app-compat.js` before pinning.

---

### Task 1: Server-side notification library

**Files:**
- Create: `src/lib/firebase/notifications.ts`
- Modify: `src/lib/firebase/admin.ts` (add `getAdminMessaging`)
- Test: `src/lib/firebase/__tests__/notifications.test.ts`

**Interfaces:**
- Consumes: `getAdminFirestore` / new `getAdminMessaging` from `@/lib/firebase/admin`; `Firestore` type from `firebase-admin/firestore`.
- Produces:
  - `OrderNotificationInput = { orderId: string; orderNumber: string; totalAmount: number }`
  - `buildOrderNotification(input): { notification: { title: string; body: string }; data: Record<string, string> }`
  - `sendPushToOwner(firestore, ownerId: string, message: { notification: ...; data: ... }): Promise<{ sent: number }>`
  - `notifyNewOrder(firestore: Firestore, businessId: string, input: OrderNotificationInput, sendPush?: typeof sendPushToOwner): Promise<{ ownerId: string; notificationId: string; sent: number } | null>`

- [x] **Step 1: Write the failing tests**

Create `src/lib/firebase/__tests__/notifications.test.ts`:

```ts
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
      expect.objectContaining({ notification: { title: "New order" } }),
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
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/firebase/__tests__/notifications.test.ts`
Expected: FAIL — module `../notifications` has no exported members.

- [x] **Step 3: Add `getAdminMessaging` to admin.ts**

In `src/lib/firebase/admin.ts`, add the import and a new export alongside `getAdminFirestore`:

```ts
import { getMessaging } from "firebase-admin/messaging";
```

```ts
export function getAdminMessaging() {
  const app = getFirebaseAdminApp();
  return app ? getMessaging(app) : null;
}
```

- [x] **Step 4: Write the notification library**

Create `src/lib/firebase/notifications.ts`:

```ts
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
```

- [x] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/firebase/__tests__/notifications.test.ts`
Expected: PASS (3 tests).

- [x] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [x] **Step 7: Commit**

```bash
git add src/lib/firebase/notifications.ts src/lib/firebase/admin.ts src/lib/firebase/__tests__/notifications.test.ts
git commit -m "feat: add order notification library with FCM push"
```

---

### Task 2: Trigger notifications on order creation

**Files:**
- Modify: `src/lib/firebase/public-commerce.ts` (return `totalAmount` from `createPublicOrder`)
- Modify: `src/app/api/public/orders/route.ts` (call `notifyNewOrder`)
- Test: `src/lib/firebase/__tests__/notifications.integration.test.ts`

**Interfaces:**
- Consumes: `notifyNewOrder` from Task 1; `createPublicOrder` existing signature.
- Produces: `createPublicOrder` now returns `{ accessToken: string; order: string; orderId: string; totalAmount: number }`. Notification verification test asserts a doc under `users/{ownerId}/notifications`.

- [x] **Step 1: Write the failing integration test**

Create `src/lib/firebase/__tests__/notifications.integration.test.ts`:

```ts
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
```

Verify the seeded business prefix matches `getBusinessOrderPrefix` behavior used in the emulator (inspect `src/lib/firebase/public-commerce.ts:89` for the prefix; use the resulting literal in the assertion above, e.g. `NOTIF00001`). Adjust the assertion literal to the actual prefix.

- [x] **Step 2: Run test to verify it fails**

Run (with emulators running): `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npx vitest run src/lib/firebase/__tests__/notifications.integration.test.ts`
Expected: FAIL — assertion `notification.type` is undefined (no doc written).

- [x] **Step 3: Return totalAmount from createPublicOrder**

In `src/lib/firebase/public-commerce.ts`, change the return at line ~324:

```ts
return { accessToken: orderAccessToken, order: orderRef.id, orderId };
```

to:

```ts
return { accessToken: orderAccessToken, order: orderRef.id, orderId, totalAmount: finalTotalAmount };
```

- [x] **Step 4: Wire notifyNewOrder into the route**

In `src/app/api/public/orders/route.ts`:

- Add import:
  ```ts
  import { notifyNewOrder } from "@/lib/firebase/notifications";
  ```
- Replace the POST handler body so the raw body is parsed once and notifications fire after the order write:

```ts
export async function POST(request: NextRequest) {
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json(
      { error: "Firebase Admin is not configured." },
      { status: 503, headers: noStoreHeaders },
    );
  }
  try {
    const rawBody = await request.json();
    const businessId =
      typeof rawBody === "object" && rawBody !== null && "businessId" in rawBody
        ? String(rawBody.businessId)
        : "";
    const result = await createPublicOrder(
      firestore,
      rawBody,
      request.headers.get("x-customer-access-token"),
    );
    if (businessId) {
      await notifyNewOrder(firestore, businessId, {
        orderId: result.order,
        orderNumber: result.orderId,
        totalAmount: result.totalAmount,
      }).catch((error) => {
        console.error("Failed to notify store owner:", error);
      });
    }
    return NextResponse.json(result, { headers: noStoreHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Order is invalid." },
      { status: 400, headers: noStoreHeaders },
    );
  }
}
```

- [x] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/firebase/__tests__/notifications.integration.test.ts src/lib/firebase/__tests__/public-commerce.integration.test.ts src/lib/firebase/__tests__/private-orders.integration.test.ts`
Expected: PASS — notification doc written; existing commerce/order tests still green.

- [x] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [x] **Step 7: Commit**

```bash
git add src/lib/firebase/public-commerce.ts src/app/api/public/orders/route.ts src/lib/firebase/__tests__/notifications.integration.test.ts
git commit -m "feat: notify store owner when a public order is placed"
```

---

### Task 3: Device token + mark-read API routes and rules

**Files:**
- Create: `src/app/api/private/notifications/device/route.ts`
- Create: `src/app/api/private/notifications/read/route.ts`
- Modify: `firestore.rules`
- Test: `src/lib/firebase/__tests__/notifications.integration.test.ts` (append)

**Interfaces:**
- Consumes: `verifyFirebaseRequest`, `FirebaseRequestAuthError`, `getAdminFirestore`, `getAdminAuth` (existing).
- Produces:
  - `POST /api/private/notifications/device` body `{ token: string }` → stores `users/{uid}/devices/{token}`.
  - `DELETE /api/private/notifications/device?token=...` → deletes `users/{uid}/devices/{token}`.
  - `POST /api/private/notifications/read` body `{ notificationIds: string[] }` → sets `read: true` on those docs owned by `uid`.

- [x] **Step 1: Append failing tests**

Append to `src/lib/firebase/__tests__/notifications.integration.test.ts` inside the `describeWithEmulator` block:

```ts
  it("registers and removes a device token for the signed-in owner", async () => {
    const { POST, DELETE } = await import("../../../app/api/private/notifications/device/route");
    const admin = await import("../admin");
    const auth = admin.getAdminAuth();
    if (!auth) throw new Error("Auth emulator is unavailable.");

    const userRecord = await auth.createUser({
      uid: "notify-owner",
      email: "notify-owner@example.test",
    });
    let idToken = await auth.createCustomToken(userRecord.uid);

    if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
      const { signInWithCustomToken } = await import("firebase/auth");
      const { getFirebaseClient } = await import("../client");
      const client = getFirebaseClient();
      if (!client) throw new Error("Client is unavailable.");
      const credential = await signInWithCustomToken(client.auth, idToken);
      idToken = await credential.user.getIdToken();
    }

    const tokenValue = "fcm-token-device-0001";
    const register = new NextRequest("http://app.whatscart.in/api/private/notifications/device", {
      method: "POST",
      headers: { authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ token: tokenValue }),
    });
    const registerResponse = await POST(register);
    expect(registerResponse.status).toBe(200);

    const deviceDoc = await firestore
      .collection("users")
      .doc("notify-owner")
      .collection("devices")
      .doc(tokenValue)
      .get();
    expect(deviceDoc.exists).toBe(true);
    expect(deviceDoc.data()?.token).toBe(tokenValue);

    const remove = new NextRequest(
      `http://app.whatscart.in/api/private/notifications/device?token=${encodeURIComponent(tokenValue)}`,
      { method: "DELETE", headers: { authorization: `Bearer ${idToken}` } },
    );
    const removeResponse = await DELETE(remove);
    expect(removeResponse.status).toBe(200);
    expect((await deviceDoc.ref.get()).exists).toBe(false);
  });

  it("marks own notifications as read", async () => {
    const { POST } = await import("../../../app/api/private/notifications/read/route");
    const created = await firestore
      .collection("users")
      .doc("notify-owner")
      .collection("notifications")
      .add({ type: "order", orderId: "x", read: false, createdAt: Date.now() });

    const admin = await import("../admin");
    const auth = admin.getAdminAuth();
    if (!auth) throw new Error("Auth emulator is unavailable.");
    const userRecord = await auth.getUser("notify-owner");
    let idToken = await auth.createCustomToken(userRecord.uid);
    if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
      const { signInWithCustomToken } = await import("firebase/auth");
      const { getFirebaseClient } = await import("../client");
      const client = getFirebaseClient();
      if (!client) throw new Error("Client is unavailable.");
      const credential = await signInWithCustomToken(client.auth, idToken);
      idToken = await credential.user.getIdToken();
    }

    const request = new NextRequest("http://app.whatscart.in/api/private/notifications/read", {
      method: "POST",
      headers: { authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ notificationIds: [created.id] }),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect((await created.get()).data()?.read).toBe(true);
  });
```

Note: the emulator auth sign-in flow above mirrors how existing integration tests mint real ID tokens. If a simpler ID-token minting helper already exists in `src/lib/firebase/__tests__/` (e.g. `createIdentity` in `private-orders.integration.test.ts`), reuse it instead and delete the inline signing code.

- [x] **Step 2: Run tests to verify they fail**

Run: `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npx vitest run src/lib/firebase/__tests__/notifications.integration.test.ts`
Expected: FAIL — imports of the new routes resolve to modules that don't exist (404 / no exported POST).

- [x] **Step 3: Create the device token route**

Create `src/app/api/private/notifications/device/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";

import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  FirebaseRequestAuthError,
  verifyFirebaseRequest,
} from "@/lib/firebase/server-auth";

const noStoreHeaders = {
  "cache-control": "private, no-cache, no-store, max-age=0, must-revalidate",
  "cdn-cache-control": "no-store",
  "vercel-cdn-cache-control": "no-store",
};

const DEVICE_TOKEN_PATTERN = /^[A-Za-z0-9:_\-]{1,512}$/;

function statusFor(error: unknown) {
  return error instanceof FirebaseRequestAuthError ? error.status : 400;
}

export async function POST(request: NextRequest) {
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json(
      { error: "Firebase Admin is not configured." },
      { status: 503, headers: noStoreHeaders },
    );
  }
  try {
    const identity = await verifyFirebaseRequest(request);
    const body = (await request.json()) as { token?: unknown };
    const token = body.token;
    if (typeof token !== "string" || !DEVICE_TOKEN_PATTERN.test(token)) {
      throw new Error("Device token is invalid.");
    }
    const now = Date.now();
    await firestore
      .collection("users")
      .doc(identity.uid)
      .collection("devices")
      .doc(token)
      .set(
        { token, platform: "web", createdAt: now, updatedAt: now },
        { merge: true },
      );
    return NextResponse.json({ ok: true }, { headers: noStoreHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Device registration failed." },
      { status: statusFor(error), headers: noStoreHeaders },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json(
      { error: "Firebase Admin is not configured." },
      { status: 503, headers: noStoreHeaders },
    );
  }
  try {
    const identity = await verifyFirebaseRequest(request);
    const token = request.nextUrl.searchParams.get("token") ?? "";
    if (!DEVICE_TOKEN_PATTERN.test(token)) {
      throw new Error("Device token is invalid.");
    }
    await firestore
      .collection("users")
      .doc(identity.uid)
      .collection("devices")
      .doc(token)
      .delete();
    return NextResponse.json({ ok: true }, { headers: noStoreHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Device removal failed." },
      { status: statusFor(error), headers: noStoreHeaders },
    );
  }
}
```

- [x] **Step 4: Create the mark-read route**

Create `src/app/api/private/notifications/read/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";

import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  FirebaseRequestAuthError,
  verifyFirebaseRequest,
} from "@/lib/firebase/server-auth";

const noStoreHeaders = {
  "cache-control": "private, no-cache, no-store, max-age=0, must-revalidate",
  "cdn-cache-control": "no-store",
  "vercel-cdn-cache-control": "no-store",
};

const ID_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;
const MAX_IDS = 50;

export async function POST(request: NextRequest) {
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json(
      { error: "Firebase Admin is not configured." },
      { status: 503, headers: noStoreHeaders },
    );
  }
  try {
    const identity = await verifyFirebaseRequest(request);
    const body = (await request.json()) as { notificationIds?: unknown };
    const notificationIds = Array.isArray(body.notificationIds)
      ? body.notificationIds.filter(
          (id): id is string =>
            typeof id === "string" &&
            id.length > 0 &&
            id.length <= MAX_IDS &&
            ID_PATTERN.test(id),
        )
      : [];
    const notifications = firestore
      .collection("users")
      .doc(identity.uid)
      .collection("notifications");
    const batch = firestore.batch();
    notificationIds.forEach((id) => {
      batch.update(notifications.doc(id), { read: true });
    });
    await batch.commit();
    return NextResponse.json({ updated: notificationIds.length }, { headers: noStoreHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Mark-read failed." },
      { status: error instanceof FirebaseRequestAuthError ? error.status : 400, headers: noStoreHeaders },
    );
  }
}
```

- [x] **Step 5: Add firestore rules**

In `firestore.rules`, after the `match /users/{userId} { ... }` block (line ~32) add:

```
    match /users/{userId}/devices/{token} {
      allow read, write: if isSuperAdmin();
    }

    match /users/{userId}/notifications/{notificationId} {
      allow read: if signedIn() && request.auth.uid == userId;
      allow write: if isSuperAdmin();
    }
```

Keep the `/*`-style comment removed; the repo uses `//` comments.

- [x] **Step 6: Run tests to verify they pass**

Run: `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npx vitest run src/lib/firebase/__tests__/notifications.integration.test.ts`
Expected: PASS (3 tests total in this file).

- [x] **Step 7: Typecheck + rules check**

Run: `npm run typecheck`
Expected: no errors.

Run: `npx firebase-tools@15.4.0 emulators:exec --project demo-whatscart "echo rules ok"` (validates firestore.rules syntax on emulator boot).
Expected: emulator starts without rule parse errors.

- [x] **Step 8: Commit**

```bash
git add src/app/api/private/notifications src/lib/firebase/__tests__/notifications.integration.test.ts firestore.rules
git commit -m "feat: add device token and mark-read notification routes"
```

---

### Task 4: Client push registration + FCM service worker integration

**Files:**
- Modify: `src/lib/pwa/service-worker.ts`
- Modify: `src/app/sw.js/route.ts`
- Create: `src/lib/firebase/client-messaging.ts`
- Create: `src/hooks/useOrderNotifications.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `getFirebaseClient` from `@/lib/firebase/client`; `useFirebaseAuth` from `@/lib/firebase/auth-context`; `useRegisterSW` from `@/hooks/useRegisterSW`.
- Produces:
  - `serviceWorkerSource(deploymentVersion: string, messagingSenderId: string)` — embeds FCM background handling when `messagingSenderId` is truthy.
  - `requestFcmToken(registration: ServiceWorkerRegistration): Promise<string | null>`
  - `registerPushDevice(token: string): Promise<void>` / `unregisterPushDevice(token: string): Promise<void>`
  - `subscribeForegroundOrderMessages(handler: (payload: { notification?: { title?: string; body?: string }; data?: Record<string, string> }) => void): () => void`
  - `useOrderNotifications()` — self-contained hook: registers token on sign-in, unregisters on sign-out, toasts foreground pushes.

- [x] **Step 1: Confirm the gstatic FCM compat version exists**

Check the exact installed client firebase version and that the compat SW scripts exist on gstatic:

```bash
node -e "console.log(require('./node_modules/firebase/package.json').version)"
```

Then fetch `https://www.gstatic.com/firebasejs/<installed-version>/firebase-app-compat.js` (e.g. `12.17.1`) — Expected: 200. If 404, try the nearest available `12.x` release. Record the working version as `FCM_GSTATIC_VERSION`.

- [x] **Step 2: Extend the service worker source**

In `src/lib/pwa/service-worker.ts`, change the signature:

```ts
export function serviceWorkerSource(
  deploymentVersion: string,
  messagingSenderId = "",
) {
```

Then append the FCM block to the returned template string (after the existing worker body). The current function returns `const CACHE_VERSION = ...;` plus a `String.raw\`...\`` literal. Add a second interpolated segment:

```ts
  const firebaseMessagingBlock =
    messagingSenderId
      ? String.raw`
if ("importScripts" in self) {
  try {
    importScripts("https://www.gstatic.com/firebasejs/FCM_GSTATIC_VERSION/firebase-app-compat.js");
    importScripts("https://www.gstatic.com/firebasejs/FCM_GSTATIC_VERSION/firebase-messaging-compat.js");
    firebase.initializeApp({ messagingSenderId: ${JSON.stringify(messagingSenderId)} });
    var fcmMessaging = firebase.messaging();
    fcmMessaging.onBackgroundMessage(function (payload) {
      var notification = payload.notification || {};
      var data = payload.data || {};
      var url = data.url || ("/dashboard/orders/" + (data.orderId || ""));
      self.registration.showNotification(notification.title || "New order", {
        body: notification.body || "",
        icon: "/pwa-192x192.png",
        badge: "/pwa-192x192.png",
        data: { url: url },
      });
    });
    self.addEventListener("notificationclick", function (event) {
      event.notification.close();
      var targetUrl = (event.notification.data && event.notification.data.url) || "/dashboard/orders";
      event.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (windowClients) {
          for (var i = 0; i < windowClients.length; i++) {
            var client = windowClients[i];
            if ("navigate" in client) {
              return client.navigate(targetUrl).then(function () { return client.focus(); });
            }
          }
          return clients.openWindow(targetUrl);
        })
      );
    });
  } catch (error) {
    console.error("FCM service worker init failed:", error);
  }
}`
      : "";

  return `...existing prefix...` + String.raw`...existing body...` + firebaseMessagingBlock;
```

Replace the `FCM_GSTATIC_VERSION` placeholder in every `importScripts` URL with the version recorded in Step 1. Place the `firebaseMessagingBlock` so the SW's `fetch`/`activate` handlers are unaffected.

- [x] **Step 3: Pass the sender ID from the sw route**

In `src/app/sw.js/route.ts`, update the GET handler:

```ts
  const deploymentVersion =
    process.env.VERCEL_URL ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.NEXT_PUBLIC_APP_VERSION ??
    "local-development";
  return new Response(
    serviceWorkerSource(deploymentVersion, process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? ""),
    {
```

- [x] **Step 4: Add the VAPID env to .env.example**

Append after `NEXT_PUBLIC_FIREBASE_APP_ID=`:

```
NEXT_PUBLIC_FIREBASE_VAPID_KEY=
```

- [x] **Step 5: Write the client messaging module**

Create `src/lib/firebase/client-messaging.ts`:

```ts
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
```

- [x] **Step 6: Write the useOrderNotifications hook**

Create `src/hooks/useOrderNotifications.ts`:

```ts
import { useEffect, useRef } from "react";

import { useFirebaseAuth } from "@/lib/firebase/auth-context";

import { useRegisterSW } from "./useRegisterSW";
import {
  registerPushDevice,
  requestFcmToken,
  subscribeForegroundOrderMessages,
} from "@/lib/firebase/client-messaging";

let liveRegistration: ServiceWorkerRegistration | null = null;

export function useOrderNotifications() {
  const { isLoaded, isSignedIn, user } = useFirebaseAuth();
  const signedInRef = useRef(false);
  signedInRef.current = isSignedIn;

  useRegisterSW({
    onRegisteredSW: (_url, registration) => {
      liveRegistration = registration;
      if (signedInRef.current) void registerToken(registration);
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

async function registerToken(registration: ServiceWorkerRegistration) {
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
    // No token to clear.
  }
}
```

Note: verify `useRegisterSW`'s `onRegisteredSW` option type accepts these args — it does (`(serviceWorkerUrl: string, registration?: ServiceWorkerRegistration) => void`). Do NOT add `"use client"` to the hook file if the module is only imported from client components; if the typecheck complains about server/client boundary, add it.

- [x] **Step 7: Verify build**

Run: `npm run build`
Expected: SW route compiles; service worker source string includes the FCM importScripts when sender ID is present. (Build may take a while — this is the authoritative check that the template string is valid JS served as `application/javascript`.)

Open the built site locally and fetch `/sw.js` with `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` set: the response should contain `firebase-messaging-compat` and `onBackgroundMessage`. With the env var unset, the response must NOT contain `onBackgroundMessage`.

- [x] **Step 8: Typecheck + commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add src/lib/pwa/service-worker.ts src/app/sw.js/route.ts src/lib/firebase/client-messaging.ts src/hooks/useOrderNotifications.ts .env.example
git commit -m "feat: register push tokens and handle FCM messages in service worker"
```

---

### Task 5: In-app notification bell

**Files:**
- Create: `src/components/NotificationsBell.tsx`
- Modify: `src/components/BusinessLayout.tsx`

**Interfaces:**
- Consumes: `useFirebaseAuth` (`user`), firestore client `collection/doc/onSnapshot/orderBy/limit/where` via `getFirebaseClient`, `useNavigate` from `react-router-dom`, `POST /api/private/notifications/read`.
- Produces: `NotificationsBell()` — renders a bell with unread badge and a dropdown listing the latest 20 notifications; clicking an item navigates to `/dashboard/orders/{orderId}` and marks it read.

- [x] **Step 1: Write the component**

Create `src/components/NotificationsBell.tsx` (uses the modular `firebase/firestore` API — `collection`, `query`, `onSnapshot`, `where`, `orderBy`, `limit` — matching `src/lib/firebase/public-query.ts`):

```tsx
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
import { useFirebaseAuth } from "@/lib/firebase/auth-context";

type NotificationItem = {
  id: string;
  orderId: string;
  orderNumber: string;
  message: string;
  createdAt: number;
  read: boolean;
};

export function NotificationsBell() {
  const { isSignedIn, user } = useFirebaseAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);

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
```

- [x] **Step 2: Mount the bell and the push hook in BusinessLayout**

In `src/components/BusinessLayout.tsx`:

- Add imports:
  ```tsx
  import { NotificationsBell } from "./NotificationsBell";
  import { useOrderNotifications } from "@/hooks/useOrderNotifications";
  ```
- Inside the component body:
  ```tsx
  useOrderNotifications();
  ```
- In the returned tree, inside the `max-w-[428px]` container (line ~78) add:
  ```tsx
        <NotificationsBell />
  ```

- [x] **Step 3: Render check + typecheck**

Run: `npm run typecheck`
Expected: no errors.

Verify in the running dev app (`npm run dev`, dashboard host `app.whatscart.in` equivalent local `http://localhost:3000/dashboard`): the bell renders top-right of the 428px column, badge shows unread count from the emulator, clicking marks read and navigates to the order detail page.

- [x] **Step 4: Run the existing dashboard tests**

Run: `npx vitest run src/components/__tests__/dashboard-order-flow.test.tsx src/components/__tests__/storefront-redesign.test.tsx`
Expected: PASS (BusinessLayout renders with the bell without breaking existing snapshots/assertions; fix any failing assertion by keeping the bell markup minimal).

- [x] **Step 5: Commit**

```bash
git add src/components/NotificationsBell.tsx src/components/BusinessLayout.tsx
git commit -m "feat: add in-app notification bell to dashboard"
```

---

## Self-Review Notes

- **Spec coverage:** push trigger (Task 2), token registration (Task 3 + Task 4), single-SW FCM (Task 4), bell (Task 5), rules (Task 3), env (Task 4), tests (all). Manual orders & WhatsApp fallback deliberately excluded per spec.
- **Consistency:** `notifyNewOrder(firestore, businessId, input, sendPush)` signature used identically in Task 1 impl and Task 2 route. `buildOrderNotification` shape `{ notification, data }` matches `PushMessage` consumed by `sendPushToOwner`. `useOrderNotifications` import in Task 5 matches Task 4 definition. The FCM gstatic version is pinned in Task 4 Step 1 before the SW block is written.
- **Known env dependency:** FCM token registration, permission prompt, and push delivery require a real Firebase project with `NEXT_PUBLIC_FIREBASE_VAPID_KEY` and a deployed `/sw.js`; emulator tests validate the Firestore doc/route behavior, not actual push delivery.

## Follow-up verification

- Known deviation acknowledged: FCM background handling is merged into the existing single `/sw.js`; no separate `firebase-messaging-sw.js` is registered because both would compete for root scope.
- Known deviation acknowledged: `useOptionalFirebaseAuth` keeps `BusinessLayout` and its bell safe in test or preview trees without an auth provider.
- Known env dependency acknowledged: real push verification requires the Firebase client and Admin variables in `.env.example`, plus a deployed `/sw.js`; no credentials are present locally.
