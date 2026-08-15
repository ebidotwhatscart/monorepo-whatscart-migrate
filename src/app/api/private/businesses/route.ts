import { NextResponse, type NextRequest } from "next/server";

import {
  getAdminFirestore,
  getAdminStorage,
} from "@/lib/firebase/admin";
import {
  createOwnedBusiness,
  updateOwnedBusiness,
} from "@/lib/firebase/private-business";
import {
  FirebaseRequestAuthError,
  verifyFirebaseRequest,
} from "@/lib/firebase/server-auth";

const noStoreHeaders = {
  "cache-control": "private, no-cache, no-store, max-age=0, must-revalidate",
  "cdn-cache-control": "no-store",
  "vercel-cdn-cache-control": "no-store",
};

export async function POST(request: NextRequest) {
  const firestore = getAdminFirestore();
  const storage = getAdminStorage();
  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET ??
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!firestore || !storage || !bucketName) {
    return NextResponse.json(
      { error: "Firebase Admin is not configured." },
      { status: 503, headers: noStoreHeaders },
    );
  }
  try {
    const identity = await verifyFirebaseRequest(request);
    const businessId = await createOwnedBusiness(
      firestore,
      storage,
      bucketName,
      identity.uid,
      await request.json(),
    );
    return NextResponse.json(businessId, { headers: noStoreHeaders });
  } catch (error) {
    const status =
      error instanceof FirebaseRequestAuthError ? error.status : 400;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Business is invalid." },
      { status, headers: noStoreHeaders },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const firestore = getAdminFirestore();
  const storage = getAdminStorage();
  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET ??
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!firestore || !storage || !bucketName) {
    return NextResponse.json(
      { error: "Firebase Admin is not configured." },
      { status: 503, headers: noStoreHeaders },
    );
  }
  try {
    const identity = await verifyFirebaseRequest(request);
    const result = await updateOwnedBusiness(
      firestore,
      storage,
      bucketName,
      identity.uid,
      identity.super_admin === true,
      await request.json(),
    );
    return NextResponse.json(result, { headers: noStoreHeaders });
  } catch (error) {
    const status =
      error instanceof FirebaseRequestAuthError ? error.status : 400;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Business is invalid." },
      { status, headers: noStoreHeaders },
    );
  }
}
