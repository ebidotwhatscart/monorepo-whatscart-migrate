import { createHash, createHmac } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const APPLICATION_TABLES = [
  "users",
  "businesses",
  "categories",
  "products",
  "businessVariationOptions",
  "catalogs",
  "carts",
  "orders",
  "reviewRequests",
  "reviewUploads",
  "productReviews",
  "productReviewStats",
  "pageViews",
  "productViews",
  "productShares",
];

async function readJsonLines(filePath) {
  if (!existsSync(filePath)) return [];
  const content = await readFile(filePath, "utf8");
  return content
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(
          `Invalid JSON in ${filePath} at line ${index + 1}: ${error.message}`,
        );
      }
    });
}

export async function loadConvexExport(exportDirectory) {
  const tables = {};
  for (const table of APPLICATION_TABLES) {
    tables[table] = await readJsonLines(
      path.join(exportDirectory, table, "documents.jsonl"),
    );
  }
  const storage = await readJsonLines(
    path.join(exportDirectory, "_storage", "documents.jsonl"),
  );
  return { exportDirectory, storage, tables };
}

const BUSINESS_TABLES = [
  "categories",
  "products",
  "businessVariationOptions",
  "catalogs",
  "carts",
  "orders",
  "reviewRequests",
  "productReviewStats",
  "pageViews",
  "productViews",
  "productShares",
];

function referencedStorageIds(tables) {
  const ids = new Set();
  const add = (id) => {
    if (typeof id === "string" && id) ids.add(id);
  };
  for (const business of tables.businesses) {
    add(business.logoId);
    add(business.fssaiDocId);
  }
  for (const product of tables.products) {
    for (const id of product.imageIds ?? []) add(id);
    add(product.sizeGuideImageId);
  }
  for (const request of tables.reviewRequests) {
    for (const product of request.products ?? []) add(product.imageId);
  }
  for (const upload of tables.reviewUploads) add(upload.storageId);
  for (const review of tables.productReviews) {
    for (const id of review.imageIds ?? []) add(id);
  }
  return ids;
}

/**
 * Removes businesses whose owner record was deleted from Convex, together
 * with all application data that belongs to those businesses. Orphaned
 * analytics for already-deleted products are also omitted because they cannot
 * be represented safely in the target schema.
 */
export function filterUnownedBusinesses(snapshot) {
  const userIds = new Set(snapshot.tables.users.map((user) => user._id));
  const excludedBusinesses = snapshot.tables.businesses.filter(
    (business) => !userIds.has(business.ownerId),
  );
  const excludedBusinessIds = new Set(excludedBusinesses.map((business) => business._id));
  const keptBusinessIds = new Set(
    snapshot.tables.businesses
      .filter((business) => !excludedBusinessIds.has(business._id))
      .map((business) => business._id),
  );
  const businessIdOf = (document) => keptBusinessIds.has(document.businessId);

  const tables = Object.fromEntries(
    Object.entries(snapshot.tables).map(([table, documents]) => [table, [...documents]]),
  );
  tables.businesses = tables.businesses.filter((business) =>
    keptBusinessIds.has(business._id),
  );
  for (const table of BUSINESS_TABLES) {
    tables[table] = tables[table].filter(businessIdOf);
  }

  const keptProductIds = new Set(tables.products.map((product) => product._id));
  tables.productViews = tables.productViews.filter((view) =>
    keptProductIds.has(view.productId),
  );
  tables.productShares = tables.productShares.filter((view) =>
    keptProductIds.has(view.productId),
  );
  tables.reviewUploads = tables.reviewUploads.filter((upload) =>
    tables.reviewRequests.some((request) => request._id === upload.reviewRequestId),
  );
  tables.productReviews = tables.productReviews.filter((review) =>
    keptProductIds.has(review.productId),
  );
  tables.productReviewStats = tables.productReviewStats.filter((stats) =>
    keptProductIds.has(stats.productId),
  );

  const storageIds = referencedStorageIds(tables);
  const filteredStorage = snapshot.storage.filter((metadata) =>
    storageIds.has(metadata._id),
  );

  return {
    snapshot: { ...snapshot, tables, storage: filteredStorage },
    excludedBusinesses,
    excludedBusinessIds,
    excludedStorageCount: snapshot.storage.length - filteredStorage.length,
  };
}

function tableIndex(tables, table) {
  return new Map(tables[table].map((document) => [document._id, document]));
}

function reference(errors, indexes, table, id, location, optional = false) {
  if ((id === undefined || id === null || id === "") && optional) return;
  if (typeof id !== "string" || !indexes[table].has(id)) {
    errors.push(`${location} references missing ${table}/${String(id)}`);
  }
}

