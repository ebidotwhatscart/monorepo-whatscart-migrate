import {
  doc,
  getDoc,
  type DocumentData,
  type DocumentSnapshot,
  type Firestore,
} from "firebase/firestore";

import { normalizeBusinessType, type StoredBusinessType } from "../../types/product";

export type FirebaseDocument = Record<string, unknown> & {
  _creationTime: number;
  _id: string;
};

export type HydratedProduct = FirebaseDocument & {
  category: FirebaseDocument | null;
  imageUrls: string[];
  sizeGuideImageUrl: string | null;
  slug: string;
};

function numericTimestamp(value: unknown) {
  if (typeof value === "number") return value;
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof value.toMillis === "function"
  ) {
    return value.toMillis();
  }
  return 0;
}

export function documentValue(
  snapshot: DocumentSnapshot<DocumentData>,
): FirebaseDocument {
  const data = snapshot.data() ?? {};
  return {
    ...data,
    _creationTime: numericTimestamp(
      data._creationTime ?? data.createdAt ?? data.updatedAt,
    ),
    _id: snapshot.id,
  };
}

export function businessValue(snapshot: DocumentSnapshot<DocumentData>) {
  const business = documentValue(snapshot);
  const businessType = business.businessType;
  return {
    ...business,
    businessType:
      typeof businessType === "string"
        ? normalizeBusinessType(businessType as StoredBusinessType)
        : businessType,
    fssaiDocUrl:
      typeof business.fssaiDocUrl === "string" ? business.fssaiDocUrl : null,
    logoUrl: typeof business.logoUrl === "string" ? business.logoUrl : null,
  };
}

export function publicProductSlug(product: {
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

export async function hydrateProduct(
  firestore: Firestore,
  snapshot: DocumentSnapshot<DocumentData>,
  categoryCache?: Map<string, FirebaseDocument>,
): Promise<HydratedProduct> {
  const product = documentValue(snapshot);
  const categoryId =
    typeof product.categoryId === "string" ? product.categoryId : null;
  let category = categoryId ? categoryCache?.get(categoryId) ?? null : null;

  if (categoryId && !categoryCache) {
    const categorySnapshot = await getDoc(
      doc(firestore, "categories", categoryId),
    );
    category = categorySnapshot.exists() ? documentValue(categorySnapshot) : null;
  }

  return {
    ...product,
    slug: publicProductSlug(product),
    imageUrls: Array.isArray(product.imageUrls)
      ? product.imageUrls.filter((value): value is string => typeof value === "string")
      : [],
    sizeGuideImageUrl:
      typeof product.sizeGuideImageUrl === "string"
        ? product.sizeGuideImageUrl
        : null,
    category,
  } as HydratedProduct;
}
