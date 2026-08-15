import {
  FieldValue,
  type DocumentData,
  type Firestore,
} from "firebase-admin/firestore";
import type { Storage } from "firebase-admin/storage";

import {
  DIETARY_CLASSIFICATIONS,
  PRODUCT_AUDIENCES,
  PRODUCT_CUSTOMIZATION_OPTIONS,
  PRODUCT_SIZE_FORMATS,
  RETURN_ACCEPTED_CONDITIONS,
  normalizeBusinessType,
  type BusinessType,
  type StoredBusinessType,
} from "../../types/product";
import { assertOwnedBusiness } from "./private-inventory";
import { userUploadPrefix } from "./upload-token";

type UnknownRecord = Record<string, unknown>;

const BAKERY_CUSTOMIZATION_OPTIONS = new Set([
  "edible_photo_print",
  "custom_text_message",
]);
const HANDICRAFT_CUSTOMIZATION_OPTIONS = new Set([
  "custom_engraving",
  "embroidered_text",
  "customer_photo_upload",
]);

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

function optionalString(value: unknown, field: string, maxLength: number) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || value.trim().length > maxLength) {
    throw new Error(`${field} is invalid.`);
  }
  return value.trim();
}

function finitePrice(value: unknown, field: string) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1_000_000_000
  ) {
    throw new Error(`${field} is invalid.`);
  }
  return value;
}

function optionalEnum(
  value: unknown,
  field: string,
  allowed: readonly string[],
) {
  if (value === undefined || value === null || value === "") return undefined;
  const normalized = requiredString(value, field, 80);
  if (!allowed.includes(normalized)) throw new Error(`${field} is invalid.`);
  return normalized;
}

function validateSizes(value: unknown) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 100) {
    throw new Error("sizes is invalid.");
  }
  return value.map((rawSize) => {
    if (!rawSize || typeof rawSize !== "object") {
      throw new Error("sizes is invalid.");
    }
    const size = rawSize as UnknownRecord;
    return {
      size: requiredString(size.size, "size", 80),
      ...(size.price === undefined
        ? {}
        : { price: finitePrice(size.price, "size price") }),
    };
  });
}

function validateProductTypeDetails(
  value: unknown,
  businessType: BusinessType,
) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object") {
    throw new Error("productTypeDetails is invalid.");
  }
  const details = value as UnknownRecord;
  const audience = optionalEnum(
    details.audience,
    "audience",
    PRODUCT_AUDIENCES,
  );
  const dietaryClassification = optionalEnum(
    details.dietaryClassification,
    "dietaryClassification",
    DIETARY_CLASSIFICATIONS,
  );
  const sizeFormat = optionalEnum(
    details.sizeFormat,
    "sizeFormat",
    PRODUCT_SIZE_FORMATS,
  );
  const customizationEnabled =
    details.customizationEnabled === undefined
      ? undefined
      : Boolean(details.customizationEnabled);
  const customizationOptions = details.customizationOptions;
  if (
    customizationOptions !== undefined &&
    (!Array.isArray(customizationOptions) || customizationOptions.length > 20)
  ) {
    throw new Error("customizationOptions is invalid.");
  }
  const options = (customizationOptions ?? []).map((option) =>
    optionalEnum(option, "customization option", PRODUCT_CUSTOMIZATION_OPTIONS),
  ).filter((option): option is string => Boolean(option));

  if (
    businessType === "garments" &&
    (dietaryClassification || customizationEnabled || options.length)
  ) {
    throw new Error("Garment product details are invalid.");
  }
  if (businessType === "home_bakery" && (audience || sizeFormat)) {
    throw new Error("Bakery product details are invalid.");
  }
  if (businessType === "handicrafts" && (dietaryClassification || sizeFormat)) {
    throw new Error("Handicraft product details are invalid.");
  }
  if (options.length && customizationEnabled !== true) {
    throw new Error("Customization must be enabled for selected options.");
  }
  if (
    businessType === "home_bakery" &&
    options.some((option) => !BAKERY_CUSTOMIZATION_OPTIONS.has(option))
  ) {
    throw new Error("Bakery customization options are invalid.");
  }
  if (
    businessType === "handicrafts" &&
    options.some((option) => !HANDICRAFT_CUSTOMIZATION_OPTIONS.has(option))
  ) {
    throw new Error("Handicraft customization options are invalid.");
  }
  return {
    ...(audience ? { audience } : {}),
    ...(customizationEnabled === undefined ? {} : { customizationEnabled }),
    ...(options.length ? { customizationOptions: options } : {}),
    ...(dietaryClassification ? { dietaryClassification } : {}),
    ...(sizeFormat ? { sizeFormat } : {}),
  };
}

