import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { DocumentData, Firestore } from "firebase-admin/firestore";
import type { Storage } from "firebase-admin/storage";

import { assertOwnedBusiness } from "./private-inventory";
import { createUploadToken } from "./upload-token";

type UnknownRecord = Record<string, unknown>;

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const REVIEW_STATUSES = new Set(["approved", "pending", "rejected"]);
const ELIGIBLE_ORDER_STATUSES = new Set([
  "confirmed",
  "paid",
  "unpaid",
  "preparing",
  "ready",
  "delivered",
]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES_PER_REVIEW = 4;
const MAX_PRODUCTS_PER_REQUEST = 20;
const MAX_REVIEW_LENGTH = 500;
const MAX_UPLOADS_PER_REQUEST = MAX_PRODUCTS_PER_REQUEST * MAX_IMAGES_PER_REVIEW;

function requiredString(value: unknown, field: string, maxLength: number) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.trim().length > maxLength
  ) {
    throw new Error(`${field} is invalid.`);
  }
  return value.trim();
}

function validToken(value: unknown) {
  const token = requiredString(value, "token", 200);
  if (token.length < 32) throw new Error("Review token is invalid.");
  return token;
}

async function requestByToken(firestore: Firestore, rawToken: unknown) {
  const token = validToken(rawToken);
  const snapshot = await firestore
    .collection("reviewRequests")
    .where("token", "==", token)
    .limit(2)
    .get();
  if (snapshot.size > 1) throw new Error("Review token is invalid.");
  return snapshot.empty ? null : snapshot.docs[0];
}

function imagePathDocumentId(storageId: string) {
  return createHash("sha256").update(storageId).digest("hex");
}

async function reviewImageUrl(
  storage: Storage,
  bucketName: string,
  storageId: string,
) {
  const [metadata] = await storage.bucket().file(storageId).getMetadata();
  if (
    !metadata.contentType ||
    !ALLOWED_IMAGE_TYPES.has(metadata.contentType) ||
    Number(metadata.size ?? 0) > MAX_IMAGE_BYTES
  ) {
    throw new Error("Photos must be images no larger than 5 MB.");
  }
  const token = metadata.metadata?.firebaseStorageDownloadTokens;
  if (typeof token !== "string" || !token) {
    throw new Error("Review photo is invalid.");
  }
  const emulatorHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  const origin = emulatorHost
    ? `http://${emulatorHost}/v0`
    : "https://firebasestorage.googleapis.com/v0";
  return `${origin}/b/${encodeURIComponent(bucketName)}/o/${encodeURIComponent(storageId)}?alt=media&token=${encodeURIComponent(token)}`;
}

export async function createOwnedReviewRequest(
  firestore: Firestore,
  userId: string,
  isSuperAdmin: boolean,
  rawBody: unknown,
) {
  if (!rawBody || typeof rawBody !== "object") {
    throw new Error("Review request is invalid.");
  }
  const body = rawBody as UnknownRecord;
  const orderId = requiredString(body.orderId, "orderId", 300);
  const order = await firestore.collection("orders").doc(orderId).get();
  const orderData = order.data();
  if (!order.exists || !orderData) throw new Error("Order not found.");
  await assertOwnedBusiness(
    firestore,
    requiredString(orderData.businessId, "businessId", 300),
    userId,
    isSuperAdmin,
  );
  if (!ELIGIBLE_ORDER_STATUSES.has(String(orderData.status ?? ""))) {
    throw new Error("Confirm the order before requesting feedback.");
  }

  const existing = await firestore
    .collection("reviewRequests")
    .where("orderId", "==", order.id)
    .limit(2)
    .get();
  if (existing.size > 1) throw new Error("Review request data is inconsistent.");
  if (!existing.empty) {
    const request = existing.docs[0];
    const requestData = request.data();
    const lastSentAt = Date.now();
    if (requestData.status === "open") {
      await request.ref.update({ lastSentAt });
    }
    return {
      lastSentAt:
        requestData.status === "open" ? lastSentAt : requestData.lastSentAt,
      productCount: Array.isArray(requestData.products)
        ? requestData.products.length
        : 0,
      status: requestData.status,
      token: requestData.token,
    };
  }

  const uniqueProductIds = [
    ...new Set(
      (Array.isArray(orderData.items) ? orderData.items : [])
        .map((item: UnknownRecord) => item.productId)
        .filter((value): value is string => typeof value === "string"),
    ),
  ];
  const productSnapshots = await Promise.all(
    uniqueProductIds.map((productId) =>
      firestore.collection("products").doc(productId).get(),
    ),
  );
  const products = productSnapshots
    .filter(
      (product) =>
        product.exists && product.data()?.businessId === orderData.businessId,
    )
    .map((product) => {
      const data = product.data()!;
      const imageUrls = Array.isArray(data.imageUrls) ? data.imageUrls : [];
      const imageId =
        Array.isArray(data.imageIds) && typeof data.imageIds[0] === "string"
          ? data.imageIds[0]
          : null;
      return {
        ...(imageId ? { imageId } : {}),
        imageUrl: typeof imageUrls[0] === "string" ? imageUrls[0] : null,
        name: requiredString(data.name, "product name", 300),
        productId: product.id,
      };
    });
  if (!products.length) {
    throw new Error("This order has no products that can be reviewed.");
  }
  if (products.length > MAX_PRODUCTS_PER_REQUEST) {
    throw new Error(
      `Feedback can be requested for up to ${MAX_PRODUCTS_PER_REQUEST} distinct products per order.`,
    );
  }

  const now = Date.now();
  const token = randomBytes(32).toString("hex");
  await firestore.collection("reviewRequests").add({
    businessId: orderData.businessId,
    lastSentAt: now,
    orderId: order.id,
    products,
    requestedAt: now,
    status: "open",
    token,
    uploadUrlsIssued: 0,
  });
  return {
    lastSentAt: now,
    productCount: products.length,
    status: "open",
    token,
  };
}

