import type { DocumentData, Firestore } from "firebase-admin/firestore";
import type { Storage } from "firebase-admin/storage";

import { normalizeIndianWhatsappPhone } from "../phone";
import { assertOwnedBusiness } from "./private-inventory";
import { userUploadPrefix } from "./upload-token";

type UnknownRecord = Record<string, unknown>;

const BUSINESS_TYPES = new Set(["garments", "home_bakery", "handicrafts"]);
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/;

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

function withoutUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutUndefined);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as UnknownRecord)
        .filter(([, child]) => child !== undefined)
        .map(([key, child]) => [key, withoutUndefined(child)]),
    );
  }
  return value;
}

export function validateBusinessSlug(value: unknown) {
  const slug = requiredString(value, "slug", 63).toLowerCase();
  if (!SLUG_PATTERN.test(slug)) throw new Error("slug is invalid.");
  return slug;
}

export async function businessSlugAvailable(
  firestore: Firestore,
  rawSlug: unknown,
) {
  const slug = validateBusinessSlug(rawSlug);
  const snapshot = await firestore
    .collection("businesses")
    .where("slug", "==", slug)
    .limit(1)
    .get();
  return snapshot.empty;
}

function validateBrandPalette(value: unknown) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object") {
    throw new Error("brandPalette is invalid.");
  }
  const palette = value as UnknownRecord;
  const colors = palette.colors;
  if (!Array.isArray(colors) || colors.length !== 3) {
    throw new Error("brandPalette is invalid.");
  }
  return {
    colors: colors.map((color) => requiredString(color, "palette color", 20)),
    mode: requiredString(palette.mode, "palette mode", 40),
    primaryColor: requiredString(
      palette.primaryColor,
      "palette primary color",
      20,
    ),
    seedColor: requiredString(palette.seedColor, "palette seed color", 20),
  };
}

function validateAddress(value: unknown) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object") throw new Error("address is invalid.");
  const address = value as UnknownRecord;
  return withoutUndefined({
    buildingNo: optionalString(address.buildingNo, "buildingNo", 120),
    country: optionalString(address.country, "country", 120),
    district: optionalString(address.district, "district", 120),
    pincode: optionalString(address.pincode, "pincode", 20),
    state: optionalString(address.state, "state", 120),
    street: optionalString(address.street, "street", 300),
    town: optionalString(address.town, "town", 160),
  });
}

function validateSocialLinks(value: unknown) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object") {
    throw new Error("socialLinks is invalid.");
  }
  const socialLinks = value as UnknownRecord;
  return withoutUndefined({
    facebook: optionalString(socialLinks.facebook, "facebook", 500),
    instagram: optionalString(socialLinks.instagram, "instagram", 500),
    threads: optionalString(socialLinks.threads, "threads", 500),
    x: optionalString(socialLinks.x, "x", 500),
  });
}

async function uploadedFileUrl(
  storage: Storage,
  bucketName: string,
  path: string,
  expectedType: "image" | "pdf" = "image",
) {
  const [metadata] = await storage.bucket().file(path).getMetadata();
  const validContentType =
    expectedType === "image"
      ? metadata.contentType?.startsWith("image/")
      : metadata.contentType === "application/pdf";
  const invalidMessage =
    expectedType === "image"
      ? "Uploaded business logo is invalid."
      : "Uploaded FSSAI certificate is invalid.";
  if (!validContentType) {
    throw new Error(invalidMessage);
  }
  const token = metadata.metadata?.firebaseStorageDownloadTokens;
  if (typeof token !== "string" || !token) {
    throw new Error(invalidMessage);
  }
  const emulatorHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  const origin = emulatorHost
    ? `http://${emulatorHost}/v0`
    : "https://firebasestorage.googleapis.com/v0";
  return `${origin}/b/${encodeURIComponent(bucketName)}/o/${encodeURIComponent(path)}?alt=media&token=${encodeURIComponent(token)}`;
}

