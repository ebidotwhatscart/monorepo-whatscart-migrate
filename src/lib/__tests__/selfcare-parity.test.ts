import { describe, expect, it } from "vitest";
import {
  getCustomizationTextFieldLabel,
  getCustomizationImageFieldLabel,
  getCustomizationTextPlaceholder,
  requiresDirectCheckout,
} from "../productCustomization";
import { getCustomizationSectionTitle } from "../orderDetails";
import { getProductMetaChips } from "../../components/products/storefrontVariants";

describe("selfcare parity with handicrafts", () => {
  it("uses handicraft customization copy", () => {
    expect(
      getCustomizationTextFieldLabel("selfcare", [
        "custom_engraving",
        "embroidered_text",
      ]),
    ).toBe("Personalization details");
    expect(getCustomizationTextPlaceholder("selfcare")).toBe(
      "Share the name, date, quote, or stitch details you want added...",
    );
    expect(getCustomizationImageFieldLabel("selfcare", [])).toBe(
      "Reference image",
    );
    expect(getCustomizationSectionTitle("selfcare")).toBe("Personalization");
  });

  it("matches handicrafts for the single add-on label shortcut", () => {
    expect(getCustomizationTextFieldLabel("selfcare", ["custom_engraving"])).toBe(
      getCustomizationTextFieldLabel("handicrafts", ["custom_engraving"]),
    );
    expect(
      getCustomizationImageFieldLabel("selfcare", ["customer_photo_upload"]),
    ).toBe(
      getCustomizationImageFieldLabel("handicrafts", ["customer_photo_upload"]),
    );
  });

  it("shows the handicraft personalizable meta chip", () => {
    expect(
      getProductMetaChips("selfcare", { audience: "unisex", customizationEnabled: true }),
    ).toEqual(["Unisex", "Personalizable"]);
  });

  it("requires direct checkout like handicrafts", () => {
    expect(
      requiresDirectCheckout("selfcare", {
        customizationEnabled: true,
        customizationOptions: ["custom_engraving"],
      }),
    ).toBe(true);
  });
});
