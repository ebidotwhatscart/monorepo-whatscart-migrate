import { describe, expect, it } from "vitest";
import { formatCustomizationMessageLines } from "../productCustomization";

describe("product customization formatting", () => {
  it("includes the uploaded image link in WhatsApp-ready customization lines", () => {
    const lines = formatCustomizationMessageLines("home_bakery", {
      selectedSize: "500 gm",
      selectedAddOns: ["custom_text_message", "edible_photo_print"],
      customText: "Happy Birthday Asha",
      uploadedImageUrl: "https://cdn.example.com/reference.png",
    });

    expect(lines).toContain("Variant: 500 gm");
    expect(lines).toContain("Reference image: https://cdn.example.com/reference.png");
    expect(lines).toContain(
      "Custom text message: Happy Birthday Asha",
    );
  });
});
