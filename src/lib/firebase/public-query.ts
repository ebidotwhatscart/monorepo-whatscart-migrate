"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as firestoreLimit,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
  type DocumentSnapshot,
  type Firestore,
  type QuerySnapshot,
  type Unsubscribe,
} from "firebase/firestore";

import { getFirebaseClient } from "./client";
import { observeFirebaseAnalyticsQuery } from "./analytics-query";
import { observeFirebaseReviewQuery } from "./review-query";
import { observeFirebaseSuperAdminQuery } from "./super-admin-query";
import {
  getCustomerAccessToken,
  getOrderAccessToken,
} from "./customer-access";
import {
  businessValue,
  documentValue,
  hydrateProduct,
  publicProductSlug,
  type FirebaseDocument,
} from "./documents";
import { BUSINESS_TYPE_CONFIG } from "../../components/products/businessTypeConfig";
import {
  normalizeBusinessType,
  type StoredBusinessType,
} from "../../types/product";

type QueryArgs = Record<string, unknown>;
type Emit = (value: unknown) => void;
type Fail = (error: Error) => void;

function requiredString(args: QueryArgs, key: string) {
  const value = args[key];
  if (typeof value !== "string" || !value) {
    throw new Error(`Firebase query argument ${key} is required.`);
  }
  return value;
}

function latestAsync<T>(emit: Emit, fail: Fail) {
  let revision = 0;
  return (work: () => Promise<T>) => {
    const current = ++revision;
    void work()
      .then((value) => {
        if (current === revision) emit(value);
      })
      .catch((error: unknown) => {
        if (current === revision) {
          fail(error instanceof Error ? error : new Error(String(error)));
        }
      });
  };
}

async function categoryMap(firestore: Firestore, businessId: string) {
  const snapshots = await getDocs(
    query(
      collection(firestore, "categories"),
      where("businessId", "==", businessId),
    ),
  );
  return new Map(
    snapshots.docs.map((snapshot) => [snapshot.id, documentValue(snapshot)]),
  );
}

async function hydrateProducts(
  firestore: Firestore,
  snapshots: QuerySnapshot<DocumentData> | DocumentSnapshot<DocumentData>[],
  businessId: string,
) {
  const categories = await categoryMap(firestore, businessId);
  const documents = Array.isArray(snapshots) ? snapshots : snapshots.docs;
  return Promise.all(
    documents.map((snapshot) => hydrateProduct(firestore, snapshot, categories)),
  );
}

function observeBusinessBySlug(
  firestore: Firestore,
  args: QueryArgs,
  emit: Emit,
  fail: Fail,
) {
  const slug = requiredString(args, "slug");
  return onSnapshot(
    query(
      collection(firestore, "businesses"),
      where("slug", "==", slug),
      where("isEnabled", "==", true),
      firestoreLimit(1),
    ),
    (snapshot) => emit(snapshot.empty ? null : businessValue(snapshot.docs[0])),
    fail,
  );
}

function observeUserBusiness(
  firestore: Firestore,
  userId: string | null,
  emit: Emit,
  fail: Fail,
) {
  if (!userId) {
    emit(null);
    return () => undefined;
  }
  return onSnapshot(
    query(
      collection(firestore, "businesses"),
      where("ownerId", "==", userId),
      firestoreLimit(1),
    ),
    (snapshot) =>
      emit(snapshot.empty ? null : businessValue(snapshot.docs[0])),
    fail,
  );
}

function observeBusinessOrders(
  firestore: Firestore,
  args: QueryArgs,
  userId: string | null,
  emit: Emit,
  fail: Fail,
) {
  if (!userId) {
    emit(undefined);
    return () => undefined;
  }
  const businessId = requiredString(args, "businessId");
  const status =
    typeof args.status === "string" && args.status ? args.status : null;
  const ordersQuery = status
    ? query(
        collection(firestore, "orders"),
        where("businessId", "==", businessId),
        where("status", "==", status),
      )
    : query(
        collection(firestore, "orders"),
        where("businessId", "==", businessId),
      );
  return onSnapshot(
    ordersQuery,
    (snapshot) =>
      emit(
        snapshot.docs
          .map(documentValue)
          .sort((left, right) => right._creationTime - left._creationTime),
      ),
    fail,
  );
}

