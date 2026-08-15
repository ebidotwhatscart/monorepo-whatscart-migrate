import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProductReturnPolicySection } from "../products/ProductReturnPolicySection";

describe("ProductReturnPolicySection", () => {
  it("matches the Figma default return-policy state", () => {
    render(
      <ProductReturnPolicySection
        value={{
          returnable: true,
          returnWindowDays: 7,
          acceptedConditions: ["unused"],
        }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Return policy" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Yes" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "No" })).not.toBeChecked();
    expect(screen.getByLabelText("Return Window")).toHaveValue("7");
    expect(screen.getByRole("checkbox", { name: "Unused" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Original packaging" })).not.toBeChecked();
  });

  it("clears inherited return details when returns are disabled", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ProductReturnPolicySection
        value={{
          returnable: true,
          returnWindowDays: 14,
          acceptedConditions: ["unused", "damaged"],
        }}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("radio", { name: "No" }));

    expect(onChange).toHaveBeenCalledWith({
      returnable: false,
      returnWindowDays: undefined,
      acceptedConditions: [],
    });
  });
});
