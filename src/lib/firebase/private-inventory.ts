import { randomInt } from "node:crypto";
import {
  FieldValue,
  type DocumentData,
  type Firestore,
} from "firebase-admin/firestore";

type UnknownRecord = Record<string, unknown>;

const CATALOG_ID_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

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

function stringArray(value: unknown, field: string, maxItems = 100) {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new Error(`${field} is invalid.`);
  }
  return value.map((item) => requiredString(item, field, 160));
}

export async function assertOwnedBusiness(
  firestore: Firestore,
  businessId: string,
  userId: string,
  isSuperAdmin: boolean,
) {
  const business = await firestore.collection("businesses").doc(businessId).get();
  if (
    !business.exists ||
    (!isSuperAdmin && business.data()?.ownerId !== userId)
  ) {
    throw new Error("Business access is denied.");
  }
  return business;
}

async function assertProductsBelongToBusiness(
  firestore: Firestore,
  businessId: string,
  productIds: string[],
) {
  const uniqueProductIds = [...new Set(productIds)];
  if (uniqueProductIds.length < 2) {
    throw new Error("Select at least two products.");
  }
  const products = await firestore.getAll(
    ...uniqueProductIds.map((id) => firestore.collection("products").doc(id)),
  );
  if (
    products.some(
      (product) =>
        !product.exists || product.data()?.businessId !== businessId,
    )
  ) {
    throw new Error("Catalog contains invalid products.");
  }
  return uniqueProductIds;
}

function createCatalogId() {
  let id = "";
  for (let index = 0; index < 10; index += 1) {
    id += CATALOG_ID_ALPHABET[randomInt(CATALOG_ID_ALPHABET.length)];
  }
  return id;
}

