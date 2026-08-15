import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ProductVariationSection,
  createEmptyVariant,
  type VariantFormData,
} from "../products/ProductVariationSection";


describe("ProductVariationSection image uploads", () => {
  it("accepts phone-sized images larger than 2 MB for a new edit-page variant", async () => {
    const variant = createEmptyVariant();
    const onVariantsChange = vi.fn();
    const { getByLabelText } = render(
      <ProductVariationSection
        hasColorVariants
        onHasColorVariantsChange={vi.fn()}
        variants={[variant]}
        onVariantsChange={onVariantsChange}
        sizeFormat="alpha"
        sizeOptions={[]}
        simplePrice
        variationOptions={[]}
        onAddCustomType={vi.fn()}
        onAddCustomValue={vi.fn()}
      />,
    );
    const phonePhoto = new File(
      [new Uint8Array(3 * 1024 * 1024)],
      "phone-photo.jpg",
      { type: "image/jpeg" },
    );

    fireEvent.change(getByLabelText("Add photos for variant 1"), {
      target: { files: [phonePhoto] },
    });

    await waitFor(() => expect(onVariantsChange).toHaveBeenCalled());
    const updatedVariants = onVariantsChange.mock.calls.at(-1)?.[0] as VariantFormData[];
    expect(updatedVariants[0].images).toEqual([phonePhoto]);
    expect(updatedVariants[0].imagePreviews[0]).toMatch(/^data:image\/jpeg;base64,/);
  });

  it("accepts source images above 5 MB so they can be compressed during save", async () => {
    const variant = createEmptyVariant();
    const onVariantsChange = vi.fn();
    const { getByLabelText } = render(
      <ProductVariationSection
        hasColorVariants
        onHasColorVariantsChange={vi.fn()}
        variants={[variant]}
        onVariantsChange={onVariantsChange}
        sizeFormat="alpha"
        sizeOptions={[]}
        simplePrice
        variationOptions={[]}
        onAddCustomType={vi.fn()}
        onAddCustomValue={vi.fn()}
      />,
    );
    const largeSourcePhoto = new File(
      [new Uint8Array(8 * 1024 * 1024)],
      "large-source.jpg",
      { type: "image/jpeg" },
    );

    fireEvent.change(getByLabelText("Add photos for variant 1"), {
      target: { files: [largeSourcePhoto] },
    });

    await waitFor(() => expect(onVariantsChange).toHaveBeenCalled());
    const updatedVariants = onVariantsChange.mock.calls.at(-1)?.[0] as VariantFormData[];
    expect(updatedVariants[0].images).toEqual([largeSourcePhoto]);
  });
});
