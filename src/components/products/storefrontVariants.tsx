import { BUSINESS_TYPE_CONFIG } from "./businessTypeConfig";
import type { BusinessType, ProductTypeDetails } from "../../types/product";

export function getStorefrontCopy(businessType: BusinessType) {
  return BUSINESS_TYPE_CONFIG[businessType].storefront;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function getProductMetaChips(
  businessType: BusinessType,
  details?: ProductTypeDetails,
) {
  if (businessType === "home_bakery") {
    return [
      details?.dietaryClassification
        ? details.dietaryClassification.replace("_", "-").toUpperCase()
        : null,
      details?.customizationEnabled ? "Customizable" : null,
    ].filter(Boolean);
  }

  if (businessType === "handicrafts") {
    return [
      details?.audience ? capitalize(details.audience) : null,
      details?.customizationEnabled ? "Personalizable" : null,
    ].filter(Boolean);
  }

  return [
    details?.audience ? capitalize(details.audience) : null,
    details?.sizeFormat === "numeric" ? "Numeric Sizes" : "Alpha Sizes",
  ].filter(Boolean);
}