function observeBusinessOrderDetail(
  firestore: Firestore,
  args: QueryArgs,
  userId: string | null,
  emit: Emit,
  fail: Fail,
) {
  if (!userId) {
    emit(undefined);
    return () => undefined;
  }
  const orderId = requiredString(args, "orderId");
  const run = latestAsync(emit, fail);
  return onSnapshot(
    doc(firestore, "orders", orderId),
    (snapshot) => {
      if (!snapshot.exists()) {
        emit(null);
        return;
      }
      run(async () => {
        const order = documentValue(snapshot);
        const businessId =
          typeof order.businessId === "string" ? order.businessId : "";
        if (!businessId) throw new Error("Order business is invalid.");
        const businessSnapshot = await getDoc(
          doc(firestore, "businesses", businessId),
        );
        const items = Array.isArray(order.items) ? order.items : [];
        const itemsDetailed = await Promise.all(
          items.map(async (rawItem) => {
            const item =
              rawItem && typeof rawItem === "object"
                ? (rawItem as Record<string, unknown>)
                : {};
            const productId =
              typeof item.productId === "string" ? item.productId : null;
            if (!productId) return { ...item, product: null };
            const productSnapshot = await getDoc(
              doc(firestore, "products", productId),
            );
            return {
              ...item,
              product: productSnapshot.exists()
                ? await hydrateProduct(firestore, productSnapshot)
                : null,
            };
          }),
        );
        return {
          ...order,
          business: businessSnapshot.exists()
            ? businessValue(businessSnapshot)
            : null,
          itemsDetailed,
        };
      });
    },
    fail,
  );
}

function observeBusinessOrderStats(
  firestore: Firestore,
  args: QueryArgs,
  userId: string | null,
  emit: Emit,
  fail: Fail,
) {
  if (!userId) {
    emit(undefined);
    return () => undefined;
  }
  const businessId = requiredString(args, "businessId");
  return onSnapshot(
    query(
      collection(firestore, "orders"),
      where("businessId", "==", businessId),
    ),
    (snapshot) => {
      const stats: Record<string, number> = {
        cancelled: 0,
        confirmed: 0,
        delivered: 0,
        pending: 0,
        preparing: 0,
        ready: 0,
        total: snapshot.size,
        totalRevenue: 0,
        promotionSales: 0,
        totalCouponsUsed: 0,
        totalDiscountAmount: 0,
      };
      snapshot.docs.forEach((orderSnapshot) => {
        const order = orderSnapshot.data();
        if (typeof order.status === "string" && order.status in stats) {
          stats[order.status] += 1;
        }
        if (
          order.status !== "cancelled" &&
          order.excludedFromBilling !== true &&
          typeof order.totalAmount === "number"
        ) {
          stats.totalRevenue += order.totalAmount;
          
          const hasDiscount =
            (typeof order.discountAmount === "number" && order.discountAmount > 0) ||
            Boolean(order.couponCode) ||
            Boolean(order.promotionId);
          
          if (hasDiscount) {
            stats.promotionSales += order.totalAmount;
            stats.totalCouponsUsed += 1;
            if (typeof order.discountAmount === "number") {
              stats.totalDiscountAmount += order.discountAmount;
            }
          }
        }
      });
      emit(stats);
    },
    fail,
  );
}

function observeLoggedInUser(
  firestore: Firestore,
  userId: string | null,
  emit: Emit,
  fail: Fail,
) {
  if (!userId) {
    emit(null);
    return () => undefined;
  }
  return onSnapshot(
    doc(firestore, "users", userId),
    (snapshot) => emit(snapshot.exists() ? documentValue(snapshot) : null),
    fail,
  );
}

