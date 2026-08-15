import { NextResponse, type NextRequest } from "next/server";

import {
  getAdminAuth,
  getAdminFirestore,
  getAdminStorage,
} from "@/lib/firebase/admin";
import {
  deleteUserAndOwnedDataBySuperAdmin,
  setBusinessEnabledBySuperAdmin,
} from "@/lib/firebase/super-admin";
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
  const auth = getAdminAuth();
  if (!firestore || !auth) {
    return NextResponse.json(
      { error: "Firebase Admin is not configured." },
      { status: 503, headers: noStoreHeaders },
    );
  }
  try {
    const identity = await verifyFirebaseRequest(request);
    if (identity.super_admin !== true) {
      return NextResponse.json(
        { error: "Super-admin access is required." },
        { status: 403, headers: noStoreHeaders },
      );
    }
    const body = (await request.json()) as {
      args?: unknown;
      operation?: unknown;
    };
    let result: unknown;
    if (body.operation === "superAdmin:setBusinessEnabled") {
      result = await setBusinessEnabledBySuperAdmin(firestore, body.args);
    } else if (
      body.operation === "adminDeletion:deleteUserAndOwnedDataByEmail"
    ) {
      const storage = getAdminStorage();
      if (!storage) {
        return NextResponse.json(
          { error: "Firebase Storage is not configured." },
          { status: 503, headers: noStoreHeaders },
        );
      }
      result = await deleteUserAndOwnedDataBySuperAdmin(
        firestore,
        storage,
        auth,
        identity.uid,
        body.args,
      );
    } else {
      throw new Error("Super-admin operation is invalid.");
    }
    return NextResponse.json(result, { headers: noStoreHeaders });
  } catch (error) {
    const status =
      error instanceof FirebaseRequestAuthError ? error.status : 400;
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Super-admin operation failed.",
      },
      { status, headers: noStoreHeaders },
    );
  }
}
