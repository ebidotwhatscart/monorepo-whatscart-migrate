import { NextResponse, type NextRequest } from "next/server";

import { getAdminAuth } from "../../../../lib/firebase/admin";
import { FIREBASE_SESSION_COOKIE } from "../../../../lib/firebase/server-auth";

const SESSION_DURATION_MS = 5 * 24 * 60 * 60 * 1000;

function unavailable() {
  return NextResponse.json(
    { error: "Firebase Admin is not configured." },
    { status: 503 },
  );
}

export async function POST(request: NextRequest) {
  const auth = getAdminAuth();
  if (!auth) return unavailable();

  const authorization = request.headers.get("authorization");
  const idToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  if (!idToken) {
    return NextResponse.json({ error: "Missing Firebase ID token." }, { status: 401 });
  }

  try {
    await auth.verifyIdToken(idToken, true);
    const sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION_MS,
    });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(FIREBASE_SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      maxAge: SESSION_DURATION_MS / 1000,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Invalid Firebase ID token." }, { status: 401 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(FIREBASE_SESSION_COOKIE, "", {
    expires: new Date(0),
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
