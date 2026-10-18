import { describe, expect, it } from "vitest";
import {
  BUSINESS_TYPES,
  isHandicraftFamily,
  normalizeBusinessType,
} from "../../types/product";
import { BUSINESS_TYPE_CONFIG } from "../../components/products/businessTypeConfig";

describe("selfcare business type", () => {
  it("is a first-class business type", () => {
    expect(BUSINESS_TYPES).toContain("selfcare");
  });

  it("normalizes the health alias to selfcare", () => {
    expect(normalizeBusinessType("health")).toBe("selfcare");
  });

  it("treats selfcare and handicrafts as the same family", () => {
    expect(isHandicraftFamily("handicrafts")).toBe(true);
    expect(isHandicraftFamily("selfcare")).toBe(true);
    expect(isHandicraftFamily("health")).toBe(true);
    expect(isHandicraftFamily("garments")).toBe(false);
    expect(isHandicraftFamily(undefined)).toBe(false);
    expect(isHandicraftFamily(null)).toBe(false);
  });

  it("has a product config entry", () => {
    expect(BUSINESS_TYPE_CONFIG.selfcare.categorySuggestions.length).toBeGreaterThan(0);
  });
});
