export const BUSINESS_TYPES = ["garments", "home_bakery", "handicrafts"] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];
export const LEGACY_BUSINESS_TYPES = ["food", "clothing", "accessories"] as const;
export type LegacyBusinessType = (typeof LEGACY_BUSINESS_TYPES)[number];
export type StoredBusinessType = BusinessType | LegacyBusinessType;

export function normalizeBusinessType(value: StoredBusinessType): BusinessType {
  if (value === "food") {
    return "home_bakery";
  }

  if (value === "clothing") {
    return "garments";
  }

  if (value === "accessories") {
    return "garments";
  }

  return value;
}

export const PRODUCT_AUDIENCES = ["female", "male", "unisex", "kid"] as const;
export type ProductAudience = (typeof PRODUCT_AUDIENCES)[number];

export const DIETARY_CLASSIFICATIONS = ["veg", "non_veg", "egg"] as const;
export type DietaryClassification = (typeof DIETARY_CLASSIFICATIONS)[number];

export const PRODUCT_SIZE_FORMATS = ["alpha", "numeric"] as const;

export const PRODUCT_CUSTOMIZATION_OPTIONS = [
  "edible_photo_print",
  "custom_text_message",
  "custom_engraving",
  "embroidered_text",
  "customer_photo_upload",
] as const;
export type ProductCustomizationOption =
  (typeof PRODUCT_CUSTOMIZATION_OPTIONS)[number];

export const RETURN_ACCEPTED_CONDITIONS = [
  "unused",
  "original_packaging",
  "damaged",
  "wrong_item",
  "other",
] as const;
export type ReturnAcceptedCondition =
  (typeof RETURN_ACCEPTED_CONDITIONS)[number];

export interface ProductReturnPolicy {
  returnable: boolean;
  returnWindowDays?: number;
  acceptedConditions: ReturnAcceptedCondition[];
}

export interface ProductTypeDetails {
  audience?: ProductAudience;
  dietaryClassification?: DietaryClassification;
  sizeFormat?: (typeof PRODUCT_SIZE_FORMATS)[number];
  customizationEnabled?: boolean;
  customizationOptions?: ProductCustomizationOption[];
}