function observeHttpJson(
  url: string,
  headers: () => HeadersInit | Promise<HeadersInit>,
  emit: Emit,
  fail: Fail,
  refreshMilliseconds = 0,
) {
  let active = true;
  let controller: AbortController | null = null;
  const load = async () => {
    controller?.abort();
    controller = new AbortController();
    try {
      const response = await fetch(url, {
        cache: "no-store",
        headers: await headers(),
        signal: controller.signal,
      });
      if (!active) return;
      if (response.status === 404) {
        emit(null);
        return;
      }
      if (!response.ok) throw new Error("Firebase query failed.");
      emit(await response.json());
    } catch (error) {
      if (!active || (error instanceof DOMException && error.name === "AbortError")) {
        return;
      }
      fail(error instanceof Error ? error : new Error(String(error)));
    }
  };
  void load();
  const timer = refreshMilliseconds
    ? window.setInterval(() => {
        if (document.visibilityState === "visible") void load();
      }, refreshMilliseconds)
    : undefined;
  return () => {
    active = false;
    controller?.abort();
    if (timer !== undefined) window.clearInterval(timer);
  };
}

function observePublicProducts(
  firestore: Firestore,
  args: QueryArgs,
  emit: Emit,
  fail: Fail,
) {
  const businessId = requiredString(args, "businessId");
  const run = latestAsync(emit, fail);
  return onSnapshot(
    query(
      collection(firestore, "products"),
      where("businessId", "==", businessId),
      where("inStock", "==", true),
    ),
    (snapshot) => run(() => hydrateProducts(firestore, snapshot, businessId)),
    fail,
  );
}

function observeBusinessProducts(
  firestore: Firestore,
  args: QueryArgs,
  userId: string | null,
  emit: Emit,
  fail: Fail,
) {
  if (!userId) {
    emit(undefined);
    return () => undefined;
  }
  const businessId = requiredString(args, "businessId");
  const run = latestAsync(emit, fail);
  return onSnapshot(
    query(
      collection(firestore, "products"),
      where("businessId", "==", businessId),
    ),
    (snapshot) => run(() => hydrateProducts(firestore, snapshot, businessId)),
    fail,
  );
}

function observePublicCategories(
  firestore: Firestore,
  args: QueryArgs,
  emit: Emit,
  fail: Fail,
) {
  const businessId = requiredString(args, "businessId");
  return onSnapshot(
    query(
      collection(firestore, "categories"),
      where("businessId", "==", businessId),
    ),
    (snapshot) =>
      emit(
        snapshot.docs
          .map(documentValue)
          .sort((left, right) =>
            Number(left.order ?? 0) - Number(right.order ?? 0),
          ),
      ),
    fail,
  );
}

function observeBusinessCatalogs(
  firestore: Firestore,
  args: QueryArgs,
  userId: string | null,
  emit: Emit,
  fail: Fail,
) {
  if (!userId) {
    emit(undefined);
    return () => undefined;
  }
  const businessId = requiredString(args, "businessId");
  return onSnapshot(
    query(
      collection(firestore, "catalogs"),
      where("businessId", "==", businessId),
    ),
    (snapshot) =>
      emit(
        snapshot.docs
          .map(documentValue)
          .sort(
            (left, right) =>
              Number(right.createdAt ?? 0) - Number(left.createdAt ?? 0),
          ),
      ),
    fail,
  );
}

function observeBusinessVariationOptions(
  firestore: Firestore,
  args: QueryArgs,
  userId: string | null,
  emit: Emit,
  fail: Fail,
) {
  if (!userId) {
    emit(undefined);
    return () => undefined;
  }
  const businessId = requiredString(args, "businessId");
  const run = latestAsync(emit, fail);
  return onSnapshot(
    query(
      collection(firestore, "businessVariationOptions"),
      where("businessId", "==", businessId),
    ),
    (snapshot) =>
      run(async () => {
        const business = await getDoc(doc(firestore, "businesses", businessId));
        if (!business.exists()) throw new Error("Business not found.");
        const businessType = normalizeBusinessType(
          business.data().businessType as StoredBusinessType,
        );
        const presets = BUSINESS_TYPE_CONFIG[businessType].variationOptions;
        const merged = new Map(
          presets.map((option) => [
            option.variantType.toLocaleLowerCase(),
            { variantType: option.variantType, values: [...option.values] },
          ]),
        );
        for (const row of snapshot.docs) {
          const data = row.data();
          if (typeof data.variantType !== "string") continue;
          const key = data.variantType.toLocaleLowerCase();
          const current = merged.get(key);
          const customValues = Array.isArray(data.values)
            ? data.values.filter(
                (value): value is string => typeof value === "string",
              )
            : [];
          merged.set(key, {
            variantType: current?.variantType ?? data.variantType.trim(),
            values: [
              ...new Set([...(current?.values ?? []), ...customValues]),
            ],
          });
        }
        return [...merged.values()];
      }),
    fail,
  );
}

