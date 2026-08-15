import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useFirebaseMutation as useMutation } from "../../lib/firebase/mutations";
import { useFirebaseQuery as useQuery } from "../../lib/firebase/hooks";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductForm } from "../products/ProductForm";

vi.mock("../../lib/firebase/hooks", () => ({
  useFirebaseQuery: vi.fn(),
}));
vi.mock("../../lib/firebase/mutations", () => ({
  useFirebaseMutation: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const mockCreateProduct = vi.fn();
const mockUpdateProduct = vi.fn();
const mockCreateCategory = vi.fn();
const mockDeleteCategory = vi.fn();
const mockGenerateUploadUrl = vi.fn();
const mockAddCustomVariationType = vi.fn();
const mockAddCustomVariationValue = vi.fn();

describe("ProductForm business types", () => {
  beforeEach(() => {
    vi.mocked(useQuery).mockReset();
    vi.mocked(useMutation).mockReset();
    mockCreateProduct.mockReset();
    mockUpdateProduct.mockReset();
    mockCreateCategory.mockReset();
    mockDeleteCategory.mockReset();
    mockGenerateUploadUrl.mockReset();
    mockAddCustomVariationType.mockReset();
    mockAddCustomVariationValue.mockReset();

    vi.mocked(useQuery).mockReturnValue([] as never);
    const mutationMocks = [
      mockCreateCategory,
      mockDeleteCategory,
      mockCreateProduct,
      mockUpdateProduct,
      mockGenerateUploadUrl,
      mockAddCustomVariationType,
      mockAddCustomVariationValue,
    ];
    let mutationIndex = 0;

    vi.mocked(useMutation).mockImplementation(() => {
      const nextMock = mutationMocks[mutationIndex % mutationMocks.length] ?? vi.fn();
      mutationIndex += 1;
      return nextMock as never;
    });
  });

  it("renders bakery fields and color variation section", () => {
    render(
      <ProductForm
        businessId={"biz_1" as never}
        businessType="home_bakery"
        onCancel={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    expect(screen.getByText("Dietary Classification")).toBeInTheDocument();
    expect(screen.getByText("Allow Cake Customization")).toBeInTheDocument();
    expect(screen.getByText("Edible photo print")).toBeInTheDocument();
    expect(screen.queryByText("Gender")).not.toBeInTheDocument();
    expect(screen.getByText("Select Size Format")).toBeInTheDocument();
    expect(screen.getByText("Price & Size Variations")).toBeInTheDocument();
    expect(screen.getByText("Product Variation")).toBeInTheDocument();
    expect(
      screen.getByText("Does the product have colour variants?"),
    ).toBeInTheDocument();
  });

  it("keeps bakery weight pricing separate from variation types", async () => {
    const user = userEvent.setup();
    let queryIndex = 0;
    vi.mocked(useQuery).mockImplementation(() => {
      queryIndex += 1;
      if (queryIndex === 2) {
        return [
          { variantType: "Flavor", values: ["Vanilla"] },
          { variantType: "Weight", values: ["500 gm"] },
          { variantType: "Quantity", values: ["1"] },
        ] as never;
      }
      return [] as never;
    });

    render(
      <ProductForm
        businessId={"biz_1" as never}
        businessType="home_bakery"
        onCancel={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    expect(screen.getByText("Weight (gm/kg)")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Yes" }));

    const variantType = screen.getByLabelText("Variant Type");
    expect(within(variantType).queryByRole("option", { name: "Weight" })).not.toBeInTheDocument();
    expect(screen.getByText("Price & Size Variations")).toBeInTheDocument();
    expect(screen.getByLabelText("Price 1")).toBeInTheDocument();
  });

  it("uses the parent garment sizes for variation pricing", async () => {
    const user = userEvent.setup();

    render(
      <ProductForm
        businessId={"biz_1" as never}
        businessType="garments"
        onCancel={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Size 1"), "M");
    await user.click(screen.getByRole("button", { name: "Yes" }));

    expect(screen.getByLabelText("Size 1 for variant 1")).toHaveValue("M");
    expect(
      within(screen.getByLabelText("Size 1 for variant 1")).queryByRole("option", {
        name: "XS",
      }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Upload Size Guide")).toBeInTheDocument();
    expect(screen.getByText("Help customers choose the right size.")).toBeInTheDocument();
  });

  it("defaults a new variation to the first variation type", async () => {
    const user = userEvent.setup();
    mockAddCustomVariationType.mockResolvedValue("Color");

    render(
      <ProductForm
        businessId={"biz_1" as never}
        businessType="garments"
        onCancel={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Yes" }));
    const variantTypes = screen.getAllByLabelText("Variant Type");
    await user.selectOptions(variantTypes[0], "__custom__");
    await user.type(screen.getByPlaceholderText("Enter custom type"), "Color");
    await user.click(screen.getByRole("button", { name: "Save custom type" }));
    await user.click(screen.getByRole("button", { name: "Add Variant" }));

    expect(screen.getAllByLabelText("Variant Type")[1]).toHaveValue("Color");
  });

  it("renders handicraft personalization and color variation section", () => {
    render(
      <ProductForm
        businessId={"biz_1" as never}
        businessType="handicrafts"
        onCancel={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    expect(screen.getByText("Audience")).toBeInTheDocument();
    expect(
      screen.getByText("Allow Handicraft Personalization"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Customer photo upload (printed/etched)"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Dietary Classification")).not.toBeInTheDocument();
    expect(screen.queryByText("Allow Cake Customization")).not.toBeInTheDocument();
    expect(screen.getByText("Product Variation")).toBeInTheDocument();
    expect(
      screen.getByText("Does the product have colour variants?"),
    ).toBeInTheDocument();
  });

  it("submits bakery product type details with canonical values", async () => {
    const user = userEvent.setup();

    render(
      <ProductForm
        businessId={"biz_1" as never}
        businessType="home_bakery"
        onCancel={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText("Product Name"), "Chocolate Cake");
    await user.type(screen.getByPlaceholderText("500 gm"), "500 gm");
    await user.type(screen.getByPlaceholderText("237"), "499");
    await user.click(screen.getByRole("button", { name: "Egg" }));
    await user.click(
      screen.getByRole("button", { name: "Allow Cake Customization" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Custom text message" }),
    );

    fireEvent.submit(screen.getByRole("button", { name: /save product/i }).form!);

    await waitFor(() => {
      expect(mockCreateProduct).toHaveBeenCalledWith({
        businessId: "biz_1",
        name: "Chocolate Cake",
        description: "",
        price: 499,
        sizes: [{ size: "500 gm", price: 499 }],
        categoryId: undefined,
        inStock: true,
        imageIds: [],
        productTypeDetails: {
          dietaryClassification: "egg",
          customizationEnabled: true,
          customizationOptions: ["custom_text_message"],
        },
      });
    });
  });

  it("submits handicraft product type details with canonical values", async () => {
    const user = userEvent.setup();

    render(
      <ProductForm
        businessId={"biz_1" as never}
        businessType="handicrafts"
        onCancel={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText("Product Name"), "Engraved Keepsake");
    await user.type(screen.getByLabelText("Price"), "899");
    await user.click(screen.getByRole("button", { name: "Unisex" }));
    await user.click(
      screen.getByRole("button", { name: "Allow Handicraft Personalization" }),
    );
    await user.click(
      screen.getByRole("button", {
        name: "Custom engraving (names, dates, quotes)",
      }),
    );

    fireEvent.submit(screen.getByRole("button", { name: /save product/i }).form!);

    await waitFor(() => {
      expect(mockCreateProduct).toHaveBeenCalledWith({
        businessId: "biz_1",
        name: "Engraved Keepsake",
        description: "",
        price: 899,
        sizes: [],
        categoryId: undefined,
        inStock: true,
        imageIds: [],
        productTypeDetails: {
          audience: "unisex",
          customizationEnabled: true,
          customizationOptions: ["custom_engraving"],
        },
      });
    });
  });
});
