/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as adminDeletion from "../adminDeletion.js";
import type * as adminDeletionInternal from "../adminDeletionInternal.js";
import type * as analytics from "../analytics.js";
import type * as auth from "../auth.js";
import type * as businessVariationOptions from "../businessVariationOptions.js";
import type * as businesses from "../businesses.js";
import type * as carts from "../carts.js";
import type * as catalogs from "../catalogs.js";
import type * as categories from "../categories.js";
import type * as http from "../http.js";
import type * as orders from "../orders.js";
import type * as productValidators from "../productValidators.js";
import type * as products from "../products.js";
import type * as reviews from "../reviews.js";
import type * as superAdmin from "../superAdmin.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  adminDeletion: typeof adminDeletion;
  adminDeletionInternal: typeof adminDeletionInternal;
  analytics: typeof analytics;
  auth: typeof auth;
  businessVariationOptions: typeof businessVariationOptions;
  businesses: typeof businesses;
  carts: typeof carts;
  catalogs: typeof catalogs;
  categories: typeof categories;
  http: typeof http;
  orders: typeof orders;
  productValidators: typeof productValidators;
  products: typeof products;
  reviews: typeof reviews;
  superAdmin: typeof superAdmin;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
