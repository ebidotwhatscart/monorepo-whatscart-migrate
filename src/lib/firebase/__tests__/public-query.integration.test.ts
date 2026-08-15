// @vitest-environment node

import { beforeAll, describe, expect, it } from "vitest";
import type { Firestore as AdminFirestore } from "firebase-admin/firestore";

const emulatorAvailable = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const describeWithEmulator = emulatorAvailable ? describe : describe.skip;

if (emulatorAvailable) {
  process.env.FIREBASE_PROJECT_ID = "demo-whatscart";
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "demo-key";
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "demo-whatscart.firebaseapp.com";
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-whatscart";
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "demo-whatscart.appspot.com";
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID = "demo-app";
  process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATORS = "true";
}

type Observer = typeof import("../public-query").observeFirebasePublicQuery;

let observeQuery: Observer;
let firebaseClient: NonNullable<
  ReturnType<typeof import("../client").getFirebaseClient>
>;
let adminFirestore: AdminFirestore;

function firstValue(functionName: string, args: Record<string, unknown>) {
  return new Promise<unknown>((resolve, reject) => {
    let unsubscribe = () => undefined;
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error(`Timed out waiting for ${functionName}`));
    }, 5_000);
    unsubscribe = observeQuery(
      functionName,
      args,
      (value) => {
        clearTimeout(timeout);
        queueMicrotask(unsubscribe);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        unsubscribe();
        reject(error);
      },
    );
  });
}

