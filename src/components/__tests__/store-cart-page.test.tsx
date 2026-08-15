import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useFirebaseQuery as useQuery } from "../../lib/firebase/hooks";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StoreCartPage } from "../StoreCartPage";

vi.mock("../../lib/firebase/hooks", () => ({
  useFirebaseQuery: vi.fn(),
}));

const mockUpdateQuantity = vi.fn();
const mockRemoveItem = vi.fn();

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
    updateQuantity: mockUpdateQuantity,
    removeItem: mockRemoveItem,
    getTotalItems: () => 2,
    getTotalPrice: () => 11900,
  }),
}));

const business = {
  _id: "biz_1",
  name: "Kanchi House",
  slug: "kanchi-house",
  themeColor: "#046664",
  whatsappPhone: "919999999999",
};

const products = [
  {
    _id: "product_1",
    name: "Handloom Kanchipuram Silk Saree",
    imageUrls: ["https://example.com/saree.jpg"],
  },
  {
    _id: "product_2",
    name: "Temple Jewelry Set",
    imageUrls: ["https://example.com/jewelry.jpg"],
  },
];

function renderCartPage() {
  render(
    <MemoryRouter initialEntries={["/store/kanchi-house/cart"]}>
      <Routes>
        <Route path="/store/:slug/cart" element={<StoreCartPage />} />
        <Route path="/checkout" element={<div>Checkout page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("StoreCartPage", () => {
  beforeEach(() => {
    vi.mocked(useQuery).mockReset();
    mockUpdateQuantity.mockReset();
    mockRemoveItem.mockReset();

    vi.mocked(useQuery).mockImplementation(((_query, args) => {
      if (args && typeof args === "object" && "slug" in args) {
        return business as never;
      }

      if (args && typeof args === "object" && "businessId" in args) {
        return products as never;
      }

      return undefined;
    }) as typeof useQuery);
  });

  it("renders the Figma cart page with items, shipping details, and order CTA", async () => {
    const user = userEvent.setup();
    renderCartPage();

    expect(screen.getByRole("heading", { name: "Your Cart" })).toBeInTheDocument();
    expect(screen.getByText("2 Items")).toBeInTheDocument();
    expect(screen.getByText("Handloom Kanchipuram Silk Saree")).toBeInTheDocument();
    expect(screen.getByText("Temple Jewelry Set")).toBeInTheDocument();
    expect(screen.getByText("Subtotal")).toBeInTheDocument();
    expect(screen.getAllByText("₹11,900").length).toBeGreaterThan(0);
    expect(screen.getByRole("img", { name: /whatscart logo/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Powered by WhatsCart" })).toHaveAttribute(
      "href",
      "https://whatscart.in/",
    );

    await user.click(within(screen.getByLabelText("Handloom Kanchipuram Silk Saree item")).getByRole("button", { name: /increase quantity/i }));
    expect(mockUpdateQuantity).toHaveBeenCalledWith("product_1", 2);

    await user.click(screen.getByRole("button", { name: /place order/i }));
    expect(screen.getByText("Checkout page")).toBeInTheDocument();
  });
});
