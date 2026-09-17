import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useFirebaseMutation as useMutation } from "../../lib/firebase/mutations";
import { useFirebaseQuery as useQuery } from "../../lib/firebase/hooks";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../lib/firebase/operations";
import { BusinessLayout } from "../BusinessLayout";
import { ProductsPage } from "../ProductsPage";

vi.mock("../../lib/firebase/hooks", () => ({
  useFirebaseQuery: vi.fn(),
}));
vi.mock("../../lib/firebase/mutations", () => ({
  useFirebaseMutation: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockMutation = vi.fn();
const mockCreateCollection = vi.fn();

const business = {
  _id: "biz_1" as never,
  name: "Demo Store",
  slug: "demo-store",
  themeColor: "#3DAC35",
  whatsappPhone: "919999999999",
  businessType: "garments",
};

const product = {
  _id: "product_1",
  businessId: "biz_1",
  categoryId: "cat_1",
  name: "Organic Cotton Tee",
  description: "Soft everyday tee",
  searchableText: "Organic Cotton Tee Soft everyday tee",
  price: 193,
  inStock: true,
  imageIds: [],
  imageUrls: ["https://example.com/tee.jpg"],
  category: { _id: "cat_1", name: "Garments" },
};

const secondProduct = {
  ...product,
  _id: "product_2",
  name: "Linen Trousers",
  price: 249,
  imageUrls: [],
};

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="pathname">{location.pathname}</div>;
}

function renderProducts(initialEntry: string) {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/dashboard/products/*"
          element={<ProductsPage business={business} />}
        />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe("dashboard product routes", () => {
  beforeEach(() => {
    vi.mocked(useQuery).mockReset();
    vi.mocked(useMutation).mockReset();
    mockMutation.mockReset();
    mockCreateCollection.mockReset();
    if (!navigator.clipboard) {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async () => undefined,
        },
      });
    }
    vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);

    vi.mocked(useMutation).mockImplementation(() => mockCreateCollection as never);
    vi.mocked(useQuery).mockImplementation(((_query, args) => {
      if (args === "skip") return undefined;

      if (args && typeof args === "object" && "productId" in args) {
      if (_query === api.analytics.getProductPerformance) {
          return { totalViews: 12, timesShared: 3 } as never;
        }

        if (_query === api.products.getProductVariants) return [] as never;

        return product as never;
      }

      if (_query === api.products.getBusinessProducts) {
        return [product, secondProduct] as never;
      }

      return undefined;
    }) as typeof useQuery);
  });

  it("opens the product view route when a product card is clicked", async () => {
    const user = userEvent.setup();
    renderProducts("/dashboard/products");

    await user.click(
      screen.getByRole("button", { name: /view organic cotton tee/i }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("pathname")).toHaveTextContent(
        "/dashboard/products/view/product_1",
      );
    });
    expect(
      screen.getByRole("heading", { name: /product details/i }),
    ).toBeInTheDocument();
  });

  it("keeps product selection hidden until Create Collection starts selection mode", async () => {
    const user = userEvent.setup();
    mockCreateCollection.mockResolvedValue({ catalogId: "share123" });
    renderProducts("/dashboard/products");

    expect(
      screen.queryByRole("button", { name: /select organic cotton tee/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /create collection/i }));

    await user.click(
      screen.getByRole("button", { name: /select organic cotton tee/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /select linen trousers/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /^create collection$/i }),
    );

    expect(
      screen.getByRole("dialog", { name: /share collection/i }),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText(/collection name/i), "Summer Picks");
    await user.click(screen.getByRole("button", { name: /copy link/i }));

    await waitFor(() => {
      expect(mockCreateCollection).toHaveBeenCalledWith({
        businessId: "biz_1",
        name: "Summer Picks",
        productIds: ["product_1", "product_2"],
      });
    });
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining("catalog/share123"),
      );
    });
  });

  it("shows Collections as a tab inside the Products section", () => {
    vi.mocked(useQuery).mockImplementation(((_query, args) => {
      if (args && typeof args === "object" && "businessId" in args) {
        return [
          {
            _id: "catalog_1",
            catalogId: "share123",
            name: "Festival Picks",
            productIds: ["product_1"],
            createdAt: 1710000000000,
            updatedAt: 1710000000000,
          },
        ] as never;
      }

      return undefined;
    }) as typeof useQuery);

    renderProducts("/dashboard/products/collections");

    expect(screen.getByRole("tab", { name: /^products$/i })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /^collections$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /collections/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Festival Picks")).toBeInTheDocument();
  });

  it("renders the Products title and section tabs in the same Figma-style header", () => {
    renderProducts("/dashboard/products");

    const productsHeading = screen.getByRole("heading", {
      name: /^products$/i,
    });
    const header = productsHeading.closest("header");

    expect(header).not.toBeNull();
    expect(
      within(header as HTMLElement).getByRole("tablist", {
        name: /products section/i,
      }),
    ).toBeInTheDocument();
  });

  it("does not show Collections as a bottom navigation item", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/products"]}>
        <BusinessLayout business={business}>
          <div>Products content</div>
        </BusinessLayout>
      </MemoryRouter>,
    );

    expect(screen.getByText("PRODUCTS")).toBeInTheDocument();
    expect(screen.queryByText("CATALOGS")).not.toBeInTheDocument();
    expect(screen.queryByText("COLLECTIONS")).not.toBeInTheDocument();
  });

  it("uses the fixed admin green accent for the active bottom navigation item", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/products"]}>
        <BusinessLayout
          business={{ ...business, themeColor: "#884422" }}
        >
          <div>Products content</div>
        </BusinessLayout>
      </MemoryRouter>,
    );

    expect(screen.getByText("PRODUCTS")).toHaveStyle({ color: "#3DAC35" });
  });

  it("opens the product edit route from the card action menu", async () => {
    const user = userEvent.setup();
    renderProducts("/dashboard/products");

    await user.click(
      screen.getByRole("button", { name: /open actions for organic cotton tee/i }),
    );
    await user.click(screen.getByRole("button", { name: /^edit$/i }));

    await waitFor(() => {
      expect(screen.getByTestId("pathname")).toHaveTextContent(
        "/dashboard/products/edit/product_1",
      );
    });
    expect(
      screen.getByRole("heading", { name: /edit product/i }),
    ).toBeInTheDocument();
  });

  it("shows product performance analytics on the dashboard product view", () => {
    renderProducts("/dashboard/products/view/product_1");

    expect(
      screen.getByRole("heading", { name: /product details/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Organic Cotton Tee")).toBeInTheDocument();
    expect(screen.getByText("Total Views")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Times Shared")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
