import { NextResponse, type NextRequest } from "next/server";

import { getAdminFirestore } from "@/lib/firebase/admin";
import { businessSlugAvailable } from "@/lib/firebase/private-business";
import {
  FirebaseRequestAuthError,
  verifyFirebaseRequest,
} from "@/lib/firebase/server-auth";

const noStoreHeaders = {
  "cache-control": "private, no-cache, no-store, max-age=0, must-revalidate",
  "cdn-cache-control": "no-store",
  "vercel-cdn-cache-control": "no-store",
};

export async function GET(request: NextRequest) {
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json(false, { status: 503, headers: noStoreHeaders });
  }
  try {
    await verifyFirebaseRequest(request);
    return NextResponse.json(
      await businessSlugAvailable(
        firestore,
        request.nextUrl.searchParams.get("slug"),
      ),
      { headers: noStoreHeaders },
    );
  } catch (error) {
    const status =
      error instanceof FirebaseRequestAuthError ? error.status : 400;
    return NextResponse.json(false, { status, headers: noStoreHeaders });
  }
}
