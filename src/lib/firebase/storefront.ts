import type {
  DocumentData,
  DocumentSnapshot,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";

import { normalizeBusinessType, type StoredBusinessType } from "../../types/product";
import { getAdminFirestore } from "./admin";

type AdminDocument = Record<string, unknown> & {
  _creationTime: number;
  _id: string;
};

type PublicBusiness = AdminDocument & {
  businessType: unknown;
  description?: string;
  featuredProductIds?: string[];
  id: string;
  isEnabled: boolean;
  logoUrl: string | null;
  name: string;
  slug: string;
  themeColor: string;
};

type HydratedAdminProduct = AdminDocument & {
  category: AdminDocument | null;
  categoryId?: string;
  description: string;
  imageUrls: string[];
  inStock: boolean;
  name: string;
  price: number;
  sizeGuideImageUrl: string | null;
  slug: string;
};

function serializableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(serializableValue);
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === "object") {
    if (
      "toMillis" in value &&
      typeof value.toMillis === "function"
    ) {
      return value.toMillis();
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, serializableValue(nested)]),
    );
  }
  return value;
}

function adminDocumentValue(
  snapshot: DocumentSnapshot<DocumentData>,
): AdminDocument {
  const data = serializableValue(snapshot.data() ?? {}) as Record<string, unknown>;
  return {
    ...data,
    _creationTime:
      typeof data._creationTime === "number"
        ? data._creationTime
        : snapshot.createTime?.toMillis() ?? 0,
    _id: snapshot.id,
  };
}

function publicProductSlug(product: {
  _id: string;
  name?: unknown;
  slug?: unknown;
}) {
  if (typeof product.slug === "string" && product.slug) return product.slug;
  const readable = String(product.name ?? "product")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "product";
  return `${readable}-${product._id.slice(-6).toLowerCase()}`;
}

function businessFromSnapshot(
  snapshot: QueryDocumentSnapshot<DocumentData>,
): PublicBusiness {
  const business = adminDocumentValue(snapshot);
  const businessType = business.businessType;
  return {
    ...business,
    id: business._id,
    name: String(business.name ?? "WhatsCart Store"),
    slug: String(business.slug ?? ""),
    description:
      typeof business.description === "string" ? business.description : undefined,
    logoUrl: typeof business.logoUrl === "string" ? business.logoUrl : null,
    themeColor:
      typeof business.themeColor === "string" ? business.themeColor : "#3B82F6",
    businessType:
      typeof businessType === "string"
        ? normalizeBusinessType(businessType as StoredBusinessType)
        : businessType,
    isEnabled: business.isEnabled !== false,
  } as PublicBusiness;
}

async function categoryMap(businessId: string) {
  const firestore = getAdminFirestore();
  if (!firestore) return new Map<string, AdminDocument>();
  const result = await firestore
    .collection("categories")
    .where("businessId", "==", businessId)
    .get();
  return new Map(
    result.docs.map((snapshot) => [snapshot.id, adminDocumentValue(snapshot)]),
  );
}

async function hydrateProduct(
  snapshot: DocumentSnapshot<DocumentData>,
  categories?: Map<string, AdminDocument>,
): Promise<HydratedAdminProduct> {
  const product = adminDocumentValue(snapshot);
  const categoryId =
    typeof product.categoryId === "string" ? product.categoryId : null;
  return {
    ...product,
    categoryId: categoryId ?? undefined,
    description: String(product.description ?? ""),
    inStock: product.inStock === true,
    name: String(product.name ?? "Product"),
    price: Number(product.price ?? 0),
    slug: publicProductSlug(product),
    imageUrls: Array.isArray(product.imageUrls)
      ? product.imageUrls.filter((value): value is string => typeof value === "string")
      : [],
    sizeGuideImageUrl:
      typeof product.sizeGuideImageUrl === "string"
        ? product.sizeGuideImageUrl
        : null,
    category: categoryId ? categories?.get(categoryId) ?? null : null,
  } as HydratedAdminProduct;
}

