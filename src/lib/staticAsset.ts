import type { StaticImageData } from "next/image";

export function staticAssetUrl(asset: string | StaticImageData) {
  return typeof asset === "string" ? asset : asset.src;
}

