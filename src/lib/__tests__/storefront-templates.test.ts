import { describe, expect, it } from "vitest";
import {
  getTemplateMeta,
  STOREFRONT_TEMPLATE_IDS,
  STOREFRONT_TEMPLATES,
} from "../storefrontTemplates";

describe("storefront template registry", () => {
  it("registers nilav as the selfcare template", () => {
    const meta = getTemplateMeta("nilav");
    expect(meta).not.toBeNull();
    expect(meta?.businessType).toBe("selfcare");
    expect(STOREFRONT_TEMPLATE_IDS.has("nilav")).toBe(true);
    expect(STOREFRONT_TEMPLATES.length).toBe(1);
  });

  it("returns null for missing or unknown ids", () => {
    expect(getTemplateMeta(null)).toBeNull();
    expect(getTemplateMeta(undefined)).toBeNull();
    expect(getTemplateMeta("")).toBeNull();
    expect(getTemplateMeta("does-not-exist")).toBeNull();
  });
});