export async function getPublicBusinessBySlug(slug: string) {
  const firestore = getAdminFirestore();
  if (!firestore) return null;
  const result = await firestore
    .collection("businesses")
    .where("slug", "==", slug)
    .where("isEnabled", "==", true)
    .limit(1)
    .get();
  if (result.empty) return null;
  return businessFromSnapshot(result.docs[0]);
}

export async function getPublicCategories(businessId: string) {
  const categories = await categoryMap(businessId);
  return [...categories.values()].sort(
    (left, right) => Number(left.order ?? 0) - Number(right.order ?? 0),
  );
}

export async function getPublicProducts(businessId: string) {
  const firestore = getAdminFirestore();
  if (!firestore) return [];
  const [result, categories] = await Promise.all([
    firestore
      .collection("products")
      .where("businessId", "==", businessId)
      .where("inStock", "==", true)
      .get(),
    categoryMap(businessId),
  ]);
  return Promise.all(
    result.docs.map((snapshot) => hydrateProduct(snapshot, categories)),
  );
}

export async function getPublicProduct(businessId: string, slugOrId: string) {
  const firestore = getAdminFirestore();
  if (!firestore) return null;
  const categories = await categoryMap(businessId);

  const bySlug = await firestore
    .collection("products")
    .where("businessId", "==", businessId)
    .where("slug", "==", slugOrId)
    .limit(1)
    .get();
  if (!bySlug.empty && bySlug.docs[0].data().inStock === true) {
    return hydrateProduct(bySlug.docs[0], categories);
  }

  const allProducts = await firestore
    .collection("products")
    .where("businessId", "==", businessId)
    .where("inStock", "==", true)
    .get();
  const legacySlug = allProducts.docs.find(
    (snapshot) =>
      publicProductSlug(adminDocumentValue(snapshot)) === slugOrId,
  );
  if (legacySlug) return hydrateProduct(legacySlug, categories);

  const byId = await firestore.collection("products").doc(slugOrId).get();
  if (
    !byId.exists ||
    byId.data()?.businessId !== businessId ||
    byId.data()?.inStock !== true
  ) {
    return null;
  }
  return hydrateProduct(byId, categories);
}

export async function getFeaturedProducts(businessId: string) {
  const firestore = getAdminFirestore();
  if (!firestore) return [];
  const business = await firestore.collection("businesses").doc(businessId).get();
  const ids = business.data()?.featuredProductIds;
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const [snapshots, categories] = await Promise.all([
    Promise.all(
      ids
        .filter((value): value is string => typeof value === "string")
        .map((id) => firestore.collection("products").doc(id).get()),
    ),
    categoryMap(businessId),
  ]);
  return Promise.all(
    snapshots
      .filter(
        (snapshot) =>
          snapshot.exists &&
          snapshot.data()?.businessId === businessId &&
          snapshot.data()?.inStock === true,
      )
      .map((snapshot) => hydrateProduct(snapshot, categories)),
  );
}

export async function getRelatedProducts(
  businessId: string,
  excludedProductId: string,
  categoryId: string | undefined,
  limit = 5,
) {
  const products = await getPublicProducts(businessId);
  const others = products.filter((product) => product._id !== excludedProductId);
  const sameCategory = categoryId
    ? others.filter((product) => product.categoryId === categoryId)
    : [];
  const candidates = sameCategory.length ? sameCategory : others;
  return candidates
    .map((value) => ({ value, sort: Math.random() }))
    .sort((left, right) => left.sort - right.sort)
    .slice(0, limit)
    .map(({ value }) => value);
}

