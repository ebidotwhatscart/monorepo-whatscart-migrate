import { NextResponse, type NextRequest } from "next/server";

import { getAdminFirestore } from "../../../../lib/firebase/admin";

type AnalyticsEventType = "page_view" | "product_share" | "product_view";

type AnalyticsBody = {
  businessId?: unknown;
  channel?: unknown;
  pageUrl?: unknown;
  productId?: unknown;
  referrer?: unknown;
  sessionId?: unknown;
  type?: unknown;
  utmCampaign?: unknown;
  utmMedium?: unknown;
  utmSource?: unknown;
};

function boundedString(
  value: unknown,
  field: string,
  maxLength: number,
  required = false,
) {
  if (value === undefined || value === null || value === "") {
    if (required) throw new Error(`${field} is required.`);
    return undefined;
  }
  if (typeof value !== "string" || value.length > maxLength) {
    throw new Error(`${field} is invalid.`);
  }
  return value;
}

export async function POST(request: NextRequest) {
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json(
      { error: "Firebase Admin is not configured." },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as AnalyticsBody;
    const type = body.type as AnalyticsEventType;
    if (!(["page_view", "product_share", "product_view"] as const).includes(type)) {
      throw new Error("Analytics event type is invalid.");
    }

    const businessId = boundedString(body.businessId, "businessId", 160, true)!;
    const sessionId = boundedString(body.sessionId, "sessionId", 160, true)!;
    const productId = boundedString(body.productId, "productId", 160);
    const [business, product] = await Promise.all([
      firestore.collection("businesses").doc(businessId).get(),
      productId
        ? firestore.collection("products").doc(productId).get()
        : Promise.resolve(null),
    ]);

    if (!business.exists || business.data()?.isEnabled === false) {
      return NextResponse.json({ ok: true });
    }
    if (
      type !== "page_view" &&
      (!product?.exists || product.data()?.businessId !== businessId)
    ) {
      return NextResponse.json({ ok: true });
    }

    const timestamp = Date.now();
    const attribution = Object.fromEntries(
      Object.entries({
        utmCampaign: boundedString(body.utmCampaign, "utmCampaign", 256),
        utmMedium: boundedString(body.utmMedium, "utmMedium", 256),
        utmSource: boundedString(body.utmSource, "utmSource", 256),
      }).filter(([, value]) => value !== undefined),
    );

    if (type === "page_view") {
      await firestore.collection("pageViews").add({
        businessId,
        pageUrl: boundedString(body.pageUrl, "pageUrl", 2_048) || "/",
        referrer: boundedString(body.referrer, "referrer", 2_048) || "",
        sessionId,
        timestamp,
        ...attribution,
      });
    } else if (type === "product_view") {
      const batch = firestore.batch();
      batch.create(firestore.collection("productViews").doc(), {
        businessId,
        productId,
        sessionId,
        timestamp,
      });
      batch.create(firestore.collection("pageViews").doc(), {
        businessId,
        pageUrl: `/product/${productId}`,
        referrer: "",
        sessionId,
        timestamp,
        ...attribution,
      });
      await batch.commit();
    } else {
      await firestore.collection("productShares").add({
        businessId,
        channel: boundedString(body.channel, "channel", 80, true),
        productId,
        sessionId,
        timestamp,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid analytics event." },
      { status: 400 },
    );
  }
}
