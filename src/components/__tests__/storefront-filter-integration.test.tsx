import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useFirebaseQuery as useQuery } from "../../lib/firebase/hooks";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Storefront } from "../Storefront";

vi.mock("../../lib/firebase/hooks", () => ({
  useFirebaseQuery: vi.fn(),
}));

vi.mock("../../context/CartContext", () => ({
  useCart: () => ({
    getTotalItems: () => 0,
    updateBusinessId: vi.fn(),
  }),
}));

vi.mock("../../hooks/useAnalytics", () => ({
  useAnalytics: () => ({
    trackPage: vi.fn(),
  }),
}));

const business = {
  _id: "biz_filters",
  name: "Variant Store",
  slug: "variant-store",
  themeColor: "#046664",
  whatsappPhone: "919999999999",
  businessType: "garments",
  featuredProductIds: [],
};

const products = [
  {
    _id: "red_product",
    businessId: "biz_filters",
    name: "Red Kurta",
    price: 1200,
    inStock: true,
    imageUrls: [],
  },
  {
    _id: "blue_product",
    businessId: "biz_filters",
    name: "Blue Kurta",
    price: 1800,
    inStock: true,
    imageUrls: [],
  },
];

describe("Storefront filter integration", () => {
  beforeEach(() => {
    let businessDataQueryCount = 0;
    vi.mocked(useQuery).mockImplementation(((_query, args) => {
      if (args === "skip") return undefined;
      if (args && typeof args === "object" && "slug" in args) {
        businessDataQueryCount = 0;
        return business as never;
      }
      if (args && typeof args === "object" && "businessId" in args) {
        businessDataQueryCount += 1;
        return businessDataQueryCount % 2 === 1
          ? (products as never)
          : ([] as never);
      }
      return undefined;
    }) as typeof useQuery);
  });

  it("opens from the storefront filter control and applies a price range", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/store/variant-store"]}>
        <Routes>
          <Route path="/store/:slug" element={<Storefront />} />
        </Routes>
      </MemoryRouter>,
    );

    const productGrid = screen.getByRole("region", { name: "Products" });
    expect(within(productGrid).getByText("Red Kurta")).toBeInTheDocument();
    expect(within(productGrid).getByText("Blue Kurta")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: /^filter$/i })[0]);
    fireEvent.change(screen.getByRole("slider", { name: /maximum price/i }), {
      target: { value: "1500" },
    });
    await user.click(
      screen.getByRole("button", { name: /apply filters/i }),
    );

    expect(within(productGrid).getByText("Red Kurta")).toBeInTheDocument();
    expect(within(productGrid).queryByText("Blue Kurta")).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /filter/i })[0],
    ).toHaveTextContent("1");
  });
});
