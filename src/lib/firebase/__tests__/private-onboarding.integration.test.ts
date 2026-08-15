// @vitest-environment node

import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it } from "vitest";
import type { Firestore } from "firebase-admin/firestore";

const emulatorAvailable = Boolean(
  process.env.FIREBASE_AUTH_EMULATOR_HOST &&
    process.env.FIRESTORE_EMULATOR_HOST &&
    process.env.FIREBASE_STORAGE_EMULATOR_HOST,
);
const describeWithEmulator = emulatorAvailable ? describe : describe.skip;

if (emulatorAvailable) {
  process.env.FIREBASE_PROJECT_ID = "demo-whatscart";
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-whatscart";
  process.env.FIREBASE_STORAGE_BUCKET = "demo-whatscart.appspot.com";
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET =
    "demo-whatscart.appspot.com";
  process.env.FIREBASE_UPLOAD_SECRET =
    "private-onboarding-upload-secret-at-least-32-chars";
  process.env.SUPER_ADMIN_EMAILS = "configured-admin@example.test";
}

type EmulatorIdentity = {
  email: string;
  idToken: string;
  localId: string;
  password: string;
};

let firestore: Firestore;
let owner: EmulatorIdentity;
let otherUser: EmulatorIdentity;
let ownerCookie = "";
let uploadedLogoId = "";
let uploadedFssaiDocId = "";
let createdBusinessId = "";

async function inventoryMutation(
  identity: EmulatorIdentity | null,
  operation: string,
  args: Record<string, unknown>,
) {
  const { POST } = await import("../../../app/api/private/inventory/route");
  const init: RequestInit = {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ args, operation }),
  };
  return POST(
    identity
      ? authorizedRequest(
          "http://app.whatscart.in/api/private/inventory",
          identity.idToken,
          init,
        )
      : new NextRequest(
          "http://app.whatscart.in/api/private/inventory",
          init,
        ),
  );
}

async function createIdentity(email: string): Promise<EmulatorIdentity> {
  const password = "Test-password-123!";
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST!;
  const response = await fetch(
    `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  if (!response.ok) throw new Error(await response.text());
  const identity = (await response.json()) as {
    email: string;
    idToken: string;
    localId: string;
  };
  return { ...identity, password };
}

function authorizedRequest(url: string, idToken: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${idToken}`);
  return new NextRequest(url, { ...init, headers });
}

function businessBody(logoId = uploadedLogoId) {
  return {
    address: {
      buildingNo: "10",
      country: "India",
      district: "Chennai",
      pincode: "600001",
      state: "Tamil Nadu",
      street: "Market Road",
      town: "Chennai",
    },
    brandPalette: {
      colors: ["#112233", "#ffffff", "#eef2f5"],
      mode: "light",
      primaryColor: "#112233",
      seedColor: "#112233",
    },
    businessType: "garments",
    description: "A Firebase onboarding store",
    logoId,
    name: "Firebase Onboarding Store",
    ownerName: "Owner Example",
    preferredLanguage: "English",
    serviceRegion: "Chennai",
    slug: "firebase-onboarding-store",
    themeColor: "#112233",
    whatsappPhone: "9876543210",
  };
}