function storageReference(errors, storageIds, id, location, optional = false) {
  if ((id === undefined || id === null || id === "") && optional) return;
  if (typeof id !== "string" || !storageIds.has(id)) {
    errors.push(`${location} references missing _storage/${String(id)}`);
  }
}

export function validateConvexExport(snapshot) {
  const { tables, storage, exportDirectory } = snapshot;
  const errors = [];
  const warnings = [];
  const indexes = Object.fromEntries(
    APPLICATION_TABLES.map((table) => [table, tableIndex(tables, table)]),
  );
  const storageIds = new Set(storage.map((document) => document._id));

  for (const table of APPLICATION_TABLES) {
    if (indexes[table].size !== tables[table].length) {
      errors.push(`${table} contains duplicate _id values`);
    }
  }

  const slugs = new Set();
  for (const business of tables.businesses) {
    reference(errors, indexes, "users", business.ownerId, `${business._id}.ownerId`);
    if (slugs.has(business.slug)) errors.push(`duplicate business slug ${business.slug}`);
    slugs.add(business.slug);
    storageReference(errors, storageIds, business.logoId, `${business._id}.logoId`, true);
    storageReference(
      errors,
      storageIds,
      business.fssaiDocId,
      `${business._id}.fssaiDocId`,
      true,
    );
  }
  for (const category of tables.categories) {
    reference(errors, indexes, "businesses", category.businessId, `${category._id}.businessId`);
  }
  for (const product of tables.products) {
    reference(errors, indexes, "businesses", product.businessId, `${product._id}.businessId`);
    reference(errors, indexes, "categories", product.categoryId, `${product._id}.categoryId`, true);
    for (const storageId of product.imageIds ?? []) {
      storageReference(errors, storageIds, storageId, `${product._id}.imageIds`);
    }
    storageReference(
      errors,
      storageIds,
      product.sizeGuideImageId,
      `${product._id}.sizeGuideImageId`,
      true,
    );
  }
  for (const option of tables.businessVariationOptions) {
    reference(errors, indexes, "businesses", option.businessId, `${option._id}.businessId`);
  }
  for (const catalog of tables.catalogs) {
    reference(errors, indexes, "businesses", catalog.businessId, `${catalog._id}.businessId`);
    for (const productId of catalog.productIds ?? []) {
      reference(errors, indexes, "products", productId, `${catalog._id}.productIds`);
    }
  }
  for (const cart of tables.carts) {
    reference(errors, indexes, "businesses", cart.businessId, `${cart._id}.businessId`);
    for (const product of cart.products ?? []) {
      reference(errors, indexes, "products", product.productId, `${cart._id}.products`);
    }
  }
  for (const order of tables.orders) {
    reference(errors, indexes, "businesses", order.businessId, `${order._id}.businessId`);
    for (const item of order.items ?? []) {
      reference(errors, indexes, "products", item.productId, `${order._id}.items`, true);
    }
  }
  for (const request of tables.reviewRequests) {
    reference(errors, indexes, "orders", request.orderId, `${request._id}.orderId`);
    reference(errors, indexes, "businesses", request.businessId, `${request._id}.businessId`);
    for (const product of request.products ?? []) {
      reference(errors, indexes, "products", product.productId, `${request._id}.products`);
      storageReference(errors, storageIds, product.imageId, `${request._id}.products.imageId`, true);
    }
  }
  for (const upload of tables.reviewUploads) {
    reference(
      errors,
      indexes,
      "reviewRequests",
      upload.reviewRequestId,
      `${upload._id}.reviewRequestId`,
    );
    storageReference(errors, storageIds, upload.storageId, `${upload._id}.storageId`);
  }
  for (const review of tables.productReviews) {
    reference(errors, indexes, "reviewRequests", review.reviewRequestId, `${review._id}.reviewRequestId`);
    reference(errors, indexes, "orders", review.orderId, `${review._id}.orderId`);
    reference(errors, indexes, "businesses", review.businessId, `${review._id}.businessId`);
    reference(errors, indexes, "products", review.productId, `${review._id}.productId`);
    reference(errors, indexes, "users", review.moderatedBy, `${review._id}.moderatedBy`, true);
    for (const storageId of review.imageIds ?? []) {
      storageReference(errors, storageIds, storageId, `${review._id}.imageIds`);
    }
  }
  for (const stats of tables.productReviewStats) {
    reference(errors, indexes, "products", stats.productId, `${stats._id}.productId`);
    reference(errors, indexes, "businesses", stats.businessId, `${stats._id}.businessId`);
  }
  for (const view of tables.pageViews) {
    reference(errors, indexes, "businesses", view.businessId, `${view._id}.businessId`);
  }
  for (const view of [...tables.productViews, ...tables.productShares]) {
    reference(errors, indexes, "businesses", view.businessId, `${view._id}.businessId`);
    reference(errors, indexes, "products", view.productId, `${view._id}.productId`);
  }

  for (const metadata of storage) {
    const sourceFile = storageSourceFile(exportDirectory, metadata);
    if (!existsSync(sourceFile)) {
      errors.push(`missing exported storage object ${metadata._id}`);
    }
  }
  if (!tables.users.length) warnings.push("users is empty; ownership cannot be migrated");
  if (!tables.businesses.length) warnings.push("businesses is empty");

  return {
    counts: {
      ...Object.fromEntries(
        APPLICATION_TABLES.map((table) => [table, tables[table].length]),
      ),
      _storage: storage.length,
    },
    errors,
    warnings,
  };
}