export async function updateOwnedBusiness(
  firestore: Firestore,
  storage: Storage,
  bucketName: string,
  userId: string,
  isSuperAdmin: boolean,
  rawBody: unknown,
) {
  if (!rawBody || typeof rawBody !== "object") {
    throw new Error("Business is invalid.");
  }
  const body = rawBody as UnknownRecord;
  const businessId = requiredString(body.businessId, "businessId", 300);
  const businessSnapshot = await assertOwnedBusiness(
    firestore,
    businessId,
    userId,
    isSuperAdmin,
  );
  const business = businessSnapshot.data() ?? {};
  const whatsappPhone = normalizeIndianWhatsappPhone(
    requiredString(body.whatsappPhone, "whatsappPhone", 20),
  );
  if (!whatsappPhone) {
    throw new Error("Enter a valid 10-digit WhatsApp number.");
  }

  const patch: UnknownRecord = {
    name: requiredString(body.name, "name", 200),
    themeColor: requiredString(body.themeColor, "themeColor", 20),
    whatsappPhone,
  };
  if (body.brandPalette !== undefined) {
    patch.brandPalette = validateBrandPalette(body.brandPalette);
  }
  if (body.description !== undefined) {
    patch.description = optionalString(body.description, "description", 1_000);
  }
  if (body.socialLinks !== undefined) {
    patch.socialLinks = validateSocialLinks(body.socialLinks);
  }
  if (body.ownerName !== undefined) {
    patch.ownerName = optionalString(body.ownerName, "ownerName", 200);
  }
  if (body.shippingBannerText !== undefined) {
    patch.shippingBannerText = optionalString(
      body.shippingBannerText,
      "shippingBannerText",
      300,
    );
  }
  if (body.address !== undefined) {
    patch.address = validateAddress(body.address);
  }
  if (body.serviceRegion !== undefined) {
    patch.serviceRegion = optionalString(
      body.serviceRegion,
      "serviceRegion",
      300,
    );
  }
  if (body.fssaiNumber !== undefined) {
    patch.fssaiNumber = optionalString(body.fssaiNumber, "fssaiNumber", 100);
  }
  if (body.upiId !== undefined) {
    patch.upiId = optionalString(body.upiId, "upiId", 200);
  }

  if (body.featuredProductIds !== undefined) {
    if (
      !Array.isArray(body.featuredProductIds) ||
      body.featuredProductIds.length > 100
    ) {
      throw new Error("featuredProductIds is invalid.");
    }
    const featuredProductIds = body.featuredProductIds.map((value) =>
      requiredString(value, "featured product", 300),
    );
    if (new Set(featuredProductIds).size !== featuredProductIds.length) {
      throw new Error("featuredProductIds is invalid.");
    }
    const products = await Promise.all(
      featuredProductIds.map((productId) =>
        firestore.collection("products").doc(productId).get(),
      ),
    );
    if (
      products.some(
        (product) =>
          !product.exists || product.data()?.businessId !== businessSnapshot.id,
      )
    ) {
      throw new Error("Featured products are invalid.");
    }
    patch.featuredProductIds = featuredProductIds;
  }

  if (body.logoId !== undefined) {
    const logoId = requiredString(body.logoId, "logoId", 300);
    if (
      logoId !== business.logoId &&
      !logoId.startsWith(`${userUploadPrefix(userId)}/`)
    ) {
      throw new Error("Uploaded business logo is invalid.");
    }
    patch.logoId = logoId;
    patch.logoUrl = await uploadedFileUrl(storage, bucketName, logoId);
  }
  if (body.fssaiDocId !== undefined) {
    const fssaiDocId = requiredString(body.fssaiDocId, "fssaiDocId", 300);
    if (
      fssaiDocId !== business.fssaiDocId &&
      !fssaiDocId.startsWith(`${userUploadPrefix(userId)}/`)
    ) {
      throw new Error("Uploaded FSSAI certificate is invalid.");
    }
    patch.fssaiDocId = fssaiDocId;
    patch.fssaiDocUrl = await uploadedFileUrl(
      storage,
      bucketName,
      fssaiDocId,
      "pdf",
    );
  }

  await businessSnapshot.ref.update(withoutUndefined(patch) as DocumentData);
  return null;
}

export async function createOwnedBusiness(
  firestore: Firestore,
  storage: Storage,
  bucketName: string,
  ownerId: string,
  rawBody: unknown,
) {
  if (!rawBody || typeof rawBody !== "object") {
    throw new Error("Business is invalid.");
  }
  const body = rawBody as UnknownRecord;
  const name = requiredString(body.name, "name", 200);
  const slug = validateBusinessSlug(body.slug);
  const themeColor = requiredString(body.themeColor, "themeColor", 20);
  const logoId = requiredString(body.logoId, "logoId", 300);
  if (!logoId.startsWith(`${userUploadPrefix(ownerId)}/`)) {
    throw new Error("Uploaded business logo is invalid.");
  }
  const whatsappPhone = normalizeIndianWhatsappPhone(
    requiredString(body.whatsappPhone, "whatsappPhone", 20),
  );
  if (!whatsappPhone) {
    throw new Error("Enter a valid 10-digit WhatsApp number.");
  }
  const businessType = requiredString(body.businessType, "businessType", 40);
  if (!BUSINESS_TYPES.has(businessType)) {
    throw new Error("businessType is invalid.");
  }
  const logoUrl = await uploadedFileUrl(storage, bucketName, logoId);
  const businessRef = firestore.collection("businesses").doc();
  const createdAt = Date.now();

  await firestore.runTransaction(async (transaction) => {
    const [slugSnapshot, ownerSnapshot] = await Promise.all([
      transaction.get(
        firestore.collection("businesses").where("slug", "==", slug).limit(1),
      ),
      transaction.get(
        firestore
          .collection("businesses")
          .where("ownerId", "==", ownerId)
          .limit(1),
      ),
    ]);
    if (!slugSnapshot.empty) throw new Error("Business slug already exists.");
    if (!ownerSnapshot.empty) throw new Error("This account already owns a business.");
    transaction.create(
      businessRef,
      withoutUndefined({
        _creationTime: createdAt,
        address: validateAddress(body.address),
        brandPalette: validateBrandPalette(body.brandPalette),
        businessType,
        createdAt,
        description: optionalString(body.description, "description", 1_000),
        isEnabled: true,
        logoId,
        logoUrl,
        name,
        orderSequence: 0,
        ownerId,
        ownerName: optionalString(body.ownerName, "ownerName", 200),
        preferredLanguage: optionalString(
          body.preferredLanguage,
          "preferredLanguage",
          80,
        ),
        serviceRegion: optionalString(body.serviceRegion, "serviceRegion", 300),
        slug,
        themeColor,
        whatsappPhone,
      }) as DocumentData,
    );
  });
  return businessRef.id;
}
