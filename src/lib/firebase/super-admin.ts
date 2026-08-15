import type { Auth, UserRecord } from "firebase-admin/auth";
import type {
  DocumentData,
  Firestore,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import type { Storage } from "firebase-admin/storage";

import { userUploadPrefix } from "./upload-token";

type UnknownRecord = Record<string, unknown>;

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

export async function setBusinessEnabledBySuperAdmin(
  firestore: Firestore,
  rawBody: unknown,
) {
  if (!rawBody || typeof rawBody !== "object") {
    throw new Error("Business update is invalid.");
  }
  const body = rawBody as UnknownRecord;
  const businessId = requiredString(body.businessId, "businessId", 300);
  if (typeof body.isEnabled !== "boolean") {
    throw new Error("isEnabled is invalid.");
  }
  const business = await firestore.collection("businesses").doc(businessId).get();
  if (!business.exists) throw new Error("Business not found.");
  await business.ref.update({ isEnabled: body.isEnabled });
  return { businessId, isEnabled: body.isEnabled };
}

type DeletionCounts = Record<
  | "businessVariationOptions"
  | "businesses"
  | "carts"
  | "catalogs"
  | "categories"
  | "orders"
  | "pageViews"
  | "productReviewStats"
  | "productReviews"
  | "productShares"
  | "productViews"
  | "products"
  | "reviewRequests"
  | "reviewUploads"
  | "storageFiles"
  | "users",
  number
>;

function emptyCounts(): DeletionCounts {
  return {
    businessVariationOptions: 0,
    businesses: 0,
    carts: 0,
    catalogs: 0,
    categories: 0,
    orders: 0,
    pageViews: 0,
    productReviewStats: 0,
    productReviews: 0,
    productShares: 0,
    productViews: 0,
    products: 0,
    reviewRequests: 0,
    reviewUploads: 0,
    storageFiles: 0,
    users: 0,
  };
}

function storagePathFromUrl(value: string) {
  try {
    const url = new URL(value);
    const marker = "/o/";
    const index = url.pathname.indexOf(marker);
    if (index < 0) return null;
    const path = decodeURIComponent(url.pathname.slice(index + marker.length));
    return /^(?:customer|review|user)-uploads\//.test(path) ? path : null;
  } catch {
    return null;
  }
}

function collectStoragePaths(value: unknown, paths: Set<string>) {
  if (typeof value === "string") {
    if (/^(?:customer|review|user)-uploads\//.test(value)) paths.add(value);
    const fromUrl = storagePathFromUrl(value);
    if (fromUrl) paths.add(fromUrl);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((child) => collectStoragePaths(child, paths));
    return;
  }
  if (value && typeof value === "object") {
    Object.values(value as UnknownRecord).forEach((child) =>
      collectStoragePaths(child, paths),
    );
  }
}

async function targetByIdentifier(
  firestore: Firestore,
  auth: Auth,
  identifier: string,
  usingEmail: boolean,
) {
  let authUser: UserRecord | null = null;
  try {
    authUser = usingEmail
      ? await auth.getUserByEmail(identifier)
      : await auth.getUser(identifier);
  } catch {
    // A migrated data record can remain after an already-removed Auth account.
  }
  let userDocument = await firestore
    .collection("users")
    .doc(authUser?.uid ?? identifier)
    .get();
  if (!userDocument?.exists) {
    if (usingEmail) {
      const users = await firestore
        .collection("users")
        .where("email", "==", identifier)
        .limit(2)
        .get();
      if (users.size > 1) throw new Error("User data is inconsistent.");
      userDocument = users.empty ? userDocument : users.docs[0];
    }
  }
  const userId = authUser?.uid ?? userDocument?.id ?? (!usingEmail ? identifier : "");
  if (!userId) return null;
  const businesses = await firestore
    .collection("businesses")
    .where("ownerId", "==", userId)
    .get();
  if (!authUser && !userDocument?.exists && businesses.empty) return null;
  return { authUser, businesses, userDocument, userId };
}

export async function deleteUserAndOwnedDataBySuperAdmin(
  firestore: Firestore,
  storage: Storage,
  auth: Auth,
  actingUserId: string,
  rawBody: unknown,
) {
  if (!rawBody || typeof rawBody !== "object") {
    throw new Error("Deletion request is invalid.");
  }
  const body = rawBody as UnknownRecord;
  const usingEmail = body.email !== undefined || body.confirmEmail !== undefined;
  const usingId = body.id !== undefined || body.confirmId !== undefined;
  if (usingEmail === usingId) {
    throw new Error("Provide exactly one confirmed email or one confirmed id");
  }
  const identifier = requiredString(
    usingEmail ? body.email : body.id,
    usingEmail ? "email" : "id",
    320,
  );
  const confirmation = requiredString(
    usingEmail ? body.confirmEmail : body.confirmId,
    usingEmail ? "confirmEmail" : "confirmId",
    320,
  );
  const matches = usingEmail
    ? identifier.toLowerCase() === confirmation.toLowerCase()
    : identifier === confirmation;
  if (!matches) {
    throw new Error(
      usingEmail
        ? "confirmEmail must exactly match email"
        : "confirmId must exactly match id",
    );
  }
  const target = await targetByIdentifier(
    firestore,
    auth,
    identifier,
    usingEmail,
  );
  if (!target) throw new Error(`No user or owned store found for ${identifier}`);
  if (target.userId === actingUserId) {
    throw new Error("A super-admin cannot delete their own active account.");
  }
  if (target.authUser?.customClaims?.super_admin === true) {
    throw new Error("Another super-admin account cannot be deleted here.");
  }

  const counts = emptyCounts();
  const storagePaths = new Set<string>();
  const documentsToDelete: QueryDocumentSnapshot<DocumentData>[] = [];
  const reviewRequestIds: string[] = [];
  const collectionCounts = new Map<string, keyof DeletionCounts>([
    ["businessVariationOptions", "businessVariationOptions"],
    ["carts", "carts"],
    ["catalogs", "catalogs"],
    ["categories", "categories"],
    ["orders", "orders"],
    ["pageViews", "pageViews"],
    ["productReviews", "productReviews"],
    ["productReviewStats", "productReviewStats"],
    ["productShares", "productShares"],
    ["productViews", "productViews"],
    ["products", "products"],
    ["reviewRequests", "reviewRequests"],
  ]);

  for (const business of target.businesses.docs) {
    collectStoragePaths(business.data(), storagePaths);
    for (const [collectionName, countName] of collectionCounts) {
      const snapshot = await firestore
        .collection(collectionName)
        .where("businessId", "==", business.id)
        .get();
      snapshot.docs.forEach((entry) => {
        collectStoragePaths(entry.data(), storagePaths);
        if (collectionName === "reviewRequests") reviewRequestIds.push(entry.id);
        documentsToDelete.push(entry);
      });
      counts[countName] += snapshot.size;
    }
  }
  for (const requestId of reviewRequestIds) {
    const uploads = await firestore
      .collection("reviewUploads")
      .where("reviewRequestId", "==", requestId)
      .get();
    uploads.docs.forEach((upload) => {
      collectStoragePaths(upload.data(), storagePaths);
      documentsToDelete.push(upload);
    });
    counts.reviewUploads += uploads.size;
  }

  const [ownerFiles] = await storage
    .bucket()
    .getFiles({ prefix: `${userUploadPrefix(target.userId)}/` });
  ownerFiles.forEach((file) => storagePaths.add(file.name));
  for (const path of storagePaths) {
    try {
      await storage.bucket().file(path).delete({ ignoreNotFound: true });
      counts.storageFiles += 1;
    } catch (error) {
      throw new Error(
        `Storage cleanup failed for ${path}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  while (documentsToDelete.length) {
    const batch = firestore.batch();
    documentsToDelete.splice(0, 400).forEach((entry) => batch.delete(entry.ref));
    await batch.commit();
  }
  for (const business of target.businesses.docs) {
    await business.ref.delete();
    counts.businesses += 1;
  }
  if (target.userDocument?.exists) {
    await target.userDocument.ref.delete();
    counts.users = 1;
  }
  let authAccount: "already_missing" | "deleted" = "already_missing";
  if (target.authUser) {
    await auth.deleteUser(target.authUser.uid);
    authAccount = "deleted";
  }
  return {
    ...counts,
    authAccount,
    email:
      target.authUser?.email ??
      (typeof target.userDocument?.data()?.email === "string"
        ? target.userDocument.data()!.email
        : null),
    identifier,
  };
}
