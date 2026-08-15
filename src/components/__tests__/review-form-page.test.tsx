import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMutation, useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReviewFormPage } from "../ReviewFormPage";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

const submitReviews = vi.fn();

const form = {
  status: "open",
  orderNumber: "KANC00042",
  customerName: "Anu Kumar",
  business: {
    name: "Kanchi House",
    slug: "kanchi-house",
    themeColor: "#056664",
    logoUrl: null,
  },
  products: [
    {
      productId: "product_1",
      name: "Silk Saree",
      imageUrl: "https://example.com/saree.jpg",
    },
    {
      productId: "product_2",
      name: "Blouse",
      imageUrl: null,
    },
  ],
};

function renderForm() {
  render(
    <MemoryRouter initialEntries={["/review/secure-token"]}>
      <Routes>
        <Route path="/review/:token" element={<ReviewFormPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ReviewFormPage", () => {
  beforeEach(() => {
    toastError.mockReset();
    submitReviews.mockReset();
    submitReviews.mockResolvedValue({ submittedAt: 1, reviewCount: 2 });
    vi.mocked(useQuery).mockReturnValue(form as never);
    vi.mocked(useMutation).mockReset();
    vi.mocked(useMutation).mockImplementation(((mutation) =>
      getFunctionName(mutation) === "reviews:submitReviews"
        ? submitReviews
        : vi.fn()) as typeof useMutation);
  });

  it("requires only a star rating for every purchased product", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: /submit feedback/i }));

    expect(submitReviews).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(
      "Choose a star rating for Silk Saree.",
    );

    const firstCard = screen.getByText("Product 1 of 2").closest("section")!;
    const secondCard = screen.getByText("Product 2 of 2").closest("section")!;
    await user.click(within(firstCard).getByRole("button", { name: "5 stars" }));
    await user.click(within(secondCard).getByRole("button", { name: "4 stars" }));
    await user.click(screen.getByRole("button", { name: /submit feedback/i }));

    await waitFor(() => expect(submitReviews).toHaveBeenCalled());
    expect(submitReviews).toHaveBeenCalledWith({
      token: "secure-token",
      reviews: [
        { productId: "product_1", rating: 5, comment: "", imageIds: [] },
        { productId: "product_2", rating: 4, comment: "", imageIds: [] },
      ],
    });
  });

  it("submits all product reviews together through the one order token", async () => {
    const user = userEvent.setup();
    renderForm();
    const firstCard = screen.getByText("Product 1 of 2").closest("section")!;
    const secondCard = screen.getByText("Product 2 of 2").closest("section")!;

    await user.click(
      within(firstCard).getByRole("button", { name: "5 stars" }),
    );
    await user.type(
      within(firstCard).getByLabelText(/review/i),
      "Beautiful fabric and finish.",
    );
    await user.click(
      within(secondCard).getByRole("button", { name: "4 stars" }),
    );
    await user.type(
      within(secondCard).getByLabelText(/review/i),
      "Fits well and matches the saree.",
    );
    await user.click(screen.getByRole("button", { name: /submit feedback/i }));

    await waitFor(() =>
      expect(submitReviews).toHaveBeenCalledWith({
        token: "secure-token",
        reviews: [
          {
            productId: "product_1",
            rating: 5,
            comment: "Beautiful fabric and finish.",
            imageIds: [],
          },
          {
            productId: "product_2",
            rating: 4,
            comment: "Fits well and matches the saree.",
            imageIds: [],
          },
        ],
      }),
    );
    expect(
      await screen.findByRole("heading", {
        name: /thank you for your feedback/i,
      }),
    ).toBeInTheDocument();
  });
});