function validateReturnPolicy(value: unknown) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object") {
    throw new Error("returnPolicy is invalid.");
  }
  const policy = value as UnknownRecord;
  if (typeof policy.returnable !== "boolean") {
    throw new Error("returnPolicy is invalid.");
  }
  const acceptedConditions = policy.acceptedConditions;
  if (!Array.isArray(acceptedConditions) || acceptedConditions.length > 10) {
    throw new Error("returnPolicy is invalid.");
  }
  const normalizedConditions = acceptedConditions.map((condition) =>
    optionalEnum(condition, "return condition", RETURN_ACCEPTED_CONDITIONS),
  ).filter((condition): condition is string => Boolean(condition));
  const returnWindowDays = policy.returnWindowDays;
  if (
    returnWindowDays !== undefined &&
    (typeof returnWindowDays !== "number" ||
      !Number.isInteger(returnWindowDays) ||
      returnWindowDays < 0 ||
      returnWindowDays > 365)
  ) {
    throw new Error("returnPolicy is invalid.");
  }
  return {
    acceptedConditions: normalizedConditions,
    returnable: policy.returnable,
    ...(returnWindowDays === undefined ? {} : { returnWindowDays }),
  };
}

function slugifyProductName(name: string) {
  return (
    name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "product"
  );
}

