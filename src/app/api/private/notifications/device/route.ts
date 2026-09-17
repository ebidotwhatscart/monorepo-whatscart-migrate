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