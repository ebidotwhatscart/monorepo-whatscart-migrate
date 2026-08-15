import { BUSINESS_TYPE_CONFIG } from "../components/products/businessTypeConfig";
import type {
  BusinessType,
  ProductCustomizationOption,
  ProductTypeDetails,
} from "../types/product";

export interface ProductCustomizationPayload {
  selectedSize?: string;
  selectedAddOns?: ProductCustomizationOption[];
  customText?: string;
  uploadedImageUrl?: string;
  uploadedImageName?: string;
}

export function createCartItemId(
  productId: string,
  payload?: ProductCustomizationPayload,
) {
  if (!payload || !hasSelectedCustomizations(payload)) {
    return productId;
  }

  return `${productId}:${encodeProductCustomization(payload)}`;
}

const TEXT_CUSTOMIZATION_OPTIONS = new Set<ProductCustomizationOption>([
  "custom_text_message",
  "custom_engraving",
  "embroidered_text",
]);

const IMAGE_CUSTOMIZATION_OPTIONS = new Set<ProductCustomizationOption>([
  "edible_photo_print",
  "customer_photo_upload",
]);

export function getCustomizationOptionLabel(
  businessType: BusinessType,
  option: ProductCustomizationOption,
) {
  const options = BUSINESS_TYPE_CONFIG[businessType].customizationOptions ?? [];
  return options.find((item) => item.value === option)?.label ?? humanizeOption(option);
}

export function getAvailableCustomizationOptions(
  businessType: BusinessType,
  details?: ProductTypeDetails,
) {
  if (!details?.customizationEnabled || !details.customizationOptions?.length) {
    return [];
  }

  return details.customizationOptions.map((option) => ({
    value: option,
    label: getCustomizationOptionLabel(businessType, option),
  }));
}

export function isTextCustomizationOption(option: ProductCustomizationOption) {
  return TEXT_CUSTOMIZATION_OPTIONS.has(option);
}

export function isImageCustomizationOption(option: ProductCustomizationOption) {
  return IMAGE_CUSTOMIZATION_OPTIONS.has(option);
}

export function getCustomizationTextFieldLabel(
  businessType: BusinessType,
  selectedAddOns: ProductCustomizationOption[],
) {
  const selectedTextOptions = selectedAddOns.filter(isTextCustomizationOption);
  if (selectedTextOptions.length === 1) {
    return getCustomizationOptionLabel(businessType, selectedTextOptions[0]!);
  }

  if (businessType === "handicrafts") {
    return "Personalization details";
  }

  return "Customization details";
}

export function getCustomizationTextPlaceholder(businessType: BusinessType) {
  if (businessType === "handicrafts") {
    return "Share the name, date, quote, or stitch details you want added...";
  }

  return "Share the message or customization details you want on the product...";
}

export function getCustomizationImageFieldLabel(
  businessType: BusinessType,
  selectedAddOns: ProductCustomizationOption[],
) {
  const selectedImageOptions = selectedAddOns.filter(isImageCustomizationOption);
  if (selectedImageOptions.length === 1) {
    return getCustomizationOptionLabel(businessType, selectedImageOptions[0]!);
  }

  return businessType === "handicrafts" ? "Reference image" : "Upload image";
}

export function encodeProductCustomization(payload: ProductCustomizationPayload) {
  return encodeURIComponent(JSON.stringify(payload));
}

export function parseProductCustomization(value: string | null) {
  if (!value) {
    return undefined;
  }

  try {
    return JSON.parse(decodeURIComponent(value)) as ProductCustomizationPayload;
  } catch {
    return undefined;
  }
}

export function hasSelectedCustomizations(payload: ProductCustomizationPayload) {
  return Boolean(
    payload.selectedSize ||
      payload.selectedAddOns?.length ||
      payload.customText?.trim() ||
      payload.uploadedImageUrl,
  );
}

export function requiresDirectCheckout(
  businessType: BusinessType,
  details?: ProductTypeDetails,
) {
  return Boolean(
    businessType !== "garments" &&
      details?.customizationEnabled &&
      details.customizationOptions?.length,
  );
}

export function formatCustomizationMessageLines(
  businessType: BusinessType,
  payload?: ProductCustomizationPayload,
) {
  if (!payload) {
    return [];
  }

  const lines: string[] = [];

  if (payload.selectedSize) {
    lines.push(`Variant: ${payload.selectedSize}`);
  }

  if (payload.selectedAddOns?.length) {
    lines.push(
      `Add-ons: ${payload.selectedAddOns
        .map((option) => getCustomizationOptionLabel(businessType, option))
        .join(", ")}`,
    );
  }

  if (payload.customText?.trim()) {
    lines.push(`${getCustomizationTextFieldLabel(businessType, payload.selectedAddOns ?? [])}: ${payload.customText.trim()}`);
  }

  if (payload.uploadedImageUrl) {
    lines.push(`Reference image: ${payload.uploadedImageUrl}`);
  }

  return lines;
}

export function hasMeaningfulCustomizationLines(lines?: string[]) {
  return Boolean(lines?.some((line) => line.trim()));
}

function humanizeOption(option: string) {
  return option
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
