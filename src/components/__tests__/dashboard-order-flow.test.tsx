import { render, screen, waitFor } from "@testing-library/react";
import { useMutation, useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import { OrderDetailPage } from "../OrderDetailPage";
import { OrderManagement } from "../OrderManagement";
import { OrderProductModal } from "../OrderProductModal";

const mockUpdateOrderStatus = vi.fn();
const mockSetOrderBillingExclusion = vi.fn();
const mockCreateReviewRequest = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => mockUpdateOrderStatus),
}));

const mockOrder = {
  _id: "order_123",
  orderId: "ORD123",
  customerName: "Jane Smith",
  customerMobile: "+918000000000",
  customerAddress: "22 Market Road, Coimbatore",
  totalAmount: 1499,
  status: "pending",
  createdAt: 1710000000000,
  itemsDetailed: [
    {
      productId: "product_1",
      name: "Green Cotton Shirt",
      price: 1299,
      quantity: 1,
      image: "https://example.com/shirt.jpg",
      product: {
        _id: "product_1",
        name: "Green Cotton Shirt",
        description: "Soft cotton shirt",
        price: 1299,
        inStock: true,
        imageUrls: ["https://example.com/shirt.jpg"],
        category: { _id: "cat_1", name: "Garments" },
      },
    },
  ],
};

const mockProduct = mockOrder.itemsDetailed[0].product;

function mockOrderQuery() {
  vi.mocked(useQuery).mockImplementation(((_query, args) => {
    if (args && typeof args === "object" && "orderId" in args) {
      return mockOrder;
    }
    return undefined;
  }) as typeof useQuery);
}

