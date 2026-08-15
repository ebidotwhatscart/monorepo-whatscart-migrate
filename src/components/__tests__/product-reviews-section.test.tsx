import { render, screen } from "@testing-library/react";
import { useFirebaseQuery as useQuery } from "../../lib/firebase/hooks";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductReviewsSection } from "../ProductReviewsSection";

vi.mock("../../lib/firebase/hooks", () => ({ useFirebaseQuery: vi.fn() }));

describe("ProductReviewsSection", () => {
  beforeEach(() => vi.mocked(useQuery).mockReset());

  it("renders aggregate ratings and approved review content", () => {
    vi.mocked(useQuery).mockReturnValue({
      stats: {
        approvedCount: 2,
        averageRating: 4.5,
        ratings1: 0,
        ratings2: 0,
        ratings3: 0,
        ratings4: 1,
        ratings5: 1,
      },
      reviews: [
        {
          _id: "review_1",
          displayName: "Anu K.",
          rating: 5,
          comment: "Beautiful fabric and finish.",
          imageUrls: ["https://example.com/review.jpg"],
          submittedAt: 1_700_000_000_000,
        },
      ],
    } as never);

    render(<ProductReviewsSection productId={"product_1" as never} />);

    expect(
      screen.getByRole("heading", { name: "Reviews" }),
    ).toBeInTheDocument();
    expect(screen.getByText("4.5")).toBeInTheDocument();
    expect(screen.getByText("2 Reviews")).toBeInTheDocument();
    expect(screen.getByText("Anu K.")).toBeInTheDocument();
    expect(
      screen.getByText("Beautiful fabric and finish."),
    ).toBeInTheDocument();
    expect(screen.getByAltText("Review photo 1")).toBeInTheDocument();
  });

  it("does not render a public review block before anything is approved", () => {
    vi.mocked(useQuery).mockReturnValue({
      stats: {
        approvedCount: 0,
        averageRating: 0,
        ratings1: 0,
        ratings2: 0,
        ratings3: 0,
        ratings4: 0,
        ratings5: 0,
      },
      reviews: [],
    } as never);

    const { container } = render(
      <ProductReviewsSection productId={"product_1" as never} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