function storageSourceFile(exportDirectory, metadata) {
  const storageDirectory = path.join(exportDirectory, "_storage");
  const exact = path.join(storageDirectory, metadata._id);
  if (existsSync(exact)) return exact;
  const matchingName = readdirSync(storageDirectory).find(
    (name) => name.startsWith(`${metadata._id}.`),
  );
  return matchingName
    ? path.join(storageDirectory, matchingName)
    : exact;
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalValue(value[key])]),
    );
  }
  return value;
}

export function checksum(value) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalValue(value)))
    .digest("hex");
}

function downloadToken(secret, storageId) {
  if (!secret) return `dry-run-${storageId}`;
  const digest = createHmac("sha256", secret)
    .update(`convex-storage:${storageId}`)
    .digest("hex");
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-${digest.slice(12, 16)}-${digest.slice(16, 20)}-${digest.slice(20, 32)}`;
}

function storageUrl(bucket, objectPath, token, visibility = "private") {
  if (visibility === "public") {
    return `https://storage.googleapis.com/${encodeURIComponent(bucket)}/${objectPath
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/")}`;
  }
  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectPath)}?alt=media&token=${encodeURIComponent(token)}`;
}

function assignStorageOwner(owners, storageId, businessId, visibility) {
  if (!storageId || !businessId) return;
  const current = owners.get(storageId);
  if (current && current.businessId !== businessId) {
    throw new Error(
      `Storage object ${storageId} is referenced by businesses ${current.businessId} and ${businessId}`,
    );
  }
  owners.set(storageId, {
    businessId,
    visibility:
      current?.visibility === "public" || visibility === "public"
        ? "public"
        : "private",
  });
}

function storagePlan(snapshot, bucket, tokenSecret) {
  const owners = new Map();
  const requests = tableIndex(snapshot.tables, "reviewRequests");
  for (const business of snapshot.tables.businesses) {
    assignStorageOwner(owners, business.logoId, business._id, "public");
    assignStorageOwner(owners, business.fssaiDocId, business._id, "private");
  }
  for (const product of snapshot.tables.products) {
    for (const storageId of product.imageIds ?? []) {
      assignStorageOwner(owners, storageId, product.businessId, "public");
    }
    assignStorageOwner(
      owners,
      product.sizeGuideImageId,
      product.businessId,
      "public",
    );
  }
  for (const request of snapshot.tables.reviewRequests) {
    for (const product of request.products ?? []) {
      assignStorageOwner(owners, product.imageId, request.businessId, "public");
    }
  }
  for (const upload of snapshot.tables.reviewUploads) {
    const request = requests.get(upload.reviewRequestId);
    assignStorageOwner(owners, upload.storageId, request?.businessId, "public");
  }
  for (const review of snapshot.tables.productReviews) {
    for (const storageId of review.imageIds ?? []) {
      assignStorageOwner(owners, storageId, review.businessId, "public");
    }
  }

  return new Map(
    snapshot.storage.map((metadata) => {
      const owner = owners.get(metadata._id);
      const objectPath = owner
        ? `businesses/${owner.businessId}/${owner.visibility}/migrated/${metadata._id}`
        : `migrations/convex/orphan/${metadata._id}`;
      const token = downloadToken(tokenSecret, metadata._id);
      return [
        metadata._id,
        {
          businessId: owner?.businessId ?? null,
          contentType: metadata.contentType ?? "application/octet-stream",
          objectPath,
          sourceChecksum: metadata.sha256 ?? metadata.storageId ?? null,
          sourceFile: storageSourceFile(snapshot.exportDirectory, metadata),
          token,
          url: storageUrl(bucket, objectPath, token, owner?.visibility ?? "private"),
          visibility: owner?.visibility ?? "private",
        },
      ];
    }),
  );
}

function mappedStorage(plan, id) {
  if (!id) return undefined;
  const mapped = plan.get(id);
  if (!mapped) throw new Error(`Storage mapping is missing for ${id}`);
  return mapped;
}

function migrationDocument(table, document, transformed) {
  const withoutMarker = structuredClone(transformed);
  delete withoutMarker._migration;
  return {
    ...withoutMarker,
    _migration: {
      checksum: checksum(withoutMarker),
      source: "convex",
      sourceId: document._id,
      sourceTable: table,
    },
  };
}

export function transformConvexExport(
  snapshot,
  { bucket = "dry-run.appspot.com", tokenSecret = "" } = {},
) {
  const plan = storagePlan(snapshot, bucket, tokenSecret);
  const productUrls = new Map();
  const transformed = Object.fromEntries(
    APPLICATION_TABLES.map((table) => [table, []]),
  );

  for (const document of snapshot.tables.users) {
    const user = structuredClone(document);
    user.email = String(user.email ?? "").trim().toLowerCase();
    user.legacyClerkId = user.clerkId;
    user.legacyConvexId = user._id;
    user.migrationPendingLink = true;
    delete user.clerkId;
    transformed.users.push(migrationDocument("users", document, user));
  }
  for (const document of snapshot.tables.businesses) {
    const business = structuredClone(document);
    business.isEnabled = business.isEnabled !== false;
    if (business.logoId) {
      const logo = mappedStorage(plan, business.logoId);
      business.logoId = logo.objectPath;
      business.logoUrl = logo.url;
    }
    if (business.fssaiDocId) {
      const fssai = mappedStorage(plan, business.fssaiDocId);
      business.fssaiDocId = fssai.objectPath;
      business.fssaiDocUrl = fssai.url;
    }
    transformed.businesses.push(
      migrationDocument("businesses", document, business),
    );
  }
  for (const document of snapshot.tables.products) {
    const product = structuredClone(document);
    const images = (product.imageIds ?? []).map((id) => mappedStorage(plan, id));
    product.imageIds = images.map((image) => image.objectPath);
    product.imageUrls = images.map((image) => image.url);
    productUrls.set(product._id, product.imageUrls);
    if (product.sizeGuideImageId) {
      const guide = mappedStorage(plan, product.sizeGuideImageId);
      product.sizeGuideImageId = guide.objectPath;
      product.sizeGuideImageUrl = guide.url;
    }
    transformed.products.push(migrationDocument("products", document, product));
  }

  const directTables = [
    "categories",
    "businessVariationOptions",
    "catalogs",
    "carts",
    "productReviewStats",
    "pageViews",
    "productViews",
    "productShares",
  ];
  for (const table of directTables) {
    transformed[table] = snapshot.tables[table].map((document) =>
      migrationDocument(table, document, structuredClone(document)),
    );
  }
  transformed.orders = snapshot.tables.orders.map((document) => {
    const order = structuredClone(document);
    order.items = (order.items ?? []).map((item) => ({
      ...item,
      image: item.productId
        ? productUrls.get(item.productId)?.[0] ?? item.image
        : item.image,
    }));
    return migrationDocument("orders", document, order);
  });
  transformed.reviewRequests = snapshot.tables.reviewRequests.map((document) => {
    const request = structuredClone(document);
    request.products = (request.products ?? []).map((product) => {
      const image = product.imageId ? mappedStorage(plan, product.imageId) : null;
      return {
        ...product,
        ...(image
          ? { imageId: image.objectPath, imageUrl: image.url }
          : { imageUrl: productUrls.get(product.productId)?.[0] ?? null }),
      };
    });
    return migrationDocument("reviewRequests", document, request);
  });
  transformed.reviewUploads = snapshot.tables.reviewUploads.map((document) => {
    const upload = structuredClone(document);
    upload.storageId = mappedStorage(plan, upload.storageId).objectPath;
    return migrationDocument("reviewUploads", document, upload);
  });
  transformed.productReviews = snapshot.tables.productReviews.map((document) => {
    const review = structuredClone(document);
    const images = (review.imageIds ?? []).map((id) => mappedStorage(plan, id));
    review.imageIds = images.map((image) => image.objectPath);
    review.imageUrls = images.map((image) => image.url);
    return migrationDocument("productReviews", document, review);
  });

  return { storagePlan: plan, tables: transformed };
}

export function migrationManifest(snapshot, transformed) {
  return {
    sourceCounts: Object.fromEntries(
      APPLICATION_TABLES.map((table) => [table, snapshot.tables[table].length]),
    ),
    storageCount: snapshot.storage.length,
    targetChecksums: Object.fromEntries(
      APPLICATION_TABLES.map((table) => [
        table,
        checksum(transformed.tables[table]),
      ]),
    ),
  };
}
