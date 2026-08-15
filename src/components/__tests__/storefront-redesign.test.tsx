import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQuery } from "convex/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Storefront } from "../Storefront";
import { createStorefrontTheme } from "../../lib/storefrontTheme";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

const mockAddItem = vi.fn();
const mockUpdateBusinessId = vi.fn();

vi.mock("../../context/CartContext", () => ({
  useCart: () => ({
    items: [
      {
        productId: "product_1",
        name: "Handloom Kanchipuram Silk Saree",
        price: 8500,
        quantity: 1,
      },
      {
        productId: "product_2",
        name: "Temple Jewelry Set",
        price: 3400,
        quantity: 1,
      },
    ],
    addItem: mockAddItem,
    updateBusinessId: mockUpdateBusinessId,
    getTotalItems: () => 2,
    getTotalPrice: () => 11900,
  }),
}));

vi.mock("../../hooks/useAnalytics", () => ({
  useAnalytics: () => ({
    trackPage: vi.fn(),
  }),
}));

vi.mock("../CartSidebar", () => ({
  CartSidebar: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div>Cart sidebar open</div> : null,
}));

const business = {
  _id: "biz_1",
  name: "Kanchi House",
  slug: "kanchi-house",
  themeColor: "#046664",
  brandPalette: {
    seedColor: "#046664",
    mode: "light" as const,
    colors: ["#f5fbfa", "#046664", "#d28b4e", "#17323c"],
    primaryColor: "#046664",
  },
  logoUrl: "https://example.com/logo.png",
  whatsappPhone: "919999999999",
  description: "Premium silk sarees and temple jewelry curated for festive occasions.",
};

const products = [
  {
    _id: "product_1",
    businessId: "biz_1",
    categoryId: "cat_1",
    name: "Handloom Kanchipuram Silk Saree",
    description: "Authentic hand-woven pure silk from Kanchipuram.",
    price: 8500,
    inStock: true,
    imageUrls: ["https://example.com/saree.jpg"],
  },
  {
    _id: "product_2",
    businessId: "biz_1",
    categoryId: "cat_2",
    name: "Temple Jewelry Set",
    description: "Traditional finish jewelry.",
    price: 3400,
    inStock: true,
    imageUrls: ["https://example.com/jewelry.jpg"],
  },
];

const categories = [
  { _id: "cat_1", name: "Sarees" },
  { _id: "cat_2", name: "Jewelry" },
];
const storefrontTheme = createStorefrontTheme({
  themeColor: business.themeColor,
  brandPalette: business.brandPalette,
});

