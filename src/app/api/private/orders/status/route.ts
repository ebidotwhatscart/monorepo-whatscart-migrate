import { NextResponse, type NextRequest } from "next/server";

import { getAdminFirestore } from "@/lib/firebase/admin";
import { updateOwnedOrderStatus } from "@/lib/firebase/public-commerce";
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
      orderId?: unknown;
      status?: unknown;
    };
    if (typeof body.orderId !== "string" || typeof body.status !== "string") {
      throw new Error("Order update is invalid.");
    }
    return NextResponse.json(
      await updateOwnedOrderStatus(
        firestore,
        body.orderId,
        body.status,
        identity.uid,
        identity.super_admin === true,
      ),
      { headers: noStoreHeaders },
    );
  } catch (error) {
    const status =
      error instanceof FirebaseRequestAuthError ? error.status : 400;
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Order update is invalid.",
      },
      { status, headers: noStoreHeaders },
    );
  }
}
