import { NextResponse, type NextRequest } from "next/server";

import { getAdminFirestore } from "@/lib/firebase/admin";
import { notifyNewOrder } from "@/lib/firebase/notifications";
import {
  accessTokenMatches,
  createPublicOrder,
  findPublicOrder,
  hydratedOrder,
} from "@/lib/firebase/public-commerce";
import { optionalFirebaseRequest } from "@/lib/firebase/server-auth";

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
    const rawBody = await request.json();
    const businessId =
      typeof rawBody === "object" && rawBody !== null && "businessId" in rawBody
        ? String(rawBody.businessId)
        : "";
    const result = await createPublicOrder(
      firestore,
      rawBody,
      request.headers.get("x-customer-access-token"),
    );
    if (businessId) {
      await notifyNewOrder(firestore, businessId, {
        orderId: result.order,
        orderNumber: result.orderId,
        totalAmount: result.totalAmount,
      }).catch((error) => {
        console.error("Failed to notify store owner:", error);
      });
    }
    return NextResponse.json(result, { headers: noStoreHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Order is invalid." },
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
  try {
    const orderId = request.nextUrl.searchParams.get("orderId") ?? "";
    const order = await findPublicOrder(firestore, orderId);
    if (!order) {
      return NextResponse.json(null, { status: 404, headers: noStoreHeaders });
    }
    const data = order.data()!;
    let allowed =
      accessTokenMatches(
        request.headers.get("x-order-access-token"),
        data.orderAccessHash,
      ) ||
      accessTokenMatches(
        request.headers.get("x-customer-access-token"),
        data.customerAccessHash,
      );

    if (!allowed) {
      const identity = await optionalFirebaseRequest(request);
      if (identity) {
        const business = await firestore
          .collection("businesses")
          .doc(String(data.businessId))
          .get();
        allowed = business.data()?.ownerId === identity.uid;
      }
    }
    if (!allowed) {
      return NextResponse.json(null, { status: 404, headers: noStoreHeaders });
    }
    return NextResponse.json(await hydratedOrder(firestore, order), {
      headers: noStoreHeaders,
    });
  } catch {
    return NextResponse.json(null, { status: 404, headers: noStoreHeaders });
  }
}
