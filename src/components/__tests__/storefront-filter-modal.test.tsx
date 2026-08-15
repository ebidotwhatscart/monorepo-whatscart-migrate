import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createStorefrontTheme } from "../../lib/storefrontTheme";
import { StorefrontFilterModal } from "../StorefrontFilterModal";

const storefrontTheme = createStorefrontTheme({
  themeColor: "#046664",
});

describe("StorefrontFilterModal", () => {
  it("applies price and sort selections together", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();

    render(
      <StorefrontFilterModal
        isOpen
        priceBounds={{ min: 100, max: 1000 }}
        filters={{}}
        sortDirection="asc"
        storefrontTheme={storefrontTheme}
        onApply={onApply}
        onClose={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("dialog", { name: /filters & sort/i }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("radio", { name: /price: high to low/i }),
    );
    fireEvent.change(screen.getByRole("slider", { name: /minimum price/i }), {
      target: { value: "500" },
    });
    await user.click(
      screen.getByRole("button", { name: /apply filters/i }),
    );

    expect(onApply).toHaveBeenCalledWith(
      {
        minPrice: 500,
        maxPrice: undefined,
      },
      "desc",
    );
  });

  it("closes with Escape and restores page scrolling", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    const { unmount } = render(
      <StorefrontFilterModal
        isOpen
        priceBounds={{ min: 100, max: 1000 }}
        filters={{}}
        sortDirection="asc"
        storefrontTheme={storefrontTheme}
        onApply={vi.fn()}
        onClose={onClose}
      />,
    );

    expect(document.body.style.overflow).toBe("hidden");
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();

    unmount();
    expect(document.body.style.overflow).toBe("");
  });
});