function renderStorefront() {
  render(
    <MemoryRouter initialEntries={["/store/kanchi-house"]}>
      <Routes>
        <Route path="/store/:slug" element={<Storefront />} />
        <Route path="/store/:slug/cart" element={<div>Cart page route</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Storefront redesign", () => {
  beforeEach(() => {
    vi.mocked(useQuery).mockReset();
    mockAddItem.mockReset();
    mockUpdateBusinessId.mockReset();

    let publicBusinessQueryCount = 0;

    vi.mocked(useQuery).mockImplementation(((_query, args) => {
      if (args === "skip") return undefined;

      if (args && typeof args === "object" && "slug" in args) {
        publicBusinessQueryCount = 0;
        return business as never;
      }

      if (args && typeof args === "object" && "searchTerm" in args) {
        return products.filter((product) =>
          product.name.toLowerCase().includes(String(args.searchTerm).toLowerCase()),
        ) as never;
      }

      if (args && typeof args === "object" && "businessId" in args) {
        publicBusinessQueryCount += 1;
        return publicBusinessQueryCount % 2 === 1 ? (products as never) : (categories as never);
      }

      return undefined;
    }) as typeof useQuery);
  });

  it("renders the Figma-style storefront shell and featured product", () => {
    renderStorefront();

    expect(screen.getByText("Shipping available across India")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search")).toBeInTheDocument();
    expect(screen.getAllByText("New Arrival").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", {
        name: /handloom kanchipuram silk saree/i,
      }),
    ).toBeInTheDocument();
    for (const link of screen.getAllByRole("link", {
      name: /view handloom kanchipuram silk saree/i,
    })) {
      expect(link).toHaveAttribute(
        "href",
        "/store/kanchi-house/products/handloom-kanchipuram-silk-saree-duct_1",
      );
    }
    expect(screen.getAllByRole("button", { name: "Sarees" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Price: Low to High").length).toBeGreaterThan(0);

    const grid = screen.getByLabelText("Products");
    expect(within(grid).getByText("Temple Jewelry Set")).toBeInTheDocument();
    expect(within(grid).getByText("₹3,400")).toBeInTheDocument();

    expect(screen.getByText("Shipping available across India")).toHaveStyle({
      backgroundColor: storefrontTheme.shippingBarBackground,
      color: storefrontTheme.shippingBarText,
    });
  });

  it("renders dedicated mobile and desktop loading skeleton layouts", () => {
    vi.mocked(useQuery).mockImplementation(() => undefined as never);

    renderStorefront();

    expect(screen.getByTestId("storefront-skeleton-mobile")).toBeInTheDocument();
    expect(screen.getByTestId("storefront-skeleton-desktop")).toBeInTheDocument();
  });

  it("renders the Figma-style desktop storefront layout", () => {
    renderStorefront();

    const headerBrand = screen.getByRole("link", { name: "Kanchi House" });
    expect(headerBrand).toHaveClass("lg:h-11", "lg:max-w-[220px]", "lg:px-4");

    const desktopNavigation = screen.getByRole("navigation", {
      name: /desktop storefront categories/i,
    });
    const homeButton = within(desktopNavigation).getByRole("button", { name: "Home" });
    expect(homeButton).toHaveAttribute("aria-current", "page");
    expect(homeButton).toHaveClass("self-center");
    expect(within(desktopNavigation).getByRole("button", { name: "Sarees" })).toBeInTheDocument();
    expect(within(desktopNavigation).getByRole("button", { name: "Jewelry" })).toBeInTheDocument();

    const desktopSearch = screen.getByRole("button", { name: "Search" });
    expect(desktopSearch).toHaveClass("lg:h-12", "lg:rounded-2xl", "lg:border");
    expect(screen.getByRole("button", { name: /desktop cart/i })).toHaveClass(
      "lg:h-12",
      "lg:min-w-[56px]",
      "lg:rounded-2xl",
    );

    const desktopHero = screen.getByRole("region", { name: /featured products/i });
    expect(
      within(desktopHero).getByRole("heading", {
        name: /handloom kanchipuram silk saree/i,
        level: 1,
      }),
    ).toBeInTheDocument();
    for (const link of within(desktopHero).getAllByRole("link", {
      name: /view handloom kanchipuram silk saree/i,
    })) {
      expect(link).toHaveAttribute(
        "href",
        "/store/kanchi-house/products/handloom-kanchipuram-silk-saree-duct_1",
      );
    }

    const desktopCategories = screen.getByRole("navigation", {
      name: /desktop collection categories/i,
    });
    expect(within(desktopCategories).getByRole("button", { name: "All Collections" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    expect(screen.getByLabelText("Desktop product filters")).toHaveClass("lg:flex");
    expect(screen.getByLabelText("Products")).toHaveClass("lg:grid-cols-4");
  });

  it("sorts product cards by price", async () => {
    const user = userEvent.setup();
    renderStorefront();

    await user.click(screen.getByRole("button", { name: /price: low to high/i }));
    const filterDialog = screen.getByRole("dialog", {
      name: /filters & sort/i,
    });
    await user.click(
      within(filterDialog).getByRole("radio", {
        name: /price: high to low/i,
      }),
    );
    await user.click(
      within(filterDialog).getByRole("button", { name: /apply filters/i }),
    );

    expect(screen.getByRole("button", { name: /price: high to low/i })).toBeInTheDocument();
  });

  it("shows featured products as a carousel with selectable slides", async () => {
    const user = userEvent.setup();
    renderStorefront();

    const carousel = screen.getByRole("region", { name: /featured products/i });

    expect(within(carousel).getAllByRole("group", { name: /featured product/i })).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: /show featured product 2/i }));

    expect(
      within(carousel).getAllByRole("heading", {
        name: /temple jewelry set/i,
      }),
    ).not.toHaveLength(0);

    for (const link of within(carousel).getAllByRole("link", {
      name: /view temple jewelry set/i,
    })) {
      expect(link).toHaveAttribute(
        "href",
        "/store/kanchi-house/products/temple-jewelry-set-duct_2",
      );
    }
  });

  it("renders the Figma-style mobile footer with store details and category links", () => {
    renderStorefront();

    const footer = screen.getByRole("contentinfo");

    expect(within(footer).getByRole("img", { name: "Kanchi House" })).toBeInTheDocument();
    expect(
      within(footer).getByText("Premium silk sarees and temple jewelry curated for festive occasions."),
    ).toBeInTheDocument();
    expect(within(footer).getByText("Powered by")).toBeInTheDocument();
    expect(within(footer).getByText("Whatscart")).toBeInTheDocument();
    expect(within(footer).getByRole("img", { name: /whatscart logo/i })).toBeInTheDocument();
    expect(within(footer).getByRole("link", { name: "Powered by WhatsCart" })).toHaveAttribute(
      "href",
      "https://whatscart.in/",
    );
    expect(within(footer).getByRole("link", { name: /contact on whatsapp/i })).toHaveAttribute(
      "href",
      "https://wa.me/919999999999",
    );
    expect(within(footer).getByRole("button", { name: "Sarees" })).toBeInTheDocument();
    expect(within(footer).getByRole("button", { name: "Jewelry" })).toBeInTheDocument();
    expect(within(footer).getByText("© 2026 Kanchi House.inc.")).toBeInTheDocument();
  });

  it("opens a category sidebar from the Figma header menu", async () => {
    const user = userEvent.setup();
    renderStorefront();

    const headerBrand = screen.getByRole("link", { name: "Kanchi House" });
    expect(headerBrand).toHaveClass("mx-auto");
    expect(headerBrand.querySelector("img")).toHaveAttribute(
      "src",
      "https://example.com/logo.png",
    );
    expect(screen.getByRole("button", { name: /open categories/i })).toBeInTheDocument();
    expect(
      within(screen.getByRole("button", { name: /open cart/i })).getByRole(
        "img",
        { name: /^cart$/i },
      ),
    ).toHaveAttribute(
      "src",
      expect.stringContaining("data:image/svg+xml"),
    );

    await user.click(screen.getByRole("button", { name: /open categories/i }));

    const sidebar = screen.getByRole("dialog", { name: /categories/i });
    expect(within(sidebar).getByRole("button", { name: "Sarees" })).toBeInTheDocument();
    expect(within(sidebar).getByRole("button", { name: "Jewelry" })).toBeInTheDocument();
    expect(within(sidebar).getByRole("button", { name: "Sarees" })).toHaveTextContent("Sarees");
    expect(
      within(sidebar).getByText("Kanchi House").parentElement?.querySelector("img"),
    ).toHaveAttribute("src", "https://example.com/logo.png");
    expect(within(sidebar).getByText("Powered by")).toBeInTheDocument();
    expect(within(sidebar).getByText("Whatscart")).toBeInTheDocument();
    expect(within(sidebar).getByRole("img", { name: /whatscart logo/i })).toBeInTheDocument();

    await user.click(within(sidebar).getByRole("button", { name: "Jewelry" }));

    expect(screen.queryByRole("dialog", { name: /categories/i })).not.toBeInTheDocument();
    const grid = screen.getByLabelText("Products");
    expect(within(grid).queryByText("Handloom Kanchipuram Silk Saree")).not.toBeInTheDocument();
    expect(within(grid).getByText("Temple Jewelry Set")).toBeInTheDocument();
  });

  it("navigates to the cart page instead of opening a cart sidebar", async () => {
    const user = userEvent.setup();
    renderStorefront();

    await user.click(screen.getByRole("button", { name: /open cart/i }));

    expect(screen.getByText("Cart page route")).toBeInTheDocument();
    expect(screen.queryByText("Cart sidebar open")).not.toBeInTheDocument();
  });
});
