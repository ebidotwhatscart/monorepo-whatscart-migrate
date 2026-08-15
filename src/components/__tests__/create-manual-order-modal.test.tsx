import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { CreateManualOrderModal } from "../CreateManualOrderModal";
import { Id } from "../../../convex/_generated/dataModel";

const mockCreateManualOrder = vi.fn();
const mockProducts = [
  {
    _id: "prod_1" as Id<"products">,
    name: "Red Saree",
    price: 1500,
    inStock: true,
    imageIds: [],
    searchableText: "Red Saree",
  },
  {
    _id: "prod_2" as Id<"products">,
    name: "Blue Kurti",
    price: 800,
    inStock: true,
    imageIds: [],
    searchableText: "Blue Kurti",
  },
];

vi.mock("convex/react", () => ({
  useQuery: () => mockProducts,
  useMutation: () => mockCreateManualOrder,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("CreateManualOrderModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders modal and validates required fields", async () => {
    const onClose = vi.fn();
    render(
      <CreateManualOrderModal
        businessId={"biz_123" as Id<"businesses">}
        isOpen={true}
        onClose={onClose}
      />
    );

    expect(screen.getByText("Record Offline Order")).toBeInTheDocument();
    
    // Submit without items
    const submitBtn = screen.getByRole("button", { name: /save order/i });
    expect(submitBtn).toBeDisabled();
  });

  test("allows adding catalog products and custom items to an order", async () => {
    const onClose = vi.fn();
    render(
      <CreateManualOrderModal
        businessId={"biz_123" as Id<"businesses">}
        isOpen={true}
        onClose={onClose}
      />
    );

    // Fill customer info
    fireEvent.change(screen.getByPlaceholderText("e.g. Rahul Sharma"), {
      target: { value: "John Doe" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g. +919876543210"), {
      target: { value: "9876543210" },
    });

    // Add product from catalog
    const selects = screen.getAllByRole("combobox");
    const catalogSelect = selects[0];
    fireEvent.change(catalogSelect, { target: { value: "prod_1" } });
    
    const addBtn = screen.getByRole("button", { name: /Add$/i });
    fireEvent.click(addBtn);

    expect(screen.getByText("Red Saree")).toBeInTheDocument();
    expect(screen.getAllByText(/1500\.00/).length).toBeGreaterThan(0);

    // Switch to custom item
    const customTab = screen.getByRole("button", { name: /external \/ custom item/i });
    fireEvent.click(customTab);

    fireEvent.change(screen.getByPlaceholderText(/external product name/i), {
      target: { value: "Custom Box" },
    });
    fireEvent.change(screen.getByPlaceholderText(/price/i), {
      target: { value: "500" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add item/i }));

    expect(screen.getByText("Custom Box")).toBeInTheDocument();
    expect(screen.getAllByText(/2000\.00/).length).toBeGreaterThan(0); // 1500 + 500

    // Submit form
    mockCreateManualOrder.mockResolvedValueOnce({ orderId: "BIZ00001" });
    const submitBtn = screen.getByRole("button", { name: /save order/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockCreateManualOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: "biz_123",
          customerName: "John Doe",
          customerMobile: "9876543210",
          totalAmount: 2000,
          items: [
            expect.objectContaining({ productId: "prod_1", name: "Red Saree", price: 1500, quantity: 1 }),
            expect.objectContaining({ name: "Custom Box", price: 500, quantity: 1 }),
          ],
        })
      );
      expect(onClose).toHaveBeenCalled();
    });
  });
});
