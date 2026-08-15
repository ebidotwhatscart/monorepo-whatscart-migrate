import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { createUploadToken, userUploadPrefix } from "@/lib/firebase/upload-token";
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
  try {
    const identity = await verifyFirebaseRequest(request);
    const token = createUploadToken({
      expiresAt: Date.now() + 10 * 60 * 1000,
      path: `${userUploadPrefix(identity.uid)}/${randomUUID()}`,
      purpose: "business-asset",
    });
    const uploadUrl = new URL("/api/public/uploads", request.url);
    uploadUrl.searchParams.set("token", token);
    return NextResponse.json(
      { uploadUrl: uploadUrl.toString() },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    const status =
      error instanceof FirebaseRequestAuthError ? error.status : 503;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Uploads are unavailable." },
      { status, headers: noStoreHeaders },
    );
  }
}
