import { NextResponse, type NextRequest } from "next/server";

import { getAdminFirestore } from "@/lib/firebase/admin";
import { getOrdersForCustomer } from "@/lib/firebase/public-commerce";

const noStoreHeaders = {
  "cache-control": "private, no-cache, no-store, max-age=0, must-revalidate",
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
    const mobile = request.nextUrl.searchParams.get("mobile") ?? "";
    const orders = await getOrdersForCustomer(
      firestore,
      mobile,
      request.headers.get("x-customer-access-token"),
    );
    return NextResponse.json(orders, { headers: noStoreHeaders });
  } catch {
    return NextResponse.json([], { headers: noStoreHeaders });
  }
}
