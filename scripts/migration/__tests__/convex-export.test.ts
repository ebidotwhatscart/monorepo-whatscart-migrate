import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  loadConvexExport,
  transformConvexExport,
  validateConvexExport,
} from "../convex-export.mjs";

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "whatscart-convex-export-"));
  const tables: Record<string, unknown[]> = {
    users: [
      {
        _creationTime: 1,
        _id: "user-1",
        clerkId: "clerk-1",
        email: "OWNER@EXAMPLE.TEST",
        role: "user",
      },
    ],
    businesses: [
      {
        _creationTime: 2,
        _id: "business-1",
        businessType: "garments",
        logoId: "storage-1",
        name: "Store",
        ownerId: "user-1",
        slug: "store",
        themeColor: "#112233",
        whatsappPhone: "919876543210",
      },
    ],
    categories: [],
    products: [
      {
        _creationTime: 3,
        _id: "product-1",
        businessId: "business-1",
        description: "Product",
        imageIds: ["storage-1"],
        inStock: true,
        name: "Product",
        price: 100,
        searchableText: "product",
      },
    ],
  };
  for (const [table, documents] of Object.entries(tables)) {
    await mkdir(path.join(root, table), { recursive: true });
    await writeFile(
      path.join(root, table, "documents.jsonl"),
      documents.map((document) => JSON.stringify(document)).join("\n"),
    );
  }
  await mkdir(path.join(root, "_storage"), { recursive: true });
  await writeFile(
    path.join(root, "_storage", "documents.jsonl"),
    `${JSON.stringify({ _id: "storage-1", contentType: "image/png" })}\n`,
  );
  await writeFile(path.join(root, "_storage", "storage-1"), "image-data");
  return root;
}

describe("Convex export migration", () => {
  it("validates references and transforms IDs, ownership, and storage URLs", async () => {
    const snapshot = await loadConvexExport(await fixture());
    expect(validateConvexExport(snapshot).errors).toEqual([]);

    const target = transformConvexExport(snapshot, {
      bucket: "target.appspot.com",
      tokenSecret: "migration-test-secret-with-at-least-32-characters",
    });
    expect(target.tables.users[0]).toMatchObject({
      email: "owner@example.test",
      legacyClerkId: "clerk-1",
      legacyConvexId: "user-1",
      migrationPendingLink: true,
    });
    expect(target.tables.users[0]).not.toHaveProperty("clerkId");
    expect(target.tables.businesses[0]).toMatchObject({
      isEnabled: true,
      logoId: "businesses/business-1/public/migrated/storage-1",
    });
    expect(target.tables.products[0].imageIds).toEqual([
      "businesses/business-1/public/migrated/storage-1",
    ]);
    expect(target.tables.products[0].imageUrls[0]).toContain(
      "target.appspot.com",
    );
    expect(target.tables.products[0]._migration).toMatchObject({
      source: "convex",
      sourceId: "product-1",
    });
  });

  it("rejects a broken relationship before any write", async () => {
    const snapshot = await loadConvexExport(await fixture());
    snapshot.tables.products[0].businessId = "missing-business";
    expect(validateConvexExport(snapshot).errors).toContain(
      "product-1.businessId references missing businesses/missing-business",
    );
  });
});
