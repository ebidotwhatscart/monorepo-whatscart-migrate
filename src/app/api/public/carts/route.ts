import { NextResponse, type NextRequest } from "next/server";

import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  getPublicCart,
  savePublicCart,
} from "@/lib/firebase/public-commerce";

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
    const cartId = await savePublicCart(
      firestore,
      await request.json(),
      request.headers.get("x-customer-access-token"),
      request.headers.get("x-order-access-token"),
    );
    return NextResponse.json(cartId, { headers: noStoreHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cart is invalid." },
      { status: 400, headers: noStoreHeaders },
    );
  }
}

export async function GET(request: NextRequest) {
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json(
      { error: "Firebase Admin is not configured." },
      { status: 503, headers: noStoreHeaders },
    );
  }
  const cart = await getPublicCart(
    firestore,
    request.nextUrl.searchParams.get("cartId") ?? "",
    request.headers.get("x-customer-access-token"),
    request.headers.get("x-order-access-token"),
  );
  return NextResponse.json(cart, {
    status: cart ? 200 : 404,
    headers: noStoreHeaders,
  });
}
