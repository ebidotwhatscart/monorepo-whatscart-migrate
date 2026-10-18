import type { BusinessType } from "../types/product";

export type StorefrontTemplateMeta = {
  id: string;
  name: string;
  businessType: BusinessType;
  description: string;
};

export const STOREFRONT_TEMPLATES: StorefrontTemplateMeta[] = [
  {
    id: "nilav",
    name: "Nilav",
    businessType: "selfcare",
    description: "Nature-inspired layout for Selfcare / Health stores.",
  },
];

export const STOREFRONT_TEMPLATE_IDS = new Set(
  STOREFRONT_TEMPLATES.map((template) => template.id),
);

export function getTemplateMeta(
  id?: string | null,
): StorefrontTemplateMeta | null {
  if (!id) return null;
  return STOREFRONT_TEMPLATES.find((template) => template.id === id) ?? null;
}
