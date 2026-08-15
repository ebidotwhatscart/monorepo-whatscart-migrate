import { NextResponse, type NextRequest } from "next/server";

import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  createOwnedManualOrder,
  setOwnedOrderBillingExclusion,
  updateOwnedOrderNotes,
} from "@/lib/firebase/private-orders";
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
    if (typeof body.operation !== "string") {
      throw new Error("Order operation is invalid.");
    }
    const isSuperAdmin = identity.super_admin === true;
    let result: unknown;
    switch (body.operation) {
      case "orders:createManualOrder":
        result = await createOwnedManualOrder(
          firestore,
          identity.uid,
          isSuperAdmin,
          body.args,
        );
        break;
      case "orders:setOrderBillingExclusion":
        result = await setOwnedOrderBillingExclusion(
          firestore,
          identity.uid,
          isSuperAdmin,
          body.args,
        );
        break;
      case "orders:updateOrderNotes":
        result = await updateOwnedOrderNotes(
          firestore,
          identity.uid,
          isSuperAdmin,
          body.args,
        );
        break;
      default:
        throw new Error("Order operation is invalid.");
    }
    return NextResponse.json(result, { headers: noStoreHeaders });
  } catch (error) {
    const status =
      error instanceof FirebaseRequestAuthError ? error.status : 400;
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Order operation failed.",
      },
      { status, headers: noStoreHeaders },
    );
  }
}