function observeProductSearch(
  firestore: Firestore,
  args: QueryArgs,
  emit: Emit,
  fail: Fail,
) {
  const businessId = requiredString(args, "businessId");
  const searchTerm = requiredString(args, "searchTerm").trim().toLocaleLowerCase();
  if (!searchTerm) {
    emit([]);
    return () => undefined;
  }

  const run = latestAsync(emit, fail);
  return onSnapshot(
    query(
      collection(firestore, "products"),
      where("businessId", "==", businessId),
      where("inStock", "==", true),
    ),
    (snapshot) =>
      run(async () => {
        const products = await hydrateProducts(firestore, snapshot, businessId);
        return products
          .filter((product) =>
            [product.name, product.description, product.searchableText]
              .filter((value): value is string => typeof value === "string")
              .some((value) => value.toLocaleLowerCase().includes(searchTerm)),
          )
          .slice(0, 20);
      }),
    fail,
  );
}

function observeFeaturedProducts(
  firestore: Firestore,
  args: QueryArgs,
  emit: Emit,
  fail: Fail,
) {
  const businessId = requiredString(args, "businessId");
  const run = latestAsync(emit, fail);
  return onSnapshot(
    doc(firestore, "businesses", businessId),
    (snapshot) =>
      run(async () => {
        const ids = snapshot.data()?.featuredProductIds;
        if (!Array.isArray(ids) || ids.length === 0) return [];
        const products = await Promise.all(
          ids
            .filter((value): value is string => typeof value === "string")
            .map((id) => getDoc(doc(firestore, "products", id))),
        );
        return hydrateProducts(
          firestore,
          products.filter((product) => product.exists()),
          businessId,
        );
      }),
    fail,
  );
}

function observePublicProductBySlug(
  firestore: Firestore,
  args: QueryArgs,
  emit: Emit,
  fail: Fail,
) {
  const slug = requiredString(args, "slug");
  const productSlug = requiredString(args, "productSlug");
  let stopProducts: Unsubscribe | undefined;
  const stopBusiness = onSnapshot(
    query(
      collection(firestore, "businesses"),
      where("slug", "==", slug),
      where("isEnabled", "==", true),
      firestoreLimit(1),
    ),
    (businessSnapshot) => {
      stopProducts?.();
      if (businessSnapshot.empty) {
        emit(null);
        return;
      }
      const businessId = businessSnapshot.docs[0].id;
      const run = latestAsync(emit, fail);
      stopProducts = onSnapshot(
        query(
          collection(firestore, "products"),
          where("businessId", "==", businessId),
          where("inStock", "==", true),
        ),
        (snapshot) =>
          run(async () => {
            const product = snapshot.docs.find((candidate) => {
              const value = documentValue(candidate);
              return (
                candidate.id === productSlug ||
                publicProductSlug(value) === productSlug
              );
            });
            return product
              ? hydrateProduct(firestore, product)
              : null;
          }),
        fail,
      );
    },
    fail,
  );
  return () => {
    stopProducts?.();
    stopBusiness();
  };
}

function observeProduct(
  firestore: Firestore,
  args: QueryArgs,
  emit: Emit,
  fail: Fail,
) {
  const productId = requiredString(args, "productId");
  const businessId = requiredString(args, "businessId");
  const run = latestAsync(emit, fail);
  return onSnapshot(
    doc(firestore, "products", productId),
    (snapshot) =>
      run(async () => {
        if (!snapshot.exists() || snapshot.data().businessId !== businessId) {
          return null;
        }
        return hydrateProduct(firestore, snapshot);
      }),
    fail,
  );
}