export async function getPublicReviewForm(
  firestore: Firestore,
  rawToken: unknown,
) {
  const request = await requestByToken(firestore, rawToken);
  if (!request) return null;
  const requestData = request.data();
  const [order, business] = await Promise.all([
    firestore.collection("orders").doc(String(requestData.orderId)).get(),
    firestore
      .collection("businesses")
      .doc(String(requestData.businessId))
      .get(),
  ]);
  if (!order.exists || !business.exists) return null;
  const orderData = order.data()!;
  const businessData = business.data()!;
  return {
    business: {
      logoUrl:
        typeof businessData.logoUrl === "string" ? businessData.logoUrl : null,
      name: requiredString(businessData.name, "business name", 300),
      slug: requiredString(businessData.slug, "business slug", 300),
      themeColor: requiredString(
        businessData.themeColor,
        "theme color",
        30,
      ),
    },
    customerName: requiredString(orderData.customerName, "customerName", 200),
    orderNumber: requiredString(orderData.orderId, "orderId", 300),
    products: (Array.isArray(requestData.products)
      ? requestData.products
      : []
    ).map((product: UnknownRecord) => ({
      imageUrl: typeof product.imageUrl === "string" ? product.imageUrl : null,
      name: requiredString(product.name, "product name", 300),
      productId: requiredString(product.productId, "productId", 300),
    })),
    status: requestData.status,
  };
}

export async function authorizeReviewUpload(
  firestore: Firestore,
  rawToken: unknown,
) {
  const request = await requestByToken(firestore, rawToken);
  if (!request || request.data().status !== "open") {
    throw new Error("This review link is invalid or has already been used.");
  }
  await firestore.runTransaction(async (transaction) => {
    const current = await transaction.get(request.ref);
    const issued = Number(current.data()?.uploadUrlsIssued ?? 0);
    if (!current.exists || current.data()?.status !== "open") {
      throw new Error("This review link is invalid or has already been used.");
    }
    if (issued >= MAX_UPLOADS_PER_REQUEST) {
      throw new Error("The upload limit for this review has been reached.");
    }
    transaction.update(request.ref, { uploadUrlsIssued: issued + 1 });
  });
  return createUploadToken({
    expiresAt: Date.now() + 10 * 60 * 1_000,
    path: `review-uploads/${request.id}/${randomUUID()}`,
    purpose: "review-image",
  });
}

