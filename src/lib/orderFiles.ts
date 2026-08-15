export function extractConvexStorageFileId(url: string) {
  try {
    const parsedUrl = new URL(url);
    const segments = parsedUrl.pathname.split("/").filter(Boolean);
    const storageIndex = segments.findIndex((segment) => segment === "storage");

    if (storageIndex === -1) {
      return "";
    }

    return segments[storageIndex + 1] ?? "";
  } catch {
    return "";
  }
}

export function buildReferenceImagePath(slug: string, fileId: string) {
  return storefrontPath(slug, fileId);
}

export function buildConvexStorageUrl(fileId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_CONVEX_URL as string | undefined;
  if (!baseUrl) {
    return "";
  }

  return `${baseUrl.replace(/\/$/, "")}/api/storage/${fileId}`;
}

export function extractReferenceImageUrlFromLine(line: string) {
  const match = line.match(/^Reference image:\s*(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

export function isReferenceImageLine(line: string) {
  return /^Reference image:\s*/i.test(line);
}
import { storefrontPath } from "./urls";
