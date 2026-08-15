import { NextResponse, type NextRequest } from "next/server";

import { getAdminFirestore, getAdminStorage } from "@/lib/firebase/admin";
import { runPrivateInventoryMutation } from "@/lib/firebase/private-inventory";
import { runPrivateProductMutation } from "@/lib/firebase/private-products";
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
    const body = (await request.json()) as {
      args?: unknown;
      operation?: unknown;
    };
    if (typeof body.operation !== "string") {
      throw new Error("Inventory operation is invalid.");
    }
    const result = body.operation.startsWith("products:")
      ? await runPrivateProductMutation(
          firestore,
          storage,
          bucketName,
          body.operation,
          body.args,
          identity.uid,
          identity.super_admin === true,
        )
      : await runPrivateInventoryMutation(
          firestore,
          body.operation,
          body.args,
          identity.uid,
          identity.super_admin === true,
        );
    return NextResponse.json(result, { headers: noStoreHeaders });
  } catch (error) {
    const status =
      error instanceof FirebaseRequestAuthError ? error.status : 400;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Inventory operation failed." },
      { status, headers: noStoreHeaders },
    );
  }
}