describeWithEmulator("Firebase public query adapter", () => {
  beforeAll(async () => {
    const admin = await import("../admin");
    const firestore = admin.getAdminFirestore();
    if (!firestore) {
      throw new Error("Firebase Admin emulator configuration failed.");
    }
    adminFirestore = firestore;

    await Promise.all([
    firestore.collection("businesses").doc("business-1").set({
      _creationTime: 1,
      businessType: "clothing",
      featuredProductIds: ["product-1"],
      isEnabled: true,
      logoUrl: "https://example.test/logo.png",
      name: "Demo Store",
      ownerId: "owner-1",
      slug: "demo-store",
      themeColor: "#112233",
      whatsappPhone: "+919999999999",
    }),
    firestore.collection("businesses").doc("business-disabled").set({
      isEnabled: false,
      name: "Disabled Store",
      ownerId: "owner-2",
      slug: "disabled-store",
    }),
    firestore.collection("categories").doc("category-1").set({
      _creationTime: 2,
      businessId: "business-1",
      name: "Featured",
      order: 1,
    }),
    firestore.collection("products").doc("product-1").set({
      _creationTime: 3,
      businessId: "business-1",
      categoryId: "category-1",
      description: "A green handmade shirt",
      imageUrls: ["https://example.test/product.png"],
      inStock: true,
      name: "Green Shirt",
      price: 899,
      searchableText: "green shirt handmade",
      slug: "green-shirt",
      variantGroupId: "variants-1",
    }),
    firestore.collection("products").doc("product-2").set({
      _creationTime: 4,
      businessId: "business-1",
      categoryId: "category-1",
      description: "A blue handmade shirt",
      imageUrls: [],
      inStock: true,
      name: "Blue Shirt",
      price: 799,
      searchableText: "blue shirt handmade",
      slug: "blue-shirt",
      variantGroupId: "variants-1",
    }),
    firestore.collection("catalogs").doc("catalog-document-1").set({
      _creationTime: 5,
      businessId: "business-1",
      catalogId: "summer",
      name: "Summer",
      productIds: ["product-1"],
    }),
    firestore.collection("productReviewStats").doc("stats-1").set({
      approvedCount: 1,
      businessId: "business-1",
      productId: "product-1",
      ratingSum: 5,
      ratings1: 0,
      ratings2: 0,
      ratings3: 0,
      ratings4: 0,
      ratings5: 1,
    }),
    firestore.collection("productReviews").doc("review-1").set({
      businessId: "business-1",
      comment: "Excellent",
      customerName: "Alex Customer",
      imageUrls: [],
      productId: "product-1",
      rating: 5,
      status: "approved",
      submittedAt: 10,
    }),
    firestore.collection("productReviews").doc("review-draft").set({
      businessId: "business-1",
      comment: "Private draft",
      customerName: "Private Customer",
      imageUrls: [],
      productId: "product-1",
      rating: 2,
      status: "pending",
      submittedAt: 11,
    }),
    firestore.collection("carts").doc("private-cart").set({
      businessId: "business-1",
      cartId: "private-cart",
    }),
    firestore.collection("orders").doc("private-order").set({
      businessId: "business-1",
      orderId: "private-order",
    }),
    ]);

    ({ observeFirebasePublicQuery: observeQuery } = await import("../public-query"));
    const client = (await import("../client")).getFirebaseClient();
    if (!client) throw new Error("Firebase client emulator configuration failed.");
    firebaseClient = client;
  });

  it("preserves public business and product shapes", async () => {
    const business = (await firstValue("businesses:getBusinessBySlug", {
      slug: "demo-store",
    })) as Record<string, unknown>;
    expect(business).toMatchObject({
      _id: "business-1",
      businessType: "garments",
      name: "Demo Store",
    });

    const products = (await firstValue("products:getPublicProducts", {
      businessId: "business-1",
    })) as Array<Record<string, unknown>>;
    expect(products).toHaveLength(2);
    expect(products[0]).toMatchObject({
      category: expect.objectContaining({ _id: "category-1" }),
      imageUrls: expect.any(Array),
    });

    await expect(
      firstValue("businesses:getBusinessBySlug", {
        slug: "disabled-store",
      }),
    ).resolves.toBeNull();
  });

  it("supports storefront search, featured products, variants, and slugs", async () => {
    const search = (await firstValue("products:searchProducts", {
      businessId: "business-1",
      searchTerm: "green",
    })) as Array<Record<string, unknown>>;
    expect(search.map((product) => product._id)).toEqual(["product-1"]);

    const featured = (await firstValue("businesses:getFeaturedProducts", {
      businessId: "business-1",
    })) as Array<Record<string, unknown>>;
    expect(featured.map((product) => product._id)).toEqual(["product-1"]);

    const variants = (await firstValue("products:getProductVariants", {
      businessId: "business-1",
      productId: "product-1",
    })) as Array<Record<string, unknown>>;
    expect(variants).toHaveLength(2);

    const product = (await firstValue("products:getPublicProductBySlug", {
      productSlug: "green-shirt",
      slug: "demo-store",
    })) as Record<string, unknown>;
    expect(product._id).toBe("product-1");
  });

  it("pushes published business updates to an open storefront without a refresh", async () => {
    const observedNames: string[] = [];

    try {
      await new Promise<void>((resolve, reject) => {
        let unsubscribe = () => undefined;
        const timeout = setTimeout(() => {
          unsubscribe();
          reject(new Error("Timed out waiting for the live storefront update."));
        }, 10_000);

        unsubscribe = observeQuery(
          "businesses:getBusinessBySlug",
          { slug: "demo-store" },
          (value) => {
            const name = (value as { name?: string } | null)?.name;
            if (!name || observedNames.at(-1) === name) return;
            observedNames.push(name);
            if (name === "Demo Store") {
              void adminFirestore
                .collection("businesses")
                .doc("business-1")
                .update({ name: "Demo Store Live" })
                .catch(reject);
            } else if (name === "Demo Store Live") {
              clearTimeout(timeout);
              unsubscribe();
              resolve();
            }
          },
          reject,
        );
      });

      expect(observedNames).toEqual(["Demo Store", "Demo Store Live"]);
    } finally {
      await adminFirestore
        .collection("businesses")
        .doc("business-1")
        .update({ name: "Demo Store" });
    }
  }, 15_000);

  it("hydrates categories, catalogs, related products, and approved reviews", async () => {
    const categories = (await firstValue("categories:getPublicCategories", {
      businessId: "business-1",
    })) as Array<Record<string, unknown>>;
    expect(categories.map((category) => category._id)).toEqual(["category-1"]);

    const catalog = (await firstValue("catalogs:getPublicCatalog", {
      catalogId: "summer",
      slug: "demo-store",
    })) as Record<string, unknown>;
    expect(catalog).toMatchObject({
      business: expect.objectContaining({ _id: "business-1" }),
      products: [expect.objectContaining({ _id: "product-1" })],
    });

    const related = (await firstValue("products:getRelatedProducts", {
      businessId: "business-1",
      categoryId: "category-1",
      excludeProductId: "product-1",
      limit: 5,
    })) as Array<Record<string, unknown>>;
    expect(related.map((product) => product._id)).toEqual(["product-2"]);

    const reviews = (await firstValue("reviews:getApprovedProductReviews", {
      productId: "product-1",
    })) as Record<string, unknown>;
    expect(reviews).toMatchObject({
      reviews: [expect.objectContaining({ displayName: "Alex C." })],
      stats: expect.objectContaining({ approvedCount: 1, averageRating: 5 }),
    });
  });

  it("denies public reads from private cart and order collections", async () => {
    const { doc, getDoc } = await import("firebase/firestore");
    await expect(
      getDoc(doc(firebaseClient.firestore, "carts", "private-cart")),
    ).rejects.toMatchObject({ code: "permission-denied" });
    await expect(
      getDoc(doc(firebaseClient.firestore, "orders", "private-order")),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });
});
