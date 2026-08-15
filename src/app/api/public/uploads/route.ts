import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { getAdminStorage } from "../../../../lib/firebase/admin";
import { verifyUploadToken } from "../../../../lib/firebase/upload-token";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_REVIEW_UPLOAD_BYTES = 5 * 1024 * 1024;
const REVIEW_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: NextRequest) {
  const storage = getAdminStorage();
  if (!storage) {
    return NextResponse.json(
      { error: "Firebase Storage is not configured." },
      { status: 503 },
    );
  }

  try {
    const token = request.nextUrl.searchParams.get("token");
    if (!token) throw new Error("Upload token is missing.");
    const { path, purpose } = verifyUploadToken(token);
    const contentType = request.headers.get("content-type") || "";
    const isImage = contentType.startsWith("image/");
    const isPdf = contentType === "application/pdf";
    if (purpose === "customer-image" && !isImage) {
      throw new Error("Only image uploads are supported.");
    }
    if (purpose === "review-image" && !REVIEW_IMAGE_TYPES.has(contentType)) {
      throw new Error("Review photos must be JPEG, PNG, or WebP images.");
    }
    if (purpose === "business-asset" && !isImage && !isPdf) {
      throw new Error("Only image and PDF business uploads are supported.");
    }
    const body = Buffer.from(await request.arrayBuffer());
    const maxUploadBytes =
      purpose === "review-image" ? MAX_REVIEW_UPLOAD_BYTES : MAX_UPLOAD_BYTES;
    if (!body.length || body.length > maxUploadBytes) {
      throw new Error(
        purpose === "review-image"
          ? "Review photo must be between 1 byte and 5 MB."
          : "Upload must be between 1 byte and 8 MB.",
      );
    }
    if (isPdf && !body.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
      throw new Error("PDF upload is invalid.");
    }

    const downloadToken = randomUUID();
    await storage.bucket().file(path).save(body, {
      resumable: false,
      metadata: {
        contentType,
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
        },
      },
    });
    return NextResponse.json({ storageId: path });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 400 },
    );
  }
}