describeWithEmulator("Firebase private onboarding", () => {
  beforeAll(async () => {
    const admin = await import("../admin");
    const nextFirestore = admin.getAdminFirestore();
    if (!nextFirestore) throw new Error("Firestore emulator is unavailable.");
    firestore = nextFirestore;
    [owner, otherUser] = await Promise.all([
      createIdentity("owner@example.test"),
      createIdentity("other-owner@example.test"),
    ]);
  });

  it("bootstraps the Firebase user and establishes an HTTP-only session", async () => {
    const { POST: bootstrap } = await import(
      "../../../app/api/auth/bootstrap/route"
    );
    const bootstrapResponse = await bootstrap(
      authorizedRequest(
        "http://app.whatscart.in/api/auth/bootstrap",
        owner.idToken,
        { method: "POST" },
      ),
    );
    expect(bootstrapResponse.status).toBe(200);
    await expect(bootstrapResponse.json()).resolves.toMatchObject({
      refreshToken: false,
      user: {
        _id: owner.localId,
        email: owner.email,
        role: "user",
      },
    });
    await expect(
      firestore.collection("users").doc(owner.localId).get(),
    ).resolves.toMatchObject({ exists: true });

    const { POST: createSession } = await import(
      "../../../app/api/auth/session/route"
    );
    const sessionResponse = await createSession(
      authorizedRequest(
        "http://app.whatscart.in/api/auth/session",
        owner.idToken,
        { method: "POST" },
      ),
    );
    expect(sessionResponse.status).toBe(200);
    const setCookie = sessionResponse.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("__session=");
    expect(setCookie.toLowerCase()).toContain("httponly");
    ownerCookie = setCookie.split(";")[0];
  });

  it("prevents a signed-in user from assigning their own role", async () => {
    const { initializeApp, deleteApp } = await import("firebase/app");
    const {
      connectAuthEmulator,
      getAuth,
      signInWithEmailAndPassword,
    } = await import("firebase/auth");
    const {
      connectFirestoreEmulator,
      doc,
      getFirestore,
      setDoc,
    } = await import("firebase/firestore");
    const app = initializeApp(
      { apiKey: "demo-key", projectId: "demo-whatscart" },
      `onboarding-rules-${Date.now()}`,
    );
    const auth = getAuth(app);
    const [authHost, authPort] =
      process.env.FIREBASE_AUTH_EMULATOR_HOST!.split(":");
    connectAuthEmulator(auth, `http://${authHost}:${authPort}`, {
      disableWarnings: true,
    });
    const clientFirestore = getFirestore(app);
    const [firestoreHost, firestorePort] =
      process.env.FIRESTORE_EMULATOR_HOST!.split(":");
    connectFirestoreEmulator(
      clientFirestore,
      firestoreHost,
      Number(firestorePort),
    );
    await signInWithEmailAndPassword(auth, owner.email, owner.password);
    await expect(
      setDoc(
        doc(clientFirestore, "users", owner.localId),
        { role: "super_admin" },
        { merge: true },
      ),
    ).rejects.toMatchObject({ code: "permission-denied" });
    await deleteApp(app);
  });

  it("authorizes and stores an owner-scoped onboarding logo", async () => {
    const { POST: authorizeUpload } = await import(
      "../../../app/api/private/uploads/authorize/route"
    );
    const authorization = await authorizeUpload(
      authorizedRequest(
        "http://app.whatscart.in/api/private/uploads/authorize",
        owner.idToken,
        { method: "POST" },
      ),
    );
    expect(authorization.status).toBe(200);
    const { uploadUrl } = (await authorization.json()) as {
      uploadUrl: string;
    };

    const { POST: upload } = await import(
      "../../../app/api/public/uploads/route"
    );
    const uploadResponse = await upload(
      new NextRequest(uploadUrl, {
        method: "POST",
        headers: { "content-type": "image/png" },
        body: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      }),
    );
    expect(uploadResponse.status).toBe(200);
    ({ storageId: uploadedLogoId } = (await uploadResponse.json()) as {
      storageId: string;
    });
    expect(uploadedLogoId).toMatch(
      /^user-uploads\/[a-f0-9]{64}\/[0-9a-f-]{36}$/,
    );

    const pdfAuthorization = await authorizeUpload(
      authorizedRequest(
        "http://app.whatscart.in/api/private/uploads/authorize",
        owner.idToken,
        { method: "POST" },
      ),
    );
    expect(pdfAuthorization.status).toBe(200);
    const { uploadUrl: pdfUploadUrl } = (await pdfAuthorization.json()) as {
      uploadUrl: string;
    };
    const pdfUpload = await upload(
      new NextRequest(pdfUploadUrl, {
        method: "POST",
        headers: { "content-type": "application/pdf" },
        body: new TextEncoder().encode("%PDF-1.7\nWhatsCart FSSAI test\n"),
      }),
    );
    expect(pdfUpload.status).toBe(200);
    ({ storageId: uploadedFssaiDocId } = (await pdfUpload.json()) as {
      storageId: string;
    });
    expect(uploadedFssaiDocId).toMatch(
      /^user-uploads\/[a-f0-9]{64}\/[0-9a-f-]{36}$/,
    );
  });

  it("creates one owned business and makes its slug unavailable", async () => {
    const { POST: createBusiness } = await import(
      "../../../app/api/private/businesses/route"
    );
    const response = await createBusiness(
      authorizedRequest(
        "http://app.whatscart.in/api/private/businesses",
        owner.idToken,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(businessBody()),
        },
      ),
    );
    expect(response.status).toBe(200);
    createdBusinessId = (await response.json()) as string;
    const business = await firestore
      .collection("businesses")
      .doc(createdBusinessId)
      .get();
    expect(business.data()).toMatchObject({
      isEnabled: true,
      logoId: uploadedLogoId,
      logoUrl: expect.stringContaining("127.0.0.1:9199"),
      name: "Firebase Onboarding Store",
      orderSequence: 0,
      ownerId: owner.localId,
      slug: "firebase-onboarding-store",
      whatsappPhone: "919876543210",
    });

    const { GET: slugAvailability } = await import(
      "../../../app/api/private/businesses/slug-availability/route"
    );
    const slugResponse = await slugAvailability(
      new NextRequest(
        "http://app.whatscart.in/api/private/businesses/slug-availability?slug=firebase-onboarding-store",
        { headers: { cookie: ownerCookie } },
      ),
    );
    expect(slugResponse.status).toBe(200);
    await expect(slugResponse.json()).resolves.toBe(false);
  });

  it("updates owned settings and resolves scoped logo and FSSAI assets", async () => {
    const { PATCH: updateBusiness } = await import(
      "../../../app/api/private/businesses/route"
    );
    const settings = {
      address: {
        buildingNo: "22",
        country: "India",
        district: "Chennai",
        pincode: "600002",
        state: "Tamil Nadu",
        street: "Updated Market Road",
        town: "Chennai",
      },
      brandPalette: {
        colors: ["#225577", "#ffffff", "#eaf4f6"],
        mode: "light",
        primaryColor: "#225577",
        seedColor: "#225577",
      },
      businessId: createdBusinessId,
      description: "Updated Firebase business settings",
      featuredProductIds: [],
      fssaiDocId: uploadedFssaiDocId,
      fssaiNumber: "12345678901234",
      logoId: uploadedLogoId,
      name: "Updated Firebase Store",
      ownerName: "Updated Owner",
      serviceRegion: "Greater Chennai",
      shippingBannerText: "Same-day delivery in Chennai",
      socialLinks: {
        facebook: "https://facebook.example/store",
        instagram: "https://instagram.example/store",
        threads: "https://threads.example/store",
        x: "https://x.example/store",
      },
      themeColor: "#225577",
      upiId: "owner@upi",
      whatsappPhone: "9876543210",
    };
    const response = await updateBusiness(
      authorizedRequest(
        "http://app.whatscart.in/api/private/businesses",
        owner.idToken,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(settings),
        },
      ),
    );
    expect(response.status).toBe(200);
    const business = await firestore
      .collection("businesses")
      .doc(createdBusinessId)
      .get();
    expect(business.data()).toMatchObject({
      address: { buildingNo: "22", pincode: "600002" },
      description: "Updated Firebase business settings",
      featuredProductIds: [],
      fssaiDocId: uploadedFssaiDocId,
      fssaiDocUrl: expect.stringContaining("127.0.0.1:9199"),
      fssaiNumber: "12345678901234",
      logoId: uploadedLogoId,
      logoUrl: expect.stringContaining("127.0.0.1:9199"),
      name: "Updated Firebase Store",
      ownerName: "Updated Owner",
      serviceRegion: "Greater Chennai",
      shippingBannerText: "Same-day delivery in Chennai",
      socialLinks: {
        facebook: "https://facebook.example/store",
        instagram: "https://instagram.example/store",
      },
      themeColor: "#225577",
      upiId: "owner@upi",
      whatsappPhone: "919876543210",
    });

    const invalidFeaturedProduct = await updateBusiness(
      authorizedRequest(
        "http://app.whatscart.in/api/private/businesses",
        owner.idToken,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...settings,
            featuredProductIds: ["missing-product"],
          }),
        },
      ),
    );
    expect(invalidFeaturedProduct.status).toBe(400);

    const unauthorized = await updateBusiness(
      authorizedRequest(
        "http://app.whatscart.in/api/private/businesses",
        otherUser.idToken,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(settings),
        },
      ),
    );
    expect(unauthorized.status).toBe(400);
  });

  it("rejects duplicate ownership, cross-user logos, and anonymous creation", async () => {
    const { POST: bootstrap } = await import(
      "../../../app/api/auth/bootstrap/route"
    );
    await bootstrap(
      authorizedRequest(
        "http://app.whatscart.in/api/auth/bootstrap",
        otherUser.idToken,
        { method: "POST" },
      ),
    );
    const { POST: createBusiness } = await import(
      "../../../app/api/private/businesses/route"
    );
    const duplicate = await createBusiness(
      authorizedRequest(
        "http://app.whatscart.in/api/private/businesses",
        owner.idToken,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...businessBody(), slug: "another-store" }),
        },
      ),
    );
    expect(duplicate.status).toBe(400);

    const crossUser = await createBusiness(
      authorizedRequest(
        "http://app.whatscart.in/api/private/businesses",
        otherUser.idToken,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...businessBody(), slug: "other-store" }),
        },
      ),
    );
    expect(crossUser.status).toBe(400);

    const anonymous = await createBusiness(
      new NextRequest("http://app.whatscart.in/api/private/businesses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(businessBody()),
      }),
    );
    expect(anonymous.status).toBe(401);
    expect(createdBusinessId).toBeTruthy();
  });

  it("manages owned categories, catalogs, and variation options", async () => {
    await Promise.all([
      firestore.collection("products").doc("inventory-product-1").set({
        businessId: createdBusinessId,
        imageUrls: [],
        inStock: true,
        name: "Inventory Product One",
        price: 100,
      }),
      firestore.collection("products").doc("inventory-product-2").set({
        businessId: createdBusinessId,
        imageUrls: [],
        inStock: true,
        name: "Inventory Product Two",
        price: 200,
      }),
    ]);

    const firstCategoryResponse = await inventoryMutation(
      owner,
      "categories:createCategory",
      { businessId: createdBusinessId, name: "First Category" },
    );
    expect(firstCategoryResponse.status).toBe(200);
    const firstCategoryId = (await firstCategoryResponse.json()) as string;
    const secondCategoryResponse = await inventoryMutation(
      owner,
      "categories:createCategory",
      { businessId: createdBusinessId, name: "Second Category" },
    );
    const secondCategoryId = (await secondCategoryResponse.json()) as string;
    await firestore
      .collection("products")
      .doc("inventory-product-1")
      .update({ categoryId: firstCategoryId });

    const reorder = await inventoryMutation(
      owner,
      "categories:reorderCategories",
      {
        businessId: createdBusinessId,
        orderedIds: [secondCategoryId, firstCategoryId],
      },
    );
    expect(reorder.status).toBe(200);
    expect(
      (await firestore.collection("categories").doc(secondCategoryId).get()).data()
        ?.order,
    ).toBe(1);

    const catalogResponse = await inventoryMutation(
      owner,
      "catalogs:createCatalog",
      {
        businessId: createdBusinessId,
        name: "Owner Catalog",
        productIds: ["inventory-product-1", "inventory-product-2"],
      },
    );
    expect(catalogResponse.status).toBe(200);
    const { catalogId } = (await catalogResponse.json()) as {
      catalogId: string;
    };
    const catalogSnapshot = await firestore
      .collection("catalogs")
      .where("catalogId", "==", catalogId)
      .limit(1)
      .get();
    expect(catalogSnapshot).not.toMatchObject({ empty: true });
    const catalogDocumentId = catalogSnapshot.docs[0].id;
    const updateCatalog = await inventoryMutation(
      owner,
      "catalogs:updateCatalog",
      {
        catalogId: catalogDocumentId,
        name: "Updated Owner Catalog",
        productIds: ["inventory-product-2", "inventory-product-1"],
      },
    );
    expect(updateCatalog.status).toBe(200);

    await expect(
      inventoryMutation(
        owner,
        "businessVariationOptions:addCustomVariationType",
        { businessId: createdBusinessId, variantType: "Material" },
      ).then((response) => response.json()),
    ).resolves.toBe("Material");
    await expect(
      inventoryMutation(
        owner,
        "businessVariationOptions:addCustomVariationValue",
        {
          businessId: createdBusinessId,
          value: "Cotton",
          variantType: "Material",
        },
      ).then((response) => response.json()),
    ).resolves.toBe("Cotton");

    const deleteCategory = await inventoryMutation(
      owner,
      "categories:deleteCategory",
      { categoryId: firstCategoryId },
    );
    expect(deleteCategory.status).toBe(200);
    expect(
      (await firestore.collection("products").doc("inventory-product-1").get()).data(),
    ).not.toHaveProperty("categoryId");

    const deleteCatalog = await inventoryMutation(
      owner,
      "catalogs:deleteCatalog",
      { catalogId: catalogDocumentId },
    );
    expect(deleteCatalog.status).toBe(200);
    expect(
      (await firestore.collection("catalogs").doc(catalogDocumentId).get()).exists,
    ).toBe(false);
  });

  it("denies inventory mutations from another Firebase user", async () => {
    const response = await inventoryMutation(
      otherUser,
      "categories:createCategory",
      { businessId: createdBusinessId, name: "Unauthorized Category" },
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("access is denied"),
    });
  });

  it("creates, updates, authorizes, and deletes owner products", async () => {
    const categoryResponse = await inventoryMutation(
      owner,
      "categories:createCategory",
      { businessId: createdBusinessId, name: "Product Category" },
    );
    const categoryId = (await categoryResponse.json()) as string;
    const createResponse = await inventoryMutation(
      owner,
      "products:createProduct",
      {
        businessId: createdBusinessId,
        categoryId,
        description: "A Firebase managed garment",
        imageIds: [uploadedLogoId],
        inStock: true,
        name: "Firebase Product",
        price: 599,
        productTypeDetails: { audience: "unisex", sizeFormat: "alpha" },
        returnPolicy: {
          acceptedConditions: ["unused", "original_packaging"],
          returnable: true,
          returnWindowDays: 7,
        },
        sizeGuideImageId: uploadedLogoId,
        sizes: [{ price: 649, size: "L" }],
      },
    );
    expect(createResponse.status).toBe(200);
    const productId = (await createResponse.json()) as string;
    const created = await firestore.collection("products").doc(productId).get();
    expect(created.data()).toMatchObject({
      businessId: createdBusinessId,
      categoryId,
      imageIds: [uploadedLogoId],
      imageUrls: [expect.stringContaining("127.0.0.1:9199")],
      name: "Firebase Product",
      sizeGuideImageId: uploadedLogoId,
      sizeGuideImageUrl: expect.stringContaining("127.0.0.1:9199"),
      slug: "firebase-product",
    });

    const unauthorized = await inventoryMutation(
      otherUser,
      "products:updateProduct",
      {
        description: "Unauthorized",
        imageIds: [uploadedLogoId],
        inStock: false,
        name: "Unauthorized",
        price: 1,
        productId,
      },
    );
    expect(unauthorized.status).toBe(400);

    const updateResponse = await inventoryMutation(
      owner,
      "products:updateProduct",
      {
        categoryId,
        description: "Updated Firebase managed garment",
        imageIds: [uploadedLogoId],
        inStock: false,
        name: "Updated Firebase Product",
        price: 699,
        productId,
        productTypeDetails: { audience: "unisex", sizeFormat: "alpha" },
        returnPolicy: {
          acceptedConditions: ["unused"],
          returnable: true,
          returnWindowDays: 5,
        },
        sizes: [{ price: 749, size: "XL" }],
      },
    );
    expect(updateResponse.status).toBe(200);
    const updated = await firestore.collection("products").doc(productId).get();
    expect(updated.data()).toMatchObject({
      inStock: false,
      name: "Updated Firebase Product",
      price: 699,
      sizeGuideImageId: uploadedLogoId,
      slug: "firebase-product",
    });

    const catalogRef = firestore.collection("catalogs").doc();
    await Promise.all([
      catalogRef.set({
        businessId: createdBusinessId,
        catalogId: "delete-cleanup",
        createdAt: Date.now(),
        name: "Cleanup Catalog",
        productIds: [productId, "inventory-product-2"],
        updatedAt: Date.now(),
      }),
      firestore
        .collection("businesses")
        .doc(createdBusinessId)
        .update({ featuredProductIds: [productId] }),
    ]);
    const deleteResponse = await inventoryMutation(
      owner,
      "products:deleteProduct",
      { productId },
    );
    expect(deleteResponse.status).toBe(200);
    expect((await firestore.collection("products").doc(productId).get()).exists).toBe(
      false,
    );
    expect((await catalogRef.get()).data()?.productIds).toEqual([
      "inventory-product-2",
    ]);
    expect(
      (await firestore.collection("businesses").doc(createdBusinessId).get()).data()
        ?.featuredProductIds,
    ).toEqual([]);
  });
});
