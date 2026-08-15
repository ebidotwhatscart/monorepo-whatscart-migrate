import { v } from "convex/values";
import {
  BUSINESS_TYPES,
  DIETARY_CLASSIFICATIONS,
  LEGACY_BUSINESS_TYPES,
  PRODUCT_AUDIENCES,
  PRODUCT_CUSTOMIZATION_OPTIONS,
  PRODUCT_SIZE_FORMATS,
  RETURN_ACCEPTED_CONDITIONS,
} from "../src/types/product";

export const canonicalBusinessTypeValidator = v.union(
  ...BUSINESS_TYPES.map((businessType) => v.literal(businessType)),
);

export const storedBusinessTypeValidator = v.union(
  ...BUSINESS_TYPES.map((businessType) => v.literal(businessType)),
  ...LEGACY_BUSINESS_TYPES.map((businessType) => v.literal(businessType)),
);

export const productAudienceValidator = v.union(
  ...PRODUCT_AUDIENCES.map((audience) => v.literal(audience)),
);

export const dietaryClassificationValidator = v.union(
  ...DIETARY_CLASSIFICATIONS.map((classification) => v.literal(classification)),
);

export const productSizeFormatValidator = v.union(
  ...PRODUCT_SIZE_FORMATS.map((sizeFormat) => v.literal(sizeFormat)),
);

export const productCustomizationOptionValidator = v.union(
  ...PRODUCT_CUSTOMIZATION_OPTIONS.map((option) => v.literal(option)),
);

export const productSizeValidator = v.object({
  size: v.string(),
  price: v.optional(v.number()),
});

export const returnAcceptedConditionValidator = v.union(
  ...RETURN_ACCEPTED_CONDITIONS.map((condition) => v.literal(condition)),
);

export const productReturnPolicyValidator = v.object({
  returnable: v.boolean(),
  returnWindowDays: v.optional(v.number()),
  acceptedConditions: v.array(returnAcceptedConditionValidator),
});

export const productTypeDetailsValidator = v.object({
  audience: v.optional(productAudienceValidator),
  dietaryClassification: v.optional(dietaryClassificationValidator),
  sizeFormat: v.optional(productSizeFormatValidator),
  customizationEnabled: v.optional(v.boolean()),
  customizationOptions: v.optional(v.array(productCustomizationOptionValidator)),
});