function renderOrderDetailRoute(initialEntry = "/dashboard/orders/order_123") {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/dashboard/orders/:orderId"
          element={
            <OrderDetailPage
              business={{
                _id: "biz_1" as never,
                whatsappPhone: "919999999999",
              }}
            />
          }
        >
          <Route path="products/:productId" element={<OrderProductModal />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("OrderDetailPage", () => {
  beforeEach(() => {
    vi.mocked(useQuery).mockReset();
    vi.mocked(useMutation).mockReset();
    vi.mocked(useMutation).mockImplementation(((mutation) =>
      getFunctionName(mutation) === "orders:setOrderBillingExclusion"
        ? mockSetOrderBillingExclusion
        : mockUpdateOrderStatus) as typeof useMutation);
    mockUpdateOrderStatus.mockReset();
    mockSetOrderBillingExclusion.mockReset();
    mockCreateReviewRequest.mockReset();
  });

  it("renders customer info, item rows, and total when detail data is available", () => {
    vi.mocked(useQuery).mockReturnValue(mockOrder as never);

    render(
      <MemoryRouter initialEntries={["/dashboard/orders/order_123"]}>
        <Routes>
          <Route
            path="/dashboard/orders/:orderId"
            element={<OrderDetailPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    expect(screen.getByText("+918000000000")).toBeInTheDocument();
    expect(screen.getByText("22 Market Road, Coimbatore")).toBeInTheDocument();
    expect(screen.getByText("Green Cotton Shirt")).toBeInTheDocument();
    expect(screen.getByText(/1499(?:\.00)?/)).toBeInTheDocument();
  });

  it("shows confirm and decline actions only while an order is pending", () => {
    vi.mocked(useQuery).mockReturnValue(mockOrder as never);

    const { unmount } = render(
      <MemoryRouter initialEntries={["/dashboard/orders/order_123"]}>
        <Routes>
          <Route
            path="/dashboard/orders/:orderId"
            element={<OrderDetailPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("link", { name: /chat on whatsapp/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /confirm order/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /decline order/i }),
    ).toBeInTheDocument();

    unmount();
    vi.mocked(useQuery).mockReturnValue({
      ...mockOrder,
      status: "confirmed",
    } as never);
    render(
      <MemoryRouter initialEntries={["/dashboard/orders/order_123"]}>
        <Routes>
          <Route
            path="/dashboard/orders/:orderId"
            element={<OrderDetailPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("link", { name: /chat on whatsapp/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /confirm order/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /decline order/i }),
    ).not.toBeInTheDocument();
  });

  it("can exclude an order from billing without removing it", async () => {
    const user = userEvent.setup();
    mockSetOrderBillingExclusion.mockResolvedValue({
      orderId: "order_123",
      excludedFromBilling: true,
    });
    vi.mocked(useQuery).mockReturnValue(mockOrder as never);

    render(
      <MemoryRouter initialEntries={["/dashboard/orders/order_123"]}>
        <Routes>
          <Route
            path="/dashboard/orders/:orderId"
            element={<OrderDetailPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: /exclude from billing/i }),
    );

    await waitFor(() =>
      expect(mockSetOrderBillingExclusion).toHaveBeenCalledWith({
        orderId: "order_123",
        excluded: true,
      }),
    );
    expect(screen.getByText("Included")).toBeInTheDocument();
  });

  it("offers to restore an excluded order to billing", () => {
    vi.mocked(useQuery).mockReturnValue({
      ...mockOrder,
      excludedFromBilling: true,
    } as never);

    render(
      <MemoryRouter initialEntries={["/dashboard/orders/order_123"]}>
        <Routes>
          <Route
            path="/dashboard/orders/:orderId"
            element={<OrderDetailPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Excluded")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /include in billing/i }),
    ).toBeInTheDocument();
  });

  it("renders the line total for an item when quantity is greater than one", () => {
    vi.mocked(useQuery).mockReturnValue({
      ...mockOrder,
      totalAmount: 3098,
      itemsDetailed: [
        {
          ...mockOrder.itemsDetailed[0],
          quantity: 2,
        },
      ],
    } as never);

    render(
      <MemoryRouter initialEntries={["/dashboard/orders/order_123"]}>
        <Routes>
          <Route
            path="/dashboard/orders/:orderId"
            element={<OrderDetailPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Qty: 2")).toBeInTheDocument();
    expect(screen.getByText(/2598(?:\.00)?/)).toBeInTheDocument();
  });

  it("opens WhatsApp to the customer with the cart and secure feedback link", async () => {
    const user = userEvent.setup();
    const popup = {
      opener: window,
      location: { href: "about:blank" },
      close: vi.fn(),
    };
    const openSpy = vi.spyOn(window, "open").mockReturnValue(popup as never);
    mockCreateReviewRequest.mockResolvedValue({
      token: "a".repeat(64),
      status: "open",
      productCount: 1,
      lastSentAt: 1,
    });
    vi.mocked(useQuery).mockImplementation(((query) => {
      const name = getFunctionName(query);
      if (name === "orders:getBusinessOrderDetail") {
        return {
          ...mockOrder,
          status: "confirmed",
          business: {
            name: "Kanchi House",
            slug: "kanchi-house",
            whatsappPhone: "919999999999",
          },
        } as never;
      }
      if (name === "reviews:getOrderReviews") {
        return { request: null, reviews: [] } as never;
      }
      return undefined;
    }) as typeof useQuery);
    vi.mocked(useMutation).mockImplementation(((mutation) =>
      getFunctionName(mutation) === "reviews:createReviewRequest"
        ? mockCreateReviewRequest
        : mockUpdateOrderStatus) as typeof useMutation);

    renderOrderDetailRoute();
    await user.click(screen.getByRole("button", { name: /ask for feedback/i }));

    await waitFor(() =>
      expect(mockCreateReviewRequest).toHaveBeenCalledWith({
        orderId: "order_123",
      }),
    );
    expect(popup.location.href).toContain("https://wa.me/918000000000?text=");
    expect(decodeURIComponent(popup.location.href)).toContain(
      "1 × Green Cotton Shirt",
    );
    expect(decodeURIComponent(popup.location.href)).toContain(
      `/review/${"a".repeat(64)}`,
    );
    openSpy.mockRestore();
  });

  it("returns to the dashboard orders page from a direct-loaded order detail route", async () => {
    const user = userEvent.setup();
    vi.mocked(useQuery).mockReturnValue(mockOrder as never);

    render(
      <MemoryRouter initialEntries={["/dashboard/orders/order_123"]}>
        <Routes>
          <Route
            path="/dashboard/orders"
            element={<div>Dashboard orders</div>}
          />
          <Route
            path="/dashboard/orders/:orderId"
            element={<OrderDetailPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /go back/i }));
    expect(screen.getByText("Dashboard orders")).toBeInTheDocument();
  });

  it("navigates to the dashboard order detail page when an order card is pressed", async () => {
    const user = userEvent.setup();
    vi.mocked(useQuery).mockReturnValue([
      {
        _id: "order_123",
        orderId: "ORD123",
        customerName: "Jane Smith",
        status: "pending",
        totalAmount: 1499,
        createdAt: 1710000000000,
        items: [
          {
            name: "Green Cotton Shirt",
            quantity: 1,
          },
        ],
      },
    ] as never);

    render(
      <MemoryRouter initialEntries={["/dashboard/orders"]}>
        <Routes>
          <Route
            path="/dashboard/orders"
            element={<OrderManagement businessId={"biz_1" as never} />}
          />
          <Route
            path="/dashboard/orders/:orderId"
            element={<div>Order detail route</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: /view order ord123/i }),
    );
    expect(screen.getByText("Order detail route")).toBeInTheDocument();
  });

  it("shows the Figma share-feedback action for a confirmed order", async () => {
    const user = userEvent.setup();
    const popup = {
      opener: window,
      location: { href: "about:blank" },
      close: vi.fn(),
    };
    const openSpy = vi.spyOn(window, "open").mockReturnValue(popup as never);
    mockCreateReviewRequest.mockResolvedValue({
      token: "b".repeat(64),
      status: "open",
      productCount: 1,
      lastSentAt: 1,
    });
    vi.mocked(useQuery).mockImplementation(((query) => {
      const name = getFunctionName(query);
      if (name === "orders:getBusinessOrders") {
        return [
          {
            ...mockOrder,
            status: "confirmed",
            items: mockOrder.itemsDetailed,
          },
        ] as never;
      }
      if (name === "reviews:getBusinessReviewRequestStates") {
        return [] as never;
      }
      return undefined;
    }) as typeof useQuery);
    vi.mocked(useMutation).mockImplementation(((mutation) =>
      getFunctionName(mutation) === "reviews:createReviewRequest"
        ? mockCreateReviewRequest
        : mockUpdateOrderStatus) as typeof useMutation);

    render(
      <MemoryRouter initialEntries={["/dashboard/orders"]}>
        <Routes>
          <Route
            path="/dashboard/orders"
            element={
              <OrderManagement
                businessId={"biz_1" as never}
                business={{ name: "Kanchi House", slug: "kanchi-house" }}
              />
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: /share feedback form/i }),
    );
    await waitFor(() =>
      expect(mockCreateReviewRequest).toHaveBeenCalledWith({
        orderId: "order_123",
      }),
    );
    expect(decodeURIComponent(popup.location.href)).toContain(
      `/review/${"b".repeat(64)}`,
    );
    expect(
      screen.queryByRole("button", { name: /view feedback form/i }),
    ).not.toBeInTheDocument();
    openSpy.mockRestore();
  });

  it("replaces the share action with the Figma view-feedback state after submission", async () => {
    const user = userEvent.setup();
    vi.mocked(useQuery).mockImplementation(((query) => {
      const name = getFunctionName(query);
      if (name === "orders:getBusinessOrders") {
        return [
          {
            ...mockOrder,
            status: "confirmed",
            items: mockOrder.itemsDetailed,
          },
        ] as never;
      }
      if (name === "reviews:getBusinessReviewRequestStates") {
        return [
          {
            orderId: "order_123",
            status: "submitted",
            requestedAt: 1710000000000,
            submittedAt: 1710001000000,
          },
        ] as never;
      }
      return undefined;
    }) as typeof useQuery);

    render(
      <MemoryRouter initialEntries={["/dashboard/orders"]}>
        <Routes>
          <Route
            path="/dashboard/orders"
            element={
              <OrderManagement
                businessId={"biz_1" as never}
                business={{ name: "Kanchi House", slug: "kanchi-house" }}
              />
            }
          />
          <Route
            path="/dashboard/orders/:orderId"
            element={<div>Submitted feedback detail</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("button", { name: /share feedback form/i }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /view feedback form/i }),
    );
    expect(screen.getByText("Submitted feedback detail")).toBeInTheDocument();
  });

  it("opens the real product modal when an order item is pressed and closes it", async () => {
    const user = userEvent.setup();
    mockOrderQuery();

    renderOrderDetailRoute();

    await user.click(
      screen.getByRole("button", { name: /open product green cotton shirt/i }),
    );

    expect(
      screen.getByRole("heading", { name: "Green Cotton Shirt" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Soft cotton shirt")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /close product details/i }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /close product details/i }),
    );
    expect(
      screen.queryByRole("heading", { name: "Green Cotton Shirt" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
  });

  it("shows product details immediately from context without extra query", () => {
    mockOrderQuery();

    renderOrderDetailRoute("/dashboard/orders/order_123/products/product_1");

    expect(screen.getAllByText("Green Cotton Shirt")).toHaveLength(2);
    expect(screen.getByText("Soft cotton shirt")).toBeInTheDocument();
  });

  it("shows a not-found state in the product modal when the product is not in the order", () => {
    mockOrderQuery();

    renderOrderDetailRoute(
      "/dashboard/orders/order_123/products/nonexistent_id",
    );

    expect(screen.getByText("Product not found")).toBeInTheDocument();
    expect(
      screen.getByText("This product is no longer available for this order."),
    ).toBeInTheDocument();
    expect(screen.queryByText("₹0.00")).not.toBeInTheDocument();
    expect(screen.queryByText("Uncategorised")).not.toBeInTheDocument();
  });

  it.each([
    ["Enter", "{Enter}"],
    ["Space", " "],
  ])(
    "does not navigate and still updates status when %s activates an inline action",
    async (_keyName, keyInput) => {
      const user = userEvent.setup();

      vi.mocked(useQuery).mockReturnValue([
        {
          _id: "order_123",
          orderId: "ORD123",
          customerName: "Jane Smith",
          status: "pending",
          totalAmount: 1499,
          createdAt: 1710000000000,
          items: [
            {
              name: "Green Cotton Shirt",
              quantity: 1,
            },
          ],
        },
      ] as never);

      render(
        <MemoryRouter initialEntries={["/dashboard/orders"]}>
          <Routes>
            <Route
              path="/dashboard/orders"
              element={<OrderManagement businessId={"biz_1" as never} />}
            />
            <Route
              path="/dashboard/orders/:orderId"
              element={<div>Order detail route</div>}
            />
          </Routes>
        </MemoryRouter>,
      );

      const confirmButton = screen.getByRole("button", {
        name: /mark as paid\/confirmed/i,
      });
      confirmButton.focus();
      await user.keyboard(keyInput);

      expect(screen.queryByText("Order detail route")).not.toBeInTheDocument();
      await waitFor(() => {
        expect(mockUpdateOrderStatus).toHaveBeenCalledWith({
          orderId: "order_123",
          status: "confirmed",
        });
      });
    },
  );
});
