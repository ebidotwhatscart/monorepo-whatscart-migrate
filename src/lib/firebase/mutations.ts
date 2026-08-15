"use client";

import {
  getOperationName,
  type OperationReference,
  type OperationReturnType,
} from "./operations";
import { useCallback } from "react";

import { getFirebaseClient } from "./client";
import {
  getCustomerAccessToken,
  getOrderAccessToken,
  storeOrderAccessToken,
} from "./customer-access";

type AnalyticsFunctionName =
  | "analytics:trackPageView"
  | "analytics:trackProductShare"
  | "analytics:trackProductView";

async function analyticsMutation(
  functionName: AnalyticsFunctionName,
  args: Record<string, unknown>,
) {
  const eventType = {
    "analytics:trackPageView": "page_view",
    "analytics:trackProductShare": "product_share",
    "analytics:trackProductView": "product_view",
  }[functionName];
  const response = await fetch("/api/public/analytics", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...args, type: eventType }),
    keepalive: true,
  });
  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(result?.error || "Unable to record analytics event.");
  }
  return null;
}

async function postJson<T>(
  url: string,
  body: Record<string, unknown> = {},
  headers: Record<string, string> = {},
  method: "PATCH" | "POST" = "POST",
) {
  const response = await fetch(url, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const responseText = await response.text();
  let result: (T & { error?: string }) | null = null;
  try {
    result = JSON.parse(responseText) as T & { error?: string };
  } catch {
    // The common error handling below keeps malformed responses out of callers.
  }
  if (!response.ok || (result === null && responseText.trim() !== "null")) {
    throw new Error(result?.error || "Firebase operation failed.");
  }
  return result as T;
}

async function firebaseAuthorizationHeader() {
  const user = getFirebaseClient()?.auth.currentUser;
  if (!user) throw new Error("Authentication is required.");
  return { authorization: `Bearer ${await user.getIdToken()}` };
}

export function useFirebaseMutation<
  Mutation extends OperationReference<"mutation">,
>(reference: Mutation) {
  const functionName = getOperationName(reference);
  return useCallback(
    async (
      args: Record<string, unknown> = {},
    ): Promise<OperationReturnType<Mutation>> => {
      switch (functionName) {
        case "analytics:trackPageView":
        case "analytics:trackProductShare":
        case "analytics:trackProductView":
          return (await analyticsMutation(
            functionName,
            args as Record<string, unknown>,
          )) as OperationReturnType<Mutation>;
        case "orders:generateCustomerUploadUrl": {
          const result = await postJson<{ uploadUrl: string }>(
            "/api/public/uploads/authorize",
          );
          return result.uploadUrl as OperationReturnType<Mutation>;
        }
        case "orders:resolveCustomerUploadUrl": {
          const result = await postJson<{ url: string }>(
            "/api/public/uploads/resolve",
            args,
          );
          return result.url as OperationReturnType<Mutation>;
        }
        case "orders:createOrder": {
          const customerAccessToken = getCustomerAccessToken();
          if (!customerAccessToken) throw new Error("Customer access is unavailable.");
          const result = await postJson<{
            accessToken: string;
            order: string;
            orderId: string;
          }>("/api/public/orders", args, {
            "x-customer-access-token": customerAccessToken,
          });
          storeOrderAccessToken(result.orderId, result.accessToken);
          return result as OperationReturnType<Mutation>;
        }
        case "carts:saveCart": {
          const cartId = typeof args.cartId === "string" ? args.cartId : "";
          const customerAccessToken = getCustomerAccessToken();
          const orderAccessToken = getOrderAccessToken(cartId);
          if (!customerAccessToken || !orderAccessToken) {
            throw new Error("Cart access is unavailable.");
          }
          return (await postJson<string>("/api/public/carts", args, {
            "x-customer-access-token": customerAccessToken,
            "x-order-access-token": orderAccessToken,
          })) as OperationReturnType<Mutation>;
        }
        case "orders:updateOrderStatus":
          return (await postJson(
            "/api/private/orders/status",
            args,
            await firebaseAuthorizationHeader(),
          )) as OperationReturnType<Mutation>;
        case "orders:createManualOrder":
        case "orders:setOrderBillingExclusion":
        case "orders:updateOrderNotes":
          return (await postJson(
            "/api/private/orders",
            { args, operation: functionName },
            await firebaseAuthorizationHeader(),
          )) as OperationReturnType<Mutation>;
        case "reviews:generateReviewUploadUrl":
        case "reviews:registerReviewUpload":
        case "reviews:submitReviews":
          return (await postJson(
            "/api/public/reviews",
            { args, operation: functionName },
          )) as OperationReturnType<Mutation>;
        case "reviews:createReviewRequest":
        case "reviews:moderateReview":
          return (await postJson(
            "/api/private/reviews",
            { args, operation: functionName },
            await firebaseAuthorizationHeader(),
          )) as OperationReturnType<Mutation>;
        case "superAdmin:setBusinessEnabled":
        case "adminDeletion:deleteUserAndOwnedDataByEmail":
          return (await postJson(
            "/api/private/super-admin",
            { args, operation: functionName },
            await firebaseAuthorizationHeader(),
          )) as OperationReturnType<Mutation>;
        case "auth:ensureUserExists": {
          const result = await postJson<{
            user: { _id: string };
          }>(
            "/api/auth/bootstrap",
            args,
            await firebaseAuthorizationHeader(),
          );
          return result.user._id as OperationReturnType<Mutation>;
        }
        case "businesses:generateUploadUrl": {
          const result = await postJson<{ uploadUrl: string }>(
            "/api/private/uploads/authorize",
            args,
            await firebaseAuthorizationHeader(),
          );
          return result.uploadUrl as OperationReturnType<Mutation>;
        }
        case "businesses:createBusiness":
          return (await postJson(
            "/api/private/businesses",
            args,
            await firebaseAuthorizationHeader(),
          )) as OperationReturnType<Mutation>;
        case "businesses:updateBusiness":
          return (await postJson(
            "/api/private/businesses",
            args,
            await firebaseAuthorizationHeader(),
            "PATCH",
          )) as OperationReturnType<Mutation>;
        case "categories:createCategory":
        case "categories:deleteCategory":
        case "categories:reorderCategories":
        case "catalogs:createCatalog":
        case "catalogs:updateCatalog":
        case "catalogs:deleteCatalog":
        case "businessVariationOptions:addCustomVariationType":
        case "businessVariationOptions:addCustomVariationValue":
        case "products:createProduct":
        case "products:updateProduct":
        case "products:deleteProduct":
          return (await postJson(
            "/api/private/inventory",
            { args, operation: functionName },
            await firebaseAuthorizationHeader(),
          )) as OperationReturnType<Mutation>;
        default:
          throw new Error(
            `Firebase mutation is not implemented: ${functionName}`,
          );
      }
    },
    [functionName],
  );
}

export function useFirebaseAction<
  Action extends OperationReference<"action">,
>(reference: Action) {
  return useFirebaseMutation(
    reference as unknown as OperationReference<"mutation">,
  ) as unknown as (
    args?: Record<string, unknown>,
  ) => Promise<OperationReturnType<Action>>;
}
