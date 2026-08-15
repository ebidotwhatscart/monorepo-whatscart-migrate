import { storefrontPath } from "./urls";

const FIREBASE_REFERENCE_PREFIX = "f_";

function encodeBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(
    Math.ceil(value.length / 4) * 4,
    "=",
  );
  const binary = atob(padded);
  return new TextDecoder().decode(
    Uint8Array.from(binary, (character) => character.charCodeAt(0)),
  );
}

export function createReferenceImageId(url: string) {
  const normalized = url.trim();
  if (!/^https?:\/\//i.test(normalized)) return "";
  return `${FIREBASE_REFERENCE_PREFIX}${encodeBase64Url(normalized)}`;
}

export function extractReferenceImageId(url: string) {
  try {
    const parsedUrl = new URL(url);
    const finalSegment = parsedUrl.pathname.split("/").filter(Boolean).at(-1);
    if (finalSegment?.startsWith(FIREBASE_REFERENCE_PREFIX)) {
      return finalSegment;
    }
    return createReferenceImageId(parsedUrl.toString());
  } catch {
    return "";
  }
}

export function buildReferenceImagePath(slug: string, referenceId: string) {
  return storefrontPath(slug, referenceId);
}

export function resolveReferenceImageUrl(referenceId: string) {
  if (!referenceId.startsWith(FIREBASE_REFERENCE_PREFIX)) return "";
  try {
    const url = decodeBase64Url(referenceId.slice(FIREBASE_REFERENCE_PREFIX.length));
    return /^https?:\/\//i.test(url) ? url : "";
  } catch {
    return "";
  }
}

export function extractReferenceImageUrlFromLine(line: string) {
  const match = line.match(/^Reference image:\s*(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

export function isReferenceImageLine(line: string) {
  return /^Reference image:\s*/i.test(line);
}
