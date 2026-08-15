import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMutation, useQuery } from "convex/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import { ProductDetail, getReturnPolicyItems } from "../ProductDetail";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

const mockAddItem = vi.fn();
const mockUpdateBusinessId = vi.fn();

vi.mock("../../context/CartContext", () => ({
  useCart: () => ({
    addItem: mockAddItem,
    getTotalItems: () => 0,
    updateBusinessId: mockUpdateBusinessId,
  }),
}));

vi.mock("../../hooks/useAnalytics", () => ({
  useSessionId: () => "session_1",
  useAnalytics: () => ({
    trackProduct: vi.fn(),
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
  },
}));

vi.mock("../CartSidebar", () => ({
  CartSidebar: () => null,
}));

const business = {
  _id: "biz_1",
  name: "Kanchi House",
  slug: "kanchi-house",
  businessType: "garments",
  themeColor: "#046664",
  whatsappPhone: "919999999999",
};

const product = {
  _id: "product_1",
  businessId: "biz_1",
  categoryId: "cat_1",
  name: "Handloom Kanchipuram Silk Saree",
  description:
    "Authentic hand-woven pure silk with traditional Kanchipuram temple border and gold-plated zari embroidery.",
  price: 8500,
  inStock: true,
  imageUrls: ["https://example.com/saree.jpg"],
  sizes: [
    { size: "Free Size", price: 8500 },
    { size: "S", price: 8500 },
  ],
  productTypeDetails: {
    audience: "female",
    sizeFormat: "alpha",
  },
};

function renderProductDetail(path = "/store/kanchi-house/products/product_1") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/store/:slug/products/:productId"
          element={<ProductDetail />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProductDetail content section", () => {
  beforeEach(() => {
    vi.mocked(useQuery).mockReset();
    vi.mocked(useMutation).mockReset();
    mockAddItem.mockReset();
    mockUpdateBusinessId.mockReset();

    vi.mocked(useMutation).mockReturnValue(vi.fn() as never);

    vi.mocked(useQuery).mockImplementation(((_query, args) => {
      if (args && typeof args === "object" && "productSlug" in args) {
        return product as never;
      }
      if (args && typeof args === "object" && "slug" in args) {
        return business as never;
      }

      if (args && typeof args === "object" && "productId" in args) {
        return product as never;
      }

      if (args && typeof args === "object" && "excludeProductId" in args) {
        return [] as never;
      }

      return undefined;
    }) as typeof useQuery);
  });

  it("resolves a slug through the public query without calling the ID-only query", () => {
    renderProductDetail("/store/kanchi-house/products/suit");

    const calls = vi.mocked(useQuery).mock.calls;
    expect(calls).toContainEqual([
      api.products.getPublicProductBySlug,
      { slug: "kanchi-house", productSlug: "suit" },
    ]);
    expect(calls.some(([query]) => query === api.products.getProduct)).toBe(false);
  });

  it("shows available sizes and an about product accordion", async () => {
    const user = userEvent.setup();
    renderProductDetail();

    const sizeSection = screen.getByLabelText("Available sizes");
    expect(within(sizeSection).getByText("Select Size")).toBeInTheDocument();
    expect(within(sizeSection).getByRole("button", { name: "Free Size" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(sizeSection).getByRole("button", { name: "S" })).toBeInTheDocument();
    expect(screen.getByText("Product Details")).toBeInTheDocument();
    expect(screen.getByText("Gender")).toBeInTheDocument();
    expect(screen.getByText("Female")).toBeInTheDocument();
    expect(screen.getByText("Size Format")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();

    const aboutButton = screen.getByRole("button", { name: /about product/i });
    expect(aboutButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/authentic hand-woven pure silk/i)).toBeInTheDocument();
    expect(screen.getByText(/traditional kanchipuram temple border/i)).toBeInTheDocument();

    await user.click(aboutButton);

    expect(aboutButton).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/traditional kanchipuram temple border/i)).not.toBeInTheDocument();
  });

  it("uses actual image thumbnails for mobile gallery navigation", async () => {
    const user = userEvent.setup();
    const galleryProduct = {
      ...product,
      imageUrls: [
        "https://example.com/saree-front.jpg",
        "https://example.com/saree-back.jpg",
        "https://example.com/saree-detail.jpg",
      ],
    };
    vi.mocked(useQuery).mockImplementation(((_query, args) => {
      if (args && typeof args === "object" && "productSlug" in args) return galleryProduct as never;
      if (args && typeof args === "object" && "slug" in args) return business as never;
      if (args && typeof args === "object" && "productId" in args) return galleryProduct as never;
      if (args && typeof args === "object" && "excludeProductId" in args) return [] as never;
      return undefined;
    }) as typeof useQuery);

    renderProductDetail();

    const gallery = screen.getByRole("group", {
      name: "Mobile product image thumbnails",
    });
    const thumbnails = within(gallery).getAllByRole("button");
    expect(thumbnails).toHaveLength(3);
    expect(thumbnails[0]).toHaveAttribute("aria-pressed", "true");

    await user.click(thumbnails[1]);

    expect(thumbnails[1]).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByAltText(galleryProduct.name)).toHaveAttribute(
      "src",
      galleryProduct.imageUrls[1],
    );
  });

  it("navigates to a variant product URL instead of swapping local product state", () => {
    const variants = [
      {
        ...product,
        _id: "product_1",
        slug: "handloom-kanchipuram-silk-saree-product_1",
        variantType: "Color",
        variantValue: "Red",
        colorSwatch: "#ff0000",
      },
      {
        ...product,
        _id: "product_2",
        name: "Handloom Kanchipuram Silk Saree - Blue",
        slug: "handloom-kanchipuram-silk-saree-blue-product_2",
        variantType: "Color",
        variantValue: "Blue",
        colorSwatch: "#0000ff",
      },
    ];

    vi.mocked(useQuery).mockImplementation(((_query, args) => {
      if (args && typeof args === "object" && "productSlug" in args) return variants[0] as never;
      if (args && typeof args === "object" && "slug" in args) return business as never;
      if (args && typeof args === "object" && "excludeProductId" in args) return [] as never;
      if (args && typeof args === "object" && "productId" in args) return variants as never;
      return undefined;
    }) as typeof useQuery);

    renderProductDetail();

    expect(screen.getByRole("link", { name: "Blue" })).toHaveAttribute(
      "href",
      "/store/kanchi-house/products/handloom-kanchipuram-silk-saree-blue-product_2",
    );
    expect(screen.getByRole("link", { name: "Red" })).toHaveAttribute("aria-current", "page");
  });

  it("shows the saved return policy in the Figma storefront accordion", async () => {
    const user = userEvent.setup();
    const returnableProduct = {
      ...product,
      returnPolicy: {
        returnable: true,
        returnWindowDays: 7,
        acceptedConditions: ["unused", "original_packaging"],
      },
    };
    vi.mocked(useQuery).mockImplementation(((_query, args) => {
      if (args && typeof args === "object" && "productSlug" in args) return returnableProduct as never;
      if (args && typeof args === "object" && "slug" in args) return business as never;
      if (args && typeof args === "object" && "productId" in args) return returnableProduct as never;
      if (args && typeof args === "object" && "excludeProductId" in args) return [] as never;
      return undefined;
    }) as typeof useQuery);

    renderProductDetail();

    const policy = screen.getByRole("region", { name: "Return Policy" });
    expect(within(policy).getByText("Returnable")).toBeInTheDocument();
    expect(within(policy).getByText("Request a return within 7 days after delivery.")).toBeInTheDocument();
    expect(within(policy).getByText("Item should be unused and returned in its original packaging.")).toBeInTheDocument();

    const toggle = within(policy).getByRole("button", { name: "Return Policy" });
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(within(policy).queryByText("Returnable")).not.toBeInTheDocument();
  });

  it("describes non-returnable products clearly", () => {
    expect(getReturnPolicyItems({
      returnable: false,
      acceptedConditions: [],
    })).toEqual(["This product is not returnable."]);
  });

  it("renders a similar products carousel when related products are available", () => {
    const relatedProducts = [
      {
        _id: "product_2",
        businessId: "biz_1",
        categoryId: "cat_1",
        name: "Temple Border Silk Saree",
        description: "Classic zari work",
        price: 9200,
        inStock: true,
        imageUrls: ["https://example.com/saree-2.jpg"],
        sizes: [],
        category: { _id: "cat_1", name: "Sarees" },
      },
      {
        _id: "product_3",
        businessId: "biz_1",
        categoryId: "cat_2",
        name: "Soft Silk Dupatta",
        description: "Lightweight woven dupatta",
        price: 2600,
        inStock: true,
        imageUrls: ["https://example.com/dupatta.jpg"],
        sizes: [],
        category: { _id: "cat_2", name: "Dupattas" },
      },
    ];

    vi.mocked(useQuery).mockImplementation(((_query, args) => {
      if (args && typeof args === "object" && "productSlug" in args) {
        return product as never;
      }
      if (args && typeof args === "object" && "slug" in args) {
        return business as never;
      }

      if (args && typeof args === "object" && "productId" in args) {
        return product as never;
      }

      if (args && typeof args === "object" && "excludeProductId" in args) {
        return relatedProducts as never;
      }

      return undefined;
    }) as typeof useQuery);

    renderProductDetail();

    const carousel = screen.getByRole("region", { name: /similar products/i });
    expect(within(carousel).getByRole("link", { name: /temple border silk saree/i })).toHaveAttribute(
      "href",
      "/store/kanchi-house/products/temple-border-silk-saree-duct_2",
    );
    expect(within(carousel).getByRole("link", { name: /soft silk dupatta/i })).toHaveAttribute(
      "href",
      "/store/kanchi-house/products/soft-silk-dupatta-duct_3",
    );
    expect(within(carousel).getByText("Sarees")).toBeInTheDocument();
    expect(within(carousel).getByText("Dupattas")).toBeInTheDocument();
  });

  it("keeps rendering the loading state while the product query is unresolved", () => {
    vi.mocked(useQuery).mockImplementation(((_query, args) => {
      if (args && typeof args === "object" && "productSlug" in args) {
        return undefined as never;
      }
      if (args && typeof args === "object" && "slug" in args) {
        return business as never;
      }

      if (args === "skip") {
        return undefined as never;
      }

      if (args && typeof args === "object" && "productId" in args) {
        return undefined as never;
      }

      return undefined;
    }) as typeof useQuery);

    expect(() => renderProductDetail()).not.toThrow();
    expect(screen.queryByText(/product not found/i)).not.toBeInTheDocument();
  });

  it("shows bakery-specific product fields and customization controls", async () => {
    const user = userEvent.setup();
    const bakeryBusiness = { ...business, businessType: "home_bakery" };
    const bakeryProduct = {
      ...product,
      productTypeDetails: {
        dietaryClassification: "egg",
        sizeFormat: "weight",
        customizationEnabled: true,
        customizationOptions: ["custom_text_message"],
      },
    };

    vi.mocked(useQuery).mockImplementation(((_query, args) => {
      if (args && typeof args === "object" && "productSlug" in args) {
        return bakeryProduct as never;
      }
      if (args && typeof args === "object" && "slug" in args) {
        return bakeryBusiness as never;
      }

      if (args && typeof args === "object" && "productId" in args) {
        return bakeryProduct as never;
      }

      if (args && typeof args === "object" && "excludeProductId" in args) {
        return [] as never;
      }

      return undefined;
    }) as typeof useQuery);

    renderProductDetail();

    expect(screen.getByText("Dietary")).toBeInTheDocument();
    expect(screen.getByText("Egg")).toBeInTheDocument();
    expect(screen.getByText("Serving Format")).toBeInTheDocument();
    expect(screen.getByText("Weight (gm/kg)")).toBeInTheDocument();
    expect(screen.getByText("Customization")).toBeInTheDocument();
    expect(screen.getAllByText("Custom text message").length).toBeGreaterThan(0);
    expect(screen.getByText("Select Quantity")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Add to Cart" })).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Custom text message" }));

    expect(screen.getByLabelText("Custom text message")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Add to Cart" })[0]);

    expect(mockAddItem).toHaveBeenCalledWith(
      expect.objectContaining({
        cartItemId: expect.any(String),
        productId: "product_1",
        customizationLines: expect.arrayContaining([
          "Variant: Free Size",
          "Add-ons: Custom text message",
        ]),
      }),
    );
  });

  it("shows handicraft-specific product fields", () => {
    const handicraftBusiness = { ...business, businessType: "handicrafts" };
    const handicraftProduct = {
      ...product,
      productTypeDetails: {
        audience: "unisex",
        customizationEnabled: true,
        customizationOptions: ["custom_engraving"],
      },
    };

    vi.mocked(useQuery).mockImplementation(((_query, args) => {
      if (args && typeof args === "object" && "productSlug" in args) {
        return handicraftProduct as never;
      }
      if (args && typeof args === "object" && "slug" in args) {
        return handicraftBusiness as never;
      }

      if (args && typeof args === "object" && "productId" in args) {
        return handicraftProduct as never;
      }

      if (args && typeof args === "object" && "excludeProductId" in args) {
        return [] as never;
      }

      return undefined;
    }) as typeof useQuery);

    renderProductDetail();

    expect(screen.getByText("Audience")).toBeInTheDocument();
    expect(screen.getByText("Unisex")).toBeInTheDocument();
    expect(screen.getByText("Personalization")).toBeInTheDocument();
    expect(
      screen.getAllByText("Custom engraving (names, dates, quotes)").length,
    ).toBeGreaterThan(0);
  });
});
