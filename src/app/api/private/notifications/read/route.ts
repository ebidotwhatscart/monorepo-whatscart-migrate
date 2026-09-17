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