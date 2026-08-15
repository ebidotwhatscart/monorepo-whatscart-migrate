import type { DecodedIdToken } from "firebase-admin/auth";
import type { NextRequest } from "next/server";

import { getAdminAuth } from "./admin";

export const FIREBASE_SESSION_COOKIE = "__session";

export class FirebaseRequestAuthError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 503,
  ) {
    super(message);
  }
}

export async function verifyFirebaseRequest(
  request: NextRequest,
): Promise<DecodedIdToken> {
  const auth = getAdminAuth();
  if (!auth) {
    throw new FirebaseRequestAuthError(
      "Firebase Authentication is not configured.",
      503,
    );
  }

  const authorization = request.headers.get("authorization");
  const idToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  try {
    if (idToken) return await auth.verifyIdToken(idToken, true);
    const sessionCookie = request.cookies.get(FIREBASE_SESSION_COOKIE)?.value;
    if (sessionCookie) {
      return await auth.verifySessionCookie(sessionCookie, true);
    }
  } catch {
    throw new FirebaseRequestAuthError("Firebase session is invalid.", 401);
  }

  throw new FirebaseRequestAuthError("Authentication is required.", 401);
}

export async function optionalFirebaseRequest(
  request: NextRequest,
): Promise<DecodedIdToken | null> {
  try {
    return await verifyFirebaseRequest(request);
  } catch (error) {
    if (error instanceof FirebaseRequestAuthError && error.status === 401) {
      return null;
    }
    throw error;
  }
}
