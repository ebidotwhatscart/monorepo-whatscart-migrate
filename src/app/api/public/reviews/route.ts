import { NextResponse, type NextRequest } from "next/server";

import {
  getAdminFirestore,
  getAdminStorage,
} from "@/lib/firebase/admin";
import {
  authorizeReviewUpload,
  getPublicReviewForm,
  registerReviewUpload,
  submitPublicReviews,
} from "@/lib/firebase/reviews";

const noStoreHeaders = {
  "cache-control": "no-cache, no-store, max-age=0, must-revalidate",
  "cdn-cache-control": "no-store",
  "vercel-cdn-cache-control": "no-store",
};

export async function GET(request: NextRequest) {
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json(
      { error: "Firebase Admin is not configured." },
      { status: 503, headers: noStoreHeaders },
    );
  }
  try {
    return NextResponse.json(
      await getPublicReviewForm(
        firestore,
        request.nextUrl.searchParams.get("token"),
      ),
      { headers: noStoreHeaders },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Review is invalid." },
      { status: 400, headers: noStoreHeaders },
    );
  }
}

export async function POST(request: NextRequest) {
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json(
      { error: "Firebase Admin is not configured." },
      { status: 503, headers: noStoreHeaders },
    );
  }
  try {
    const body = (await request.json()) as {
      args?: Record<string, unknown>;
      operation?: unknown;
    };
    if (!body.args || typeof body.operation !== "string") {
      throw new Error("Review operation is invalid.");
    }
    let result: unknown;
    if (body.operation === "reviews:generateReviewUploadUrl") {
      const token = await authorizeReviewUpload(firestore, body.args.token);
      const uploadUrl = new URL("/api/public/uploads", request.url);
      uploadUrl.searchParams.set("token", token);
      result = uploadUrl.toString();
    } else {
      const storage = getAdminStorage();
      const bucketName =
        process.env.FIREBASE_STORAGE_BUCKET ??
        process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
      if (!storage || !bucketName) {
        return NextResponse.json(
          { error: "Firebase Storage is not configured." },
          { status: 503, headers: noStoreHeaders },
        );
      }
      if (body.operation === "reviews:registerReviewUpload") {
        result = await registerReviewUpload(
          firestore,
          storage,
          bucketName,
          body.args,
        );
      } else if (body.operation === "reviews:submitReviews") {
        result = await submitPublicReviews(
          firestore,
          storage,
          bucketName,
          body.args,
        );
      } else {
        throw new Error("Review operation is invalid.");
      }
    }
    return NextResponse.json(result, { headers: noStoreHeaders });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Review operation failed.",
      },
      { status: 400, headers: noStoreHeaders },
    );
  }
}
