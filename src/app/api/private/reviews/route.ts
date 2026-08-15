import { NextResponse, type NextRequest } from "next/server";

import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  createOwnedReviewRequest,
  moderateOwnedReview,
} from "@/lib/firebase/reviews";
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
  if (!firestore) {
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
    const isSuperAdmin = identity.super_admin === true;
    let result: unknown;
    if (body.operation === "reviews:createReviewRequest") {
      result = await createOwnedReviewRequest(
        firestore,
        identity.uid,
        isSuperAdmin,
        body.args,
      );
    } else if (body.operation === "reviews:moderateReview") {
      result = await moderateOwnedReview(
        firestore,
        identity.uid,
        isSuperAdmin,
        body.args,
      );
    } else {
      throw new Error("Review operation is invalid.");
    }
    return NextResponse.json(result, { headers: noStoreHeaders });
  } catch (error) {
    const status =
      error instanceof FirebaseRequestAuthError ? error.status : 400;
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Review operation failed.",
      },
      { status, headers: noStoreHeaders },
    );
  }
}