export async function getProductVariants(
  businessId: string,
  productId: string,
) {
  const firestore = getAdminFirestore();
  if (!firestore) return [];
  const product = await firestore.collection("products").doc(productId).get();
  const variantGroupId = product.data()?.variantGroupId;
  if (product.data()?.businessId !== businessId || !variantGroupId) return [];
  const [variants, categories] = await Promise.all([
    firestore
      .collection("products")
      .where("variantGroupId", "==", variantGroupId)
      .where("businessId", "==", businessId)
      .get(),
    categoryMap(businessId),
  ]);
  return Promise.all(
    variants.docs.map((snapshot) => hydrateProduct(snapshot, categories)),
  );
}

export async function getPublicCatalog(slug: string, catalogId: string) {
  const firestore = getAdminFirestore();
  if (!firestore) return null;
  const business = await getPublicBusinessBySlug(slug);
  if (!business) return null;
  const catalogSnapshot = await firestore
    .collection("catalogs")
    .where("businessId", "==", business._id)
    .where("catalogId", "==", catalogId)
    .limit(1)
    .get();
  if (catalogSnapshot.empty) return null;
  const catalog = adminDocumentValue(catalogSnapshot.docs[0]);
  const productIds = Array.isArray(catalog.productIds)
    ? catalog.productIds.filter((value): value is string => typeof value === "string")
    : [];
  const [products, categories] = await Promise.all([
    Promise.all(
      productIds.map((id) => firestore.collection("products").doc(id).get()),
    ),
    categoryMap(business._id),
  ]);
  return {
    catalog,
    business,
    products: await Promise.all(
      products
        .filter(
          (snapshot) =>
            snapshot.exists &&
            snapshot.data()?.businessId === business._id &&
            snapshot.data()?.inStock === true,
        )
        .map((snapshot) => hydrateProduct(snapshot, categories)),
    ),
  };
}

export async function getApprovedProductReviews(
  productId: string,
  limit = 20,
) {
  const firestore = getAdminFirestore();
  if (!firestore) return null;
  const product = await firestore.collection("products").doc(productId).get();
  const businessId = product.data()?.businessId;
  if (typeof businessId !== "string") return null;
  const [statsSnapshot, reviewsSnapshot] = await Promise.all([
    firestore
      .collection("productReviewStats")
      .where("productId", "==", productId)
      .where("businessId", "==", businessId)
      .limit(1)
      .get(),
    firestore
      .collection("productReviews")
      .where("productId", "==", productId)
      .where("status", "==", "approved")
      .orderBy("submittedAt", "desc")
      .limit(limit)
      .get(),
  ]);
  const stats = statsSnapshot.empty
    ? null
    : adminDocumentValue(statsSnapshot.docs[0]);
  const approvedCount = Number(stats?.approvedCount ?? 0);
  const ratingSum = Number(stats?.ratingSum ?? 0);
  return {
    stats: {
      approvedCount,
      averageRating:
        approvedCount > 0
          ? Math.round((ratingSum / approvedCount) * 10) / 10
          : 0,
      ratings1: Number(stats?.ratings1 ?? 0),
      ratings2: Number(stats?.ratings2 ?? 0),
      ratings3: Number(stats?.ratings3 ?? 0),
      ratings4: Number(stats?.ratings4 ?? 0),
      ratings5: Number(stats?.ratings5 ?? 0),
    },
    reviews: reviewsSnapshot.docs.map((snapshot) => {
      const review = adminDocumentValue(snapshot);
      const nameParts = String(review.customerName ?? "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      return {
        _id: review._id,
        displayName:
          typeof review.displayName === "string"
            ? review.displayName
            : nameParts.length > 1
              ? `${nameParts[0]} ${nameParts.at(-1)?.[0]?.toUpperCase()}.`
              : nameParts[0] || "Customer",
        rating: review.rating,
        comment: review.comment,
        imageUrls: Array.isArray(review.imageUrls)
          ? review.imageUrls.filter(
              (value): value is string => typeof value === "string",
            )
          : [],
        submittedAt: review.submittedAt,
      };
    }),
  };
}
