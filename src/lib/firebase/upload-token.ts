import { createHmac, timingSafeEqual } from "node:crypto";

type UploadTokenPayload = {
  expiresAt: number;
  path: string;
  purpose?: "business-asset" | "customer-image" | "review-image";
};

type VerifiedUploadTokenPayload = UploadTokenPayload & {
  purpose: "business-asset" | "customer-image" | "review-image";
};

const ALLOWED_UPLOAD_PATH = /^(?:customer-uploads\/[0-9a-f-]{36}|user-uploads\/[a-f0-9]{64}\/[0-9a-f-]{36}|review-uploads\/[A-Za-z0-9_-]{1,160}\/[0-9a-f-]{36})$/;

export function userUploadPrefix(userId: string) {
  const userHash = createHmac("sha256", uploadSecret())
    .update(`user:${userId}`)
    .digest("hex");
  return `user-uploads/${userHash}`;
}

function uploadSecret() {
  const secret = process.env.FIREBASE_UPLOAD_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("FIREBASE_UPLOAD_SECRET is not configured.");
  }
  return secret;
}

function signature(payload: string) {
  return createHmac("sha256", uploadSecret())
    .update(payload)
    .digest("base64url");
}

export function createUploadToken(payload: UploadTokenPayload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signature(encoded)}`;
}

export function verifyUploadToken(token: string): VerifiedUploadTokenPayload {
  const [encoded, suppliedSignature] = token.split(".");
  if (!encoded || !suppliedSignature) throw new Error("Upload token is invalid.");
  const expectedSignature = signature(encoded);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    throw new Error("Upload token is invalid.");
  }

  const payload = JSON.parse(
    Buffer.from(encoded, "base64url").toString("utf8"),
  ) as UploadTokenPayload;
  if (
    !payload ||
    typeof payload.path !== "string" ||
    !ALLOWED_UPLOAD_PATH.test(payload.path) ||
    typeof payload.expiresAt !== "number" ||
    payload.expiresAt < Date.now()
  ) {
    throw new Error("Upload token is invalid or expired.");
  }
  const purpose =
    payload.purpose ??
    (payload.path.startsWith("user-uploads/")
      ? "business-asset"
      : payload.path.startsWith("review-uploads/")
        ? "review-image"
        : "customer-image");
  if (
    (purpose !== "business-asset" &&
      purpose !== "customer-image" &&
      purpose !== "review-image") ||
    (purpose === "business-asset" &&
      !payload.path.startsWith("user-uploads/")) ||
    (purpose === "customer-image" &&
      !payload.path.startsWith("customer-uploads/")) ||
    (purpose === "review-image" &&
      !payload.path.startsWith("review-uploads/"))
  ) {
    throw new Error("Upload token is invalid.");
  }
  return { ...payload, purpose };
}
