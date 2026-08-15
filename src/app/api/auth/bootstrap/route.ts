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
    const now = Date.now();
    const existingData = await firestore.runTransaction(async (transaction) => {
      const current = await transaction.get(userRef);
      const currentData = current.data();
      const legacyUsers =
        email && identity.email_verified === true
          ? await transaction.get(
              firestore
                .collection("users")
                .where("email", "==", email)
                .limit(3),
            )
          : null;
      const legacyCandidates =
        legacyUsers?.docs.filter(
          (document) =>
            document.id !== identity.uid &&
            document.data().migrationPendingLink === true &&
            typeof document.data().legacyConvexId === "string",
        ) ?? [];
      if (legacyCandidates.length > 1) {
        throw new Error("Multiple migrated accounts use this email address.");
      }

      const legacy = legacyCandidates[0];
      const legacyData = legacy?.data();
      const ownedBusinesses = legacy
        ? await transaction.get(
            firestore
              .collection("businesses")
              .where("ownerId", "==", legacy.id),
          )
        : null;
      const createdAt =
        typeof currentData?.createdAt === "number"
          ? currentData.createdAt
          : typeof legacyData?.createdAt === "number"
            ? legacyData.createdAt
            : typeof legacyData?._creationTime === "number"
              ? legacyData._creationTime
              : now;
      const merged = {
        ...legacyData,
        ...currentData,
        _creationTime: createdAt,
        createdAt,
        email,
        firebaseUid: identity.uid,
        legacyConvexId:
          legacyData?.legacyConvexId ?? currentData?.legacyConvexId ?? null,
        migrationPendingLink: false,
        migratedAt: legacy ? now : currentData?.migratedAt ?? null,
        name:
          typeof identity.name === "string" && identity.name
            ? identity.name
            : currentData?.name ?? legacyData?.name ?? null,
        role: currentData?.role ?? legacyData?.role ?? "user",
        updatedAt: now,
      };

      transaction.set(userRef, merged, { merge: true });
      ownedBusinesses?.docs.forEach((business) => {
        transaction.update(business.ref, {
          ownerId: identity.uid,
          ownerMigratedAt: now,
        });
      });
      if (legacy) transaction.delete(legacy.ref);
      return merged;
    });
    const isSuperAdmin =
      existingData?.role === "super_admin" ||
      configuredSuperAdminEmails().includes(email);
    const role = isSuperAdmin ? "super_admin" : "user";
    const createdAt = Number(existingData.createdAt ?? now);
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
        updatedAt: now,
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