export async function registerReviewUpload(
  firestore: Firestore,
  storage: Storage,
  bucketName: string,
  rawBody: unknown,
) {
  if (!rawBody || typeof rawBody !== "object") {
    throw new Error("Review upload is invalid.");
  }
  const body = rawBody as UnknownRecord;
  const request = await requestByToken(firestore, body.token);
  if (!request || request.data().status !== "open") {
    throw new Error("This review link is invalid or has already been used.");
  }
  const storageId = requiredString(body.storageId, "storageId", 500);
  if (!storageId.startsWith(`review-uploads/${request.id}/`)) {
    throw new Error("This upload does not belong to this review.");
  }
  await reviewImageUrl(storage, bucketName, storageId);
  const uploadRef = firestore
    .collection("reviewUploads")
    .doc(imagePathDocumentId(storageId));
  await firestore.runTransaction(async (transaction) => {
    const [currentRequest, existing, uploads] = await Promise.all([
      transaction.get(request.ref),
      transaction.get(uploadRef),
      transaction.get(
        firestore
          .collection("reviewUploads")
          .where("reviewRequestId", "==", request.id),
      ),
    ]);
    if (!currentRequest.exists || currentRequest.data()?.status !== "open") {
      throw new Error("This review link is invalid or has already been used.");
    }
    if (existing.exists) {
      if (existing.data()?.reviewRequestId !== request.id) {
        throw new Error("This upload does not belong to this review.");
      }
      return;
    }
    if (uploads.size >= MAX_UPLOADS_PER_REQUEST) {
      throw new Error("The upload limit for this review has been reached.");
    }
    transaction.create(uploadRef, {
      createdAt: Date.now(),
      reviewRequestId: request.id,
      storageId,
    });
  });
  return null;
}

export async function submitPublicReviews(
  firestore: Firestore,
  storage: Storage,
  bucketName: string,
  rawBody: unknown,
) {
  if (!rawBody || typeof rawBody !== "object") {
    throw new Error("Reviews are invalid.");
  }
  const body = rawBody as UnknownRecord;
  const request = await requestByToken(firestore, body.token);
  if (!request || request.data().status !== "open") {
    throw new Error("This review link is invalid or has already been used.");
  }
  const requestData = request.data();
  const products = Array.isArray(requestData.products)
    ? (requestData.products as UnknownRecord[])
    : [];
  if (!Array.isArray(body.reviews) || body.reviews.length !== products.length) {
    throw new Error("Please review every product in the order.");
  }
  const expectedProducts = new Map(
    products.map((product) => [String(product.productId), product]),
  );
  const submittedProductIds = new Set<string>();
  const preparedReviews = await Promise.all(
    (body.reviews as UnknownRecord[]).map(async (review) => {
      const productId = requiredString(review.productId, "productId", 300);
      const product = expectedProducts.get(productId);
      if (!product || submittedProductIds.has(productId)) {
        throw new Error("The submitted products do not match this order.");
      }
      submittedProductIds.add(productId);
      const rating = review.rating;
      if (
        typeof rating !== "number" ||
        !Number.isInteger(rating) ||
        rating < 1 ||
        rating > 5
      ) {
        throw new Error(`Choose a rating from 1 to 5 for ${product.name}.`);
      }
      const comment =
        typeof review.comment === "string" ? review.comment.trim() : "";
      if (comment.length > MAX_REVIEW_LENGTH) {
        throw new Error(
          `Keep the optional review within ${MAX_REVIEW_LENGTH} characters for ${product.name}.`,
        );
      }
      if (
        !Array.isArray(review.imageIds) ||
        review.imageIds.length > MAX_IMAGES_PER_REVIEW
      ) {
        throw new Error(
          `Add no more than ${MAX_IMAGES_PER_REVIEW} different photos per product.`,
        );
      }
      const imageIds = review.imageIds.map((imageId) =>
        requiredString(imageId, "imageId", 500),
      );
      if (new Set(imageIds).size !== imageIds.length) {
        throw new Error(
          `Add no more than ${MAX_IMAGES_PER_REVIEW} different photos per product.`,
        );
      }
      const imageUrls = await Promise.all(
        imageIds.map(async (imageId) => {
          if (!imageId.startsWith(`review-uploads/${request.id}/`)) {
            throw new Error("One or more photos do not belong to this review.");
          }
          const registered = await firestore
            .collection("reviewUploads")
            .doc(imagePathDocumentId(imageId))
            .get();
          if (
            !registered.exists ||
            registered.data()?.reviewRequestId !== request.id
          ) {
            throw new Error("One or more photos do not belong to this review.");
          }
          return reviewImageUrl(storage, bucketName, imageId);
        }),
      );
      return {
        comment,
        imageIds,
        imageUrls,
        productId,
        productName: requiredString(product.name, "product name", 300),
        rating,
      };
    }),
  );

  const order = await firestore
    .collection("orders")
    .doc(String(requestData.orderId))
    .get();
  if (!order.exists || order.data()?.businessId !== requestData.businessId) {
    throw new Error("The order for this review is no longer available.");
  }
  const now = Date.now();
  await firestore.runTransaction(async (transaction) => {
    const [currentRequest, existing] = await Promise.all([
      transaction.get(request.ref),
      transaction.get(
        firestore
          .collection("productReviews")
          .where("reviewRequestId", "==", request.id)
          .limit(products.length + 1),
      ),
    ]);
    if (!currentRequest.exists || currentRequest.data()?.status !== "open") {
      throw new Error("This review link is invalid or has already been used.");
    }
    if (!existing.empty) {
      throw new Error("Feedback has already been submitted for this order.");
    }
    preparedReviews.forEach((review) => {
      transaction.create(firestore.collection("productReviews").doc(), {
        ...review,
        businessId: requestData.businessId,
        customerName: order.data()!.customerName,
        orderId: requestData.orderId,
        reviewRequestId: request.id,
        status: "pending",
        submittedAt: now,
      });
    });
    transaction.update(request.ref, { status: "submitted", submittedAt: now });
  });
  return { reviewCount: preparedReviews.length, submittedAt: now };
}