function observeRelatedProducts(
  firestore: Firestore,
  args: QueryArgs,
  emit: Emit,
  fail: Fail,
) {
  const businessId = requiredString(args, "businessId");
  const excludedId = requiredString(args, "excludeProductId");
  const categoryId = typeof args.categoryId === "string" ? args.categoryId : null;
  const resultLimit = typeof args.limit === "number" ? args.limit : 5;
  const run = latestAsync(emit, fail);
  return onSnapshot(
    query(
      collection(firestore, "products"),
      where("businessId", "==", businessId),
      where("inStock", "==", true),
    ),
    (snapshot) =>
      run(async () => {
        const all = await hydrateProducts(firestore, snapshot, businessId);
        const others = all.filter((product) => product._id !== excludedId);
        const sameCategory = categoryId
          ? others.filter((product) => product.categoryId === categoryId)
          : [];
        const candidates = sameCategory.length ? sameCategory : others;
        return candidates
          .map((value) => ({ value, sort: Math.random() }))
          .sort((left, right) => left.sort - right.sort)
          .slice(0, resultLimit)
          .map(({ value }) => value);
      }),
    fail,
  );
}

function observeProductVariants(
  firestore: Firestore,
  args: QueryArgs,
  emit: Emit,
  fail: Fail,
) {
  const productId = requiredString(args, "productId");
  const businessId = requiredString(args, "businessId");
  let stopVariants: Unsubscribe | undefined;
  const stopProduct = onSnapshot(
    doc(firestore, "products", productId),
    (snapshot) => {
      stopVariants?.();
      const data = snapshot.data();
      if (!data || data.businessId !== businessId || !data.variantGroupId) {
        emit([]);
        return;
      }
      const run = latestAsync(emit, fail);
      stopVariants = onSnapshot(
        query(
          collection(firestore, "products"),
          where("variantGroupId", "==", data.variantGroupId),
          where("businessId", "==", businessId),
        ),
        (variants) =>
          run(() => hydrateProducts(firestore, variants, businessId)),
        fail,
      );
    },
    fail,
  );
  return () => {
    stopVariants?.();
    stopProduct();
  };
}

function observePublicCatalog(
  firestore: Firestore,
  args: QueryArgs,
  emit: Emit,
  fail: Fail,
) {
  const slug = requiredString(args, "slug");
  const catalogId = requiredString(args, "catalogId");
  let stopCatalog: Unsubscribe | undefined;
  const stopBusiness = onSnapshot(
    query(
      collection(firestore, "businesses"),
      where("slug", "==", slug),
      where("isEnabled", "==", true),
      firestoreLimit(1),
    ),
    (businessSnapshot) => {
      stopCatalog?.();
      if (businessSnapshot.empty) {
        emit(null);
        return;
      }
      const businessDocument = businessSnapshot.docs[0];
      const businessId = businessDocument.id;
      const run = latestAsync(emit, fail);
      stopCatalog = onSnapshot(
        query(
          collection(firestore, "catalogs"),
          where("businessId", "==", businessId),
          where("catalogId", "==", catalogId),
          firestoreLimit(1),
        ),
        (catalogSnapshot) =>
          run(async () => {
            if (catalogSnapshot.empty) return null;
            const catalog = documentValue(catalogSnapshot.docs[0]);
            const productIds = Array.isArray(catalog.productIds)
              ? catalog.productIds.filter(
                  (value): value is string => typeof value === "string",
                )
              : [];
            const productSnapshots = await Promise.all(
              productIds.map((id) => getDoc(doc(firestore, "products", id))),
            );
            const available = productSnapshots.filter(
              (product) =>
                product.exists() &&
                product.data().businessId === businessId &&
                product.data().inStock === true,
            );
            return {
              catalog,
              business: businessValue(businessDocument),
              products: await hydrateProducts(
                firestore,
                available,
                businessId,
              ),
            };
          }),
        fail,
      );
    },
    fail,
  );
  return () => {
    stopCatalog?.();
    stopBusiness();
  };
}

function emptyReviewStats() {
  return {
    approvedCount: 0,
    averageRating: 0,
    ratings1: 0,
    ratings2: 0,
    ratings3: 0,
    ratings4: 0,
    ratings5: 0,
  };
}

