export function isVariationEnabled(businessType: string): boolean {
  const raw =
    process.env.NEXT_PUBLIC_VARIATION_ENABLED_BUSINESS_TYPES ?? "garments";
  return raw
    .split(",")
    .map((s) => s.trim())
    .includes(businessType);
}
