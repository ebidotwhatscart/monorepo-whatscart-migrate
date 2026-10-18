import type { ComponentType, ReactNode } from "react";
import { NilavTemplate } from "./NilavTemplate";

export type StorefrontTemplateComponent = ComponentType<{
  fallback: ReactNode;
}>;

export const STOREFRONT_TEMPLATE_COMPONENTS: Record<
  string,
  StorefrontTemplateComponent
> = {
  nilav: NilavTemplate,
};
