import { NextResponse, type NextRequest } from "next/server";

import { getAdminStorage } from "../../../../../lib/firebase/admin";

export async function POST(request: NextRequest) {
  const storage = getAdminStorage();
  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET ??
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!storage || !bucketName) {
    return NextResponse.json(
      { error: "Firebase Storage is not configured." },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as { storageId?: unknown };
    if (
      typeof body.storageId !== "string" ||
      !/^customer-uploads\/[0-9a-f-]{36}$/.test(body.storageId)
    ) {
      throw new Error("Storage ID is invalid.");
    }
    const [metadata] = await storage.bucket().file(body.storageId).getMetadata();
    const token = metadata.metadata?.firebaseStorageDownloadTokens;
    if (typeof token !== "string" || !token) {
      throw new Error("Upload does not have a download token.");
    }
    const emulatorHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
    const origin = emulatorHost
      ? `http://${emulatorHost}/v0`
      : "https://firebasestorage.googleapis.com/v0";
    const url = `${origin}/b/${encodeURIComponent(bucketName)}/o/${encodeURIComponent(body.storageId)}?alt=media&token=${encodeURIComponent(token)}`;
    return NextResponse.json({ url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload was not found." },
      { status: 400 },
    );
  }
}
