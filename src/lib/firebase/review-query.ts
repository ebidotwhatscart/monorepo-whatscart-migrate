"use client";

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  type Firestore,
  type Unsubscribe,
} from "firebase/firestore";

import { documentValue } from "./documents";

type QueryArgs = Record<string, unknown>;
type Emit = (value: unknown) => void;
type Fail = (error: Error) => void;

function requiredString(args: QueryArgs, key: string) {
  const value = args[key];
  if (typeof value !== "string" || !value) {
    throw new Error(`Firebase review argument ${key} is required.`);
  }
  return value;
}

function observeBusinessReviewRequestStates(
  firestore: Firestore,
  args: QueryArgs,
  emit: Emit,
  fail: Fail,
) {
  const businessId = requiredString(args, "businessId");
  return onSnapshot(
    query(
      collection(firestore, "reviewRequests"),
      where("businessId", "==", businessId),
    ),
    (snapshot) =>
      emit(
        snapshot.docs.map((request) => {
          const data = request.data();
          return {
            orderId: data.orderId,
            requestedAt: data.requestedAt,
            status: data.status,
            submittedAt: data.submittedAt,
          };
        }),
      ),
    fail,
  );
}

function observeOrderReviews(
  firestore: Firestore,
  args: QueryArgs,
  emit: Emit,
  fail: Fail,
) {
  const orderId = requiredString(args, "orderId");
  let reviewSubscription: Unsubscribe | null = null;
  let requestSubscription: Unsubscribe | null = null;
  let active = true;
  void getDoc(doc(firestore, "orders", orderId))
    .then((order) => {
      if (!active) return;
      if (!order.exists()) {
        emit({ request: null, reviews: [] });
        return;
      }
      const businessId = order.data().businessId;
      if (typeof businessId !== "string") {
        throw new Error("Order business is invalid.");
      }
      requestSubscription = onSnapshot(
        query(
          collection(firestore, "reviewRequests"),
          where("orderId", "==", orderId),
          where("businessId", "==", businessId),
        ),
        (snapshot) => {
      reviewSubscription?.();
      reviewSubscription = null;
      if (snapshot.size > 1) {
        fail(new Error("Review request data is inconsistent."));
        return;
      }
      if (snapshot.empty) {
        emit({ request: null, reviews: [] });
        return;
      }
      const request = snapshot.docs[0];
      const requestData = request.data();
      reviewSubscription = onSnapshot(
        query(
          collection(firestore, "productReviews"),
          where("reviewRequestId", "==", request.id),
          where("businessId", "==", businessId),
        ),
        (reviews) =>
          emit({
            request: {
              lastSentAt: requestData.lastSentAt,
              requestedAt: requestData.requestedAt,
              status: requestData.status,
              submittedAt: requestData.submittedAt,
            },
            reviews: reviews.docs.map((reviewSnapshot) => {
              const review = documentValue(reviewSnapshot);
              return {
                _id: review._id,
                comment: review.comment,
                customerName: review.customerName,
                imageUrls: Array.isArray(review.imageUrls)
                  ? review.imageUrls.filter(
                      (value): value is string => typeof value === "string",
                    )
                  : [],
                moderatedAt: review.moderatedAt,
                productId: review.productId,
                productName: review.productName,
                rating: review.rating,
                status: review.status,
                submittedAt: review.submittedAt,
              };
            }),
          }),
        fail,
      );
        },
        fail,
      );
    })
    .catch((error: unknown) => {
      if (active) fail(error instanceof Error ? error : new Error(String(error)));
    });
  return () => {
    active = false;
    reviewSubscription?.();
    requestSubscription?.();
  };
}

export function observeFirebaseReviewQuery(
  firestore: Firestore,
  functionName: string,
  args: QueryArgs,
  userId: string | null,
  emit: Emit,
  fail: Fail,
): Unsubscribe {
  if (!userId) {
    emit(undefined);
    return () => undefined;
  }
  switch (functionName) {
    case "reviews:getBusinessReviewRequestStates":
      return observeBusinessReviewRequestStates(firestore, args, emit, fail);
    case "reviews:getOrderReviews":
      return observeOrderReviews(firestore, args, emit, fail);
    default:
      fail(new Error(`Firebase review query is not implemented: ${functionName}`));
      return () => undefined;
  }
}