export async function runPrivateInventoryMutation(
  firestore: Firestore,
  operation: string,
  rawArgs: unknown,
  userId: string,
  isSuperAdmin: boolean,
) {
  const args =
    rawArgs && typeof rawArgs === "object"
      ? (rawArgs as UnknownRecord)
      : ({} as UnknownRecord);

  switch (operation) {
    case "categories:createCategory": {
      const businessId = requiredString(args.businessId, "businessId", 160);
      await assertOwnedBusiness(firestore, businessId, userId, isSuperAdmin);
      const name = requiredString(args.name, "name", 160);
      const description = optionalString(args.description, "description", 500);
      const existing = await firestore
        .collection("categories")
        .where("businessId", "==", businessId)
        .get();
      const order =
        existing.docs.reduce(
          (maximum, category) =>
            Math.max(maximum, Number(category.data().order ?? 0)),
          0,
        ) + 1;
      const ref = firestore.collection("categories").doc();
      await ref.set({
        _creationTime: Date.now(),
        businessId,
        ...(description ? { description } : {}),
        name,
        order,
      });
      return ref.id;
    }

    case "categories:deleteCategory": {
      const categoryId = requiredString(args.categoryId, "categoryId", 160);
      const categoryRef = firestore.collection("categories").doc(categoryId);
      const category = await categoryRef.get();
      if (!category.exists) throw new Error("Category not found.");
      const businessId = requiredString(
        category.data()?.businessId,
        "businessId",
        160,
      );
      await assertOwnedBusiness(firestore, businessId, userId, isSuperAdmin);
      const products = await firestore
        .collection("products")
        .where("categoryId", "==", categoryId)
        .get();
      const batch = firestore.batch();
      for (const product of products.docs) {
        if (product.data().businessId === businessId) {
          batch.update(product.ref, { categoryId: FieldValue.delete() });
        }
      }
      batch.delete(categoryRef);
      await batch.commit();
      return null;
    }

    case "categories:reorderCategories": {
      const businessId = requiredString(args.businessId, "businessId", 160);
      await assertOwnedBusiness(firestore, businessId, userId, isSuperAdmin);
      const orderedIds = stringArray(args.orderedIds, "orderedIds", 100);
      const uniqueIds = [...new Set(orderedIds)];
      if (uniqueIds.length !== orderedIds.length) {
        throw new Error("orderedIds is invalid.");
      }
      const categories = await firestore.getAll(
        ...orderedIds.map((id) => firestore.collection("categories").doc(id)),
      );
      if (
        categories.some(
          (category) =>
            !category.exists || category.data()?.businessId !== businessId,
        )
      ) {
        throw new Error("Category access is denied.");
      }
      const batch = firestore.batch();
      categories.forEach((category, index) =>
        batch.update(category.ref, { order: index + 1 }),
      );
      await batch.commit();
      return null;
    }

    case "catalogs:createCatalog": {
      const businessId = requiredString(args.businessId, "businessId", 160);
      await assertOwnedBusiness(firestore, businessId, userId, isSuperAdmin);
      const productIds = await assertProductsBelongToBusiness(
        firestore,
        businessId,
        stringArray(args.productIds, "productIds"),
      );
      let catalogId = createCatalogId();
      while (
        !(await firestore
          .collection("catalogs")
          .where("catalogId", "==", catalogId)
          .limit(1)
          .get()).empty
      ) {
        catalogId = createCatalogId();
      }
      const now = Date.now();
      const name =
        optionalString(args.name, "name", 200) ||
        `Catalog ${new Date(now).toLocaleDateString("en-IN")}`;
      await firestore.collection("catalogs").add({
        _creationTime: now,
        businessId,
        catalogId,
        createdAt: now,
        name,
        productIds,
        updatedAt: now,
      });
      return { catalogId };
    }

    case "catalogs:updateCatalog": {
      const catalogDocumentId = requiredString(
        args.catalogId,
        "catalogId",
        160,
      );
      const catalogRef = firestore.collection("catalogs").doc(catalogDocumentId);
      const catalog = await catalogRef.get();
      if (!catalog.exists) throw new Error("Catalog not found.");
      const businessId = requiredString(
        catalog.data()?.businessId,
        "businessId",
        160,
      );
      await assertOwnedBusiness(firestore, businessId, userId, isSuperAdmin);
      const productIds = await assertProductsBelongToBusiness(
        firestore,
        businessId,
        stringArray(args.productIds, "productIds"),
      );
      await catalogRef.update({
        name: requiredString(args.name, "name", 200),
        productIds,
        updatedAt: Date.now(),
      });
      return null;
    }

    case "catalogs:deleteCatalog": {
      const catalogDocumentId = requiredString(
        args.catalogId,
        "catalogId",
        160,
      );
      const catalogRef = firestore.collection("catalogs").doc(catalogDocumentId);
      const catalog = await catalogRef.get();
      if (!catalog.exists) return null;
      await assertOwnedBusiness(
        firestore,
        requiredString(catalog.data()?.businessId, "businessId", 160),
        userId,
        isSuperAdmin,
      );
      await catalogRef.delete();
      return null;
    }

    case "businessVariationOptions:addCustomVariationType":
    case "businessVariationOptions:addCustomVariationValue": {
      const businessId = requiredString(args.businessId, "businessId", 160);
      await assertOwnedBusiness(firestore, businessId, userId, isSuperAdmin);
      const variantType = requiredString(args.variantType, "variantType", 120);
      const value =
        operation.endsWith("addCustomVariationValue")
          ? requiredString(args.value, "value", 160)
          : null;
      const rows = await firestore
        .collection("businessVariationOptions")
        .where("businessId", "==", businessId)
        .get();
      const row = rows.docs.find(
        (candidate) =>
          String(candidate.data().variantType).toLocaleLowerCase() ===
          variantType.toLocaleLowerCase(),
      );
      if (!row) {
        const now = Date.now();
        await firestore.collection("businessVariationOptions").add({
          _creationTime: now,
          businessId,
          createdAt: now,
          updatedAt: now,
          values: value ? [value] : [],
          variantType,
        });
      } else if (value) {
        const existingValues = Array.isArray(row.data().values)
          ? row
              .data()
              .values.filter((item: unknown): item is string => typeof item === "string")
          : [];
        if (
          !existingValues.some(
            (item: string) => item.toLocaleLowerCase() === value.toLocaleLowerCase(),
          )
        ) {
          await row.ref.update({
            updatedAt: Date.now(),
            values: [...existingValues, value],
          });
        }
      }
      return value ?? row?.data().variantType ?? variantType;
    }

    default:
      throw new Error(`Private inventory operation is not implemented: ${operation}`);
  }
}