function publicCustomerName(customerName: unknown) {
  const parts = String(customerName ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "Customer";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts.at(-1)?.[0]?.toUpperCase()}.`;
}

function observeApprovedReviews(
  firestore: Firestore,
  args: QueryArgs,
  emit: Emit,
  fail: Fail,
) {
  const productId = requiredString(args, "productId");
  const resultLimit = typeof args.limit === "number" ? args.limit : 20;
  if (!Number.isInteger(resultLimit) || resultLimit < 1 || resultLimit > 30) {
    throw new Error("Review limit must be between 1 and 30.");
  }

  let stats: FirebaseDocument | null = null;
  let reviews: FirebaseDocument[] = [];
  let statsLoaded = false;
  let reviewsLoaded = false;
  let stopStats: Unsubscribe | undefined;
  let stopReviews: Unsubscribe | undefined;
  const publish = () => {
    if (!statsLoaded || !reviewsLoaded) return;
    const approvedCount = Number(stats?.approvedCount ?? 0);
    const ratingSum = Number(stats?.ratingSum ?? 0);
    emit({
      stats: {
        ...emptyReviewStats(),
        ...(stats ?? {}),
        approvedCount,
        averageRating:
          approvedCount > 0
            ? Math.round((ratingSum / approvedCount) * 10) / 10
            : 0,
      },
      reviews: reviews.map((review) => ({
        _id: review._id,
        displayName:
          typeof review.displayName === "string"
            ? review.displayName
            : publicCustomerName(review.customerName),
        rating: review.rating,
        comment: review.comment,
        imageUrls: Array.isArray(review.imageUrls)
          ? review.imageUrls.filter(
              (value): value is string => typeof value === "string",
            )
          : [],
        submittedAt: review.submittedAt,
      })),
    });
  };

  const stopProduct = onSnapshot(
    doc(firestore, "products", productId),
    (productSnapshot) => {
      stopStats?.();
      stopReviews?.();
      statsLoaded = false;
      reviewsLoaded = false;
      const businessId = productSnapshot.data()?.businessId;
      if (typeof businessId !== "string") {
        statsLoaded = true;
        reviewsLoaded = true;
        stats = null;
        reviews = [];
        publish();
        return;
      }

      stopStats = onSnapshot(
        query(
          collection(firestore, "productReviewStats"),
          where("productId", "==", productId),
          where("businessId", "==", businessId),
          firestoreLimit(1),
        ),
        (snapshot) => {
          stats = snapshot.empty ? null : documentValue(snapshot.docs[0]);
          statsLoaded = true;
          publish();
        },
        fail,
      );
      stopReviews = onSnapshot(
        query(
          collection(firestore, "productReviews"),
          where("productId", "==", productId),
          where("status", "==", "approved"),
          orderBy("submittedAt", "desc"),
          firestoreLimit(resultLimit),
        ),
        (snapshot) => {
          reviews = snapshot.docs.map(documentValue);
          reviewsLoaded = true;
          publish();
        },
        fail,
      );
    },
    fail,
  );
  return () => {
    stopReviews?.();
    stopStats?.();
    stopProduct();
  };
}

export function observeFirebasePublicQuery(
  functionName: string,
  args: QueryArgs,
  emit: Emit,
  fail: Fail,
  userId: string | null = null,
): Unsubscribe {
  const client = getFirebaseClient();
  if (!client) {
    fail(new Error("Firebase client configuration is missing."));
    return () => undefined;
  }

  switch (functionName) {
    case "analytics:getConversionRate":
    case "analytics:getProductPerformance":
    case "analytics:getSalesTrend":
    case "analytics:getTopCustomers":
    case "analytics:getTopProducts":
    case "analytics:getTotalOrders":
    case "analytics:getTotalPageViews":
    case "analytics:getTotalRevenue":
    case "analytics:getTotalVisitors":
    case "analytics:getTrafficSources":
      return observeFirebaseAnalyticsQuery(
        client.firestore,
        functionName,
        args,
        userId,
        emit,
        fail,
      );
    case "auth:loggedInUser":
      return observeLoggedInUser(client.firestore, userId, emit, fail);
    case "superAdmin:getBusinessForAdmin":
    case "superAdmin:listBusinesses":
      return observeFirebaseSuperAdminQuery(
        client.firestore,
        functionName,
        args,
        userId,
        emit,
        fail,
      );
    case "businesses:getUserBusiness":
      return observeUserBusiness(client.firestore, userId, emit, fail);
    case "businesses:checkSlugAvailability": {
      const slug = requiredString(args, "slug");
      return observeHttpJson(
        `/api/private/businesses/slug-availability?slug=${encodeURIComponent(slug)}`,
        async () => {
          const user = client.auth.currentUser;
          const headers = new Headers();
          if (user) {
            headers.set("authorization", `Bearer ${await user.getIdToken()}`);
          }
          return headers;
        },
        emit,
        fail,
      );
    }
    case "businesses:getBusinessBySlug":
      return observeBusinessBySlug(client.firestore, args, emit, fail);
    case "businesses:getFeaturedProducts":
      return observeFeaturedProducts(client.firestore, args, emit, fail);
    case "products:getPublicProducts":
      return observePublicProducts(client.firestore, args, emit, fail);
    case "products:getBusinessProducts":
      return observeBusinessProducts(
        client.firestore,
        args,
        userId,
        emit,
        fail,
      );
    case "products:searchProducts":
      return observeProductSearch(client.firestore, args, emit, fail);
    case "products:getPublicProductBySlug":
      return observePublicProductBySlug(client.firestore, args, emit, fail);
    case "products:getProduct":
      return observeProduct(client.firestore, args, emit, fail);
    case "products:getRelatedProducts":
      return observeRelatedProducts(client.firestore, args, emit, fail);
    case "products:getProductVariants":
      return observeProductVariants(client.firestore, args, emit, fail);
    case "categories:getPublicCategories":
      return observePublicCategories(client.firestore, args, emit, fail);
    case "categories:getBusinessCategories":
      return observePublicCategories(client.firestore, args, emit, fail);
    case "catalogs:getPublicCatalog":
      return observePublicCatalog(client.firestore, args, emit, fail);
    case "catalogs:getBusinessCatalogs":
      return observeBusinessCatalogs(
        client.firestore,
        args,
        userId,
        emit,
        fail,
      );
    case "businessVariationOptions:getBusinessVariationOptions":
      return observeBusinessVariationOptions(
        client.firestore,
        args,
        userId,
        emit,
        fail,
      );
    case "reviews:getApprovedProductReviews":
      return observeApprovedReviews(client.firestore, args, emit, fail);
    case "reviews:getReviewForm": {
      const token = requiredString(args, "token");
      return observeHttpJson(
        `/api/public/reviews?token=${encodeURIComponent(token)}`,
        () => ({}),
        emit,
        fail,
        15_000,
      );
    }
    case "reviews:getBusinessReviewRequestStates":
    case "reviews:getOrderReviews":
      return observeFirebaseReviewQuery(
        client.firestore,
        functionName,
        args,
        userId,
        emit,
        fail,
      );
    case "carts:getCart": {
      const cartId = requiredString(args, "cartId");
      return observeHttpJson(
        `/api/public/carts?cartId=${encodeURIComponent(cartId)}`,
        () => ({
          "x-customer-access-token": getCustomerAccessToken(false) ?? "",
          "x-order-access-token": getOrderAccessToken(cartId) ?? "",
        }),
        emit,
        fail,
      );
    }
    case "orders:getOrderByOrderId": {
      const orderId = requiredString(args, "orderId");
      return observeHttpJson(
        `/api/public/orders?orderId=${encodeURIComponent(orderId)}`,
        () => ({
          "x-customer-access-token": getCustomerAccessToken(false) ?? "",
          "x-order-access-token": getOrderAccessToken(orderId) ?? "",
        }),
        emit,
        fail,
        15_000,
      );
    }
    case "orders:getOrdersByMobile": {
      const mobile = requiredString(args, "mobile");
      return observeHttpJson(
        `/api/public/orders/history?mobile=${encodeURIComponent(mobile)}`,
        () => ({
          "x-customer-access-token": getCustomerAccessToken(false) ?? "",
        }),
        emit,
        fail,
        15_000,
      );
    }
    case "orders:getBusinessOrders":
      return observeBusinessOrders(
        client.firestore,
        args,
        userId,
        emit,
        fail,
      );
    case "orders:getBusinessOrderDetail":
      return observeBusinessOrderDetail(
        client.firestore,
        args,
        userId,
        emit,
        fail,
      );
    case "orders:getBusinessOrderStats":
      return observeBusinessOrderStats(
        client.firestore,
        args,
        userId,
        emit,
        fail,
      );
    default:
      fail(new Error(`Firebase public query is not implemented: ${functionName}`));
      return () => undefined;
  }
}