export async function moderateOwnedReview(
  firestore: Firestore,
  userId: string,
  isSuperAdmin: boolean,
  rawBody: unknown,
) {
  if (!rawBody || typeof rawBody !== "object") {
    throw new Error("Review update is invalid.");
  }
  const body = rawBody as UnknownRecord;
  const reviewId = requiredString(body.reviewId, "reviewId", 300);
  const status = requiredString(body.status, "status", 30);
  if (!REVIEW_STATUSES.has(status)) throw new Error("Review status is invalid.");
  const reviewRef = firestore.collection("productReviews").doc(reviewId);
  const review = await reviewRef.get();
  if (!review.exists) throw new Error("Review not found.");
  await assertOwnedBusiness(
    firestore,
    requiredString(review.data()?.businessId, "businessId", 300),
    userId,
    isSuperAdmin,
  );

  await firestore.runTransaction(async (transaction) => {
    const current = await transaction.get(reviewRef);
    const currentData = current.data();
    if (!current.exists || !currentData) throw new Error("Review not found.");
    if (currentData.status === status) return;
    const statsQuery = firestore
      .collection("productReviewStats")
      .where("productId", "==", currentData.productId)
      .limit(2);
    const stats = await transaction.get(statsQuery);
    if (stats.size > 1) throw new Error("Review totals are inconsistent.");
    const statsRef = stats.empty
      ? firestore.collection("productReviewStats").doc(String(currentData.productId))
      : stats.docs[0].ref;
    const existing = stats.empty
      ? {
          approvedCount: 0,
          ratingSum: 0,
          ratings1: 0,
          ratings2: 0,
          ratings3: 0,
          ratings4: 0,
          ratings5: 0,
        }
      : stats.docs[0].data();
    const oldDelta = currentData.status === "approved" ? -1 : 0;
    const newDelta = status === "approved" ? 1 : 0;
    const delta = oldDelta + newDelta;
    if (delta !== 0) {
      const rating = Number(currentData.rating);
      const ratingField = `ratings${rating}`;
      const next = {
        approvedCount: Number(existing.approvedCount ?? 0) + delta,
        ratingSum: Number(existing.ratingSum ?? 0) + rating * delta,
        [ratingField]: Number(existing[ratingField] ?? 0) + delta,
      };
      if (
        next.approvedCount < 0 ||
        next.ratingSum < 0 ||
        next[ratingField] < 0
      ) {
        throw new Error("Review totals are inconsistent.");
      }
      transaction.set(
        statsRef,
        {
          ...existing,
          ...next,
          businessId: currentData.businessId,
          productId: currentData.productId,
          updatedAt: Date.now(),
        },
        { merge: true },
      );
    }
    transaction.update(reviewRef, {
      moderatedAt: Date.now(),
      moderatedBy: userId,
      status,
    });
  });
  return { status };
}
