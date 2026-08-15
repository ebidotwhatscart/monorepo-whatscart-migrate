import { NextResponse, type NextRequest } from "next/server";

import { getAdminAuth, getAdminFirestore } from "@/lib/firebase/admin";
import {
  FirebaseRequestAuthError,
  verifyFirebaseRequest,
} from "@/lib/firebase/server-auth";

const noStoreHeaders = {
  "cache-control": "private, no-cache, no-store, max-age=0, must-revalidate",
  "cdn-cache-control": "no-store",
  "vercel-cdn-cache-control": "no-store",
};

function configuredSuperAdminEmails() {
  return (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function POST(request: NextRequest) {
  const auth = getAdminAuth();
  const firestore = getAdminFirestore();
  if (!auth || !firestore) {
    return NextResponse.json(
      { error: "Firebase Admin is not configured." },
      { status: 503, headers: noStoreHeaders },
    );
  }

  try {
    const identity = await verifyFirebaseRequest(request);
    const email = String(identity.email ?? "").trim().toLowerCase();
    const userRef = firestore.collection("users").doc(identity.uid);
    const existing = await userRef.get();
    const existingData = existing.data();
    const isSuperAdmin =
      existingData?.role === "super_admin" ||
      configuredSuperAdminEmails().includes(email);
    const role = isSuperAdmin ? "super_admin" : "user";
    const createdAt =
      typeof existingData?.createdAt === "number"
        ? existingData.createdAt
        : Date.now();
    await userRef.set(
      {
        _creationTime: createdAt,
        createdAt,
        email,
        firebaseUid: identity.uid,
        name:
          typeof identity.name === "string" && identity.name
            ? identity.name
            : existingData?.name ?? null,
        role,
        updatedAt: Date.now(),
      },
      { merge: true },
    );

    const authUser = await auth.getUser(identity.uid);
    const claims = authUser.customClaims ?? {};
    const refreshToken =
      isSuperAdmin && claims.super_admin !== true;
    if (refreshToken) {
      await auth.setCustomUserClaims(identity.uid, {
        ...claims,
        super_admin: true,
      });
    }

    return NextResponse.json(
      {
        refreshToken,
        user: {
          ...existingData,
          _creationTime: createdAt,
          _id: identity.uid,
          createdAt,
          email,
          firebaseUid: identity.uid,
          name:
            typeof identity.name === "string" && identity.name
              ? identity.name
              : existingData?.name ?? null,
          role,
        },
      },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    const status =
      error instanceof FirebaseRequestAuthError ? error.status : 400;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "User setup failed." },
      { status, headers: noStoreHeaders },
    );
  }
}