async function createProductSlug(
  firestore: Firestore,
  businessId: string,
  name: string,
) {
  const base = slugifyProductName(name);
  const existing = await firestore
    .collection("products")
    .where("businessId", "==", businessId)
    .get();
  const used = new Set(existing.docs.map((product) => product.data().slug));
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

async function validateCategory(
  firestore: Firestore,
  businessId: string,
  rawCategoryId: unknown,
) {
  const categoryId = optionalString(rawCategoryId, "categoryId", 160);
  if (!categoryId) return undefined;
  const category = await firestore.collection("categories").doc(categoryId).get();
  if (!category.exists || category.data()?.businessId !== businessId) {
    throw new Error("Category is invalid.");
  }
  return categoryId;
}

async function storageUrls(
  storage: Storage,
  bucketName: string,
  businessId: string,
  userId: string,
  rawIds: unknown,
) {
  if (!Array.isArray(rawIds) || rawIds.length > 20) {
    throw new Error("imageIds is invalid.");
  }
  const ids = rawIds.map((id) => requiredString(id, "imageId", 300));
  const ownerPrefix = `${userUploadPrefix(userId)}/`;
  const businessPrefix = `businesses/${businessId}/public/`;
  if (
    ids.some(
      (id) => !id.startsWith(ownerPrefix) && !id.startsWith(businessPrefix),
    )
  ) {
    throw new Error("Product image access is denied.");
  }
  const urls = await Promise.all(
    ids.map(async (id) => {
      const [metadata] = await storage.bucket().file(id).getMetadata();
      if (!metadata.contentType?.startsWith("image/")) {
        throw new Error("Product image is invalid.");
      }
      const token = metadata.metadata?.firebaseStorageDownloadTokens;
      if (typeof token !== "string" || !token) {
        throw new Error("Product image is invalid.");
      }
      const emulatorHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
      const origin = emulatorHost
        ? `http://${emulatorHost}/v0`
        : "https://firebasestorage.googleapis.com/v0";
      return `${origin}/b/${encodeURIComponent(bucketName)}/o/${encodeURIComponent(id)}?alt=media&token=${encodeURIComponent(token)}`;
    }),
  );
  return { ids, urls };
}

async function normalizedProductFields(
  firestore: Firestore,
  storage: Storage,
  bucketName: string,
  businessId: string,
  businessType: BusinessType,
  userId: string,
  args: UnknownRecord,
) {
  const name = requiredString(args.name, "name", 300);
  const description = requiredString(args.description, "description", 5_000);
  const categoryId = await validateCategory(
    firestore,
    businessId,
    args.categoryId,
  );
  const images = await storageUrls(
    storage,
    bucketName,
    businessId,
    userId,
    args.imageIds,
  );
  const rawSizeGuideId = optionalString(
    args.sizeGuideImageId,
    "sizeGuideImageId",
    300,
  );
  if (rawSizeGuideId && businessType !== "garments") {
    throw new Error("Only garment products can include a size guide image.");
  }
  const sizeGuide = rawSizeGuideId
    ? await storageUrls(
        storage,
        bucketName,
        businessId,
        userId,
        [rawSizeGuideId],
      )
    : null;
  if (typeof args.inStock !== "boolean") throw new Error("inStock is invalid.");
  return {
    categoryId,
    colorName: optionalString(args.colorName, "colorName", 120),
    colorSwatch: optionalString(args.colorSwatch, "colorSwatch", 20),
    description,
    imageIds: images.ids,
    imageUrls: images.urls,
    inStock: args.inStock,
    name,
    price: finitePrice(args.price, "price"),
    productTypeDetails: validateProductTypeDetails(
      args.productTypeDetails,
      businessType,
    ),
    returnPolicy: validateReturnPolicy(args.returnPolicy),
    searchableText: `${name} ${description}`.toLocaleLowerCase(),
    sizeGuideImageId: sizeGuide?.ids[0],
    sizeGuideImageUrl: sizeGuide?.urls[0],
    sizes: validateSizes(args.sizes),
    variantGroupId: optionalString(args.variantGroupId, "variantGroupId", 160),
    variantType: optionalString(args.variantType, "variantType", 120),
    variantValue: optionalString(args.variantValue, "variantValue", 160),
  };
}

function withoutUndefined(value: UnknownRecord) {
  return Object.fromEntries(
    Object.entries(value).filter(([, child]) => child !== undefined),
  );
}

export async function runPrivateProductMutation(
  firestore: Firestore,
  storage: Storage,
  bucketName: string,
  operation: string,
  rawArgs: unknown,
  userId: string,
  isSuperAdmin: boolean,
) {
  const args =
    rawArgs && typeof rawArgs === "object"
      ? (rawArgs as UnknownRecord)
      : ({} as UnknownRecord);

  if (operation === "products:createProduct") {
    const businessId = requiredString(args.businessId, "businessId", 160);
    const business = await assertOwnedBusiness(
      firestore,
      businessId,
      userId,
      isSuperAdmin,
    );
    const fields = await normalizedProductFields(
      firestore,
      storage,
      bucketName,
      businessId,
      normalizeBusinessType(business.data()!.businessType as StoredBusinessType),
      userId,
      args,
    );
    if (!fields.variantGroupId) {
      const existing = await firestore
        .collection("products")
        .where("businessId", "==", businessId)
        .get();
      if (existing.size >= 50) throw new Error("Product limit reached.");
    }
    const ref = firestore.collection("products").doc();
    const createdAt = Date.now();
    await ref.set(
      withoutUndefined({
        ...fields,
        _creationTime: createdAt,
        businessId,
        createdAt,
        slug: await createProductSlug(firestore, businessId, fields.name),
        updatedAt: createdAt,
      }) as DocumentData,
    );
    return ref.id;
  }

  const productId = requiredString(args.productId, "productId", 160);
  const productRef = firestore.collection("products").doc(productId);
  const product = await productRef.get();
  if (!product.exists) throw new Error("Product not found.");
  const businessId = requiredString(
    product.data()?.businessId,
    "businessId",
    160,
  );
  const business = await assertOwnedBusiness(
    firestore,
    businessId,
    userId,
    isSuperAdmin,
  );

  if (operation === "products:updateProduct") {
    const fields = await normalizedProductFields(
      firestore,
      storage,
      bucketName,
      businessId,
      normalizeBusinessType(business.data()!.businessType as StoredBusinessType),
      userId,
      args,
    );
    const update: UnknownRecord = {
      ...withoutUndefined(fields),
      updatedAt: Date.now(),
    };
    for (const key of [
      "categoryId",
      "productTypeDetails",
      "returnPolicy",
      "sizes",
      "variantGroupId",
      "variantType",
      "variantValue",
      "colorName",
      "colorSwatch",
    ]) {
      if (!(key in fields) || fields[key as keyof typeof fields] === undefined) {
        update[key] = FieldValue.delete();
      }
    }
    if (args.removeSizeGuideImage === true) {
      update.sizeGuideImageId = FieldValue.delete();
      update.sizeGuideImageUrl = FieldValue.delete();
    }
    await productRef.update(update);
    return null;
  }

  if (operation === "products:deleteProduct") {
    const [catalogs, businessSnapshot] = await Promise.all([
      firestore
        .collection("catalogs")
        .where("businessId", "==", businessId)
        .get(),
      firestore.collection("businesses").doc(businessId).get(),
    ]);
    const batch = firestore.batch();
    batch.delete(productRef);
    for (const catalog of catalogs.docs) {
      if (Array.isArray(catalog.data().productIds) && catalog.data().productIds.includes(productId)) {
        batch.update(catalog.ref, {
          productIds: FieldValue.arrayRemove(productId),
          updatedAt: Date.now(),
        });
      }
    }
    if (businessSnapshot.exists) {
      batch.update(businessSnapshot.ref, {
        featuredProductIds: FieldValue.arrayRemove(productId),
      });
    }
    await batch.commit();
    return null;
  }

  throw new Error(`Private product operation is not implemented: ${operation}`);
}
