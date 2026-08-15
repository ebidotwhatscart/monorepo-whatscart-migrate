import { describe, expect, it } from "vitest";

import {
  buildReferenceImagePath,
  createReferenceImageId,
  extractReferenceImageId,
  resolveReferenceImageUrl,
} from "../orderFiles";

describe("Firebase reference image links", () => {
  it("round-trips a Firebase Storage download URL without a legacy backend", () => {
    const url =
      "https://firebasestorage.googleapis.com/v0/b/whatscart.appspot.com/o/customer-uploads%2Fimage.webp?alt=media&token=abc-123";
    const referenceId = createReferenceImageId(url);

    expect(referenceId).toMatch(/^f_[A-Za-z0-9_-]+$/);
    expect(resolveReferenceImageUrl(referenceId)).toBe(url);
    expect(buildReferenceImagePath("asha-textiles", referenceId)).toBe(
      `/store/asha-textiles/${referenceId}`,
    );
  });

  it("keeps an existing storefront reference ID stable", () => {
    const referenceId = createReferenceImageId("https://example.com/image.png");
    expect(
      extractReferenceImageId(
        `https://asha-textiles.whatscart.in/${referenceId}`,
      ),
    ).toBe(referenceId);
  });
});
