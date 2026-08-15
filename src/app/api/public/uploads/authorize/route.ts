import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { createUploadToken } from "../../../../../lib/firebase/upload-token";

export async function POST(request: NextRequest) {
  try {
    const token = createUploadToken({
      expiresAt: Date.now() + 10 * 60 * 1000,
      path: `customer-uploads/${randomUUID()}`,
      purpose: "customer-image",
    });
    const uploadUrl = new URL("/api/public/uploads", request.url);
    uploadUrl.searchParams.set("token", token);
    return NextResponse.json({ uploadUrl: uploadUrl.toString() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Uploads are unavailable." },
      { status: 503 },
    );
  }
}
