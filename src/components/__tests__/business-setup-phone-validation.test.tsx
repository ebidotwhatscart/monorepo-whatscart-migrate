import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMutation, useQuery } from "convex/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BusinessSetup } from "../BusinessSetup";

vi.mock("convex/react", () => ({
  useMutation: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("BusinessSetup phone validation", () => {
  beforeEach(() => {
    vi.mocked(useMutation).mockReturnValue(vi.fn() as never);
    vi.mocked(useQuery).mockReturnValue(true as never);
  });

  it("keeps business details disabled until the WhatsApp number is valid", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <BusinessSetup />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /start onboarding/i }));
    await user.type(screen.getByPlaceholderText(/your full name/i), "Asha Rao");
    await user.click(screen.getByRole("button", { name: /garments/i }));
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await user.type(
      screen.getByPlaceholderText(/the coffee house/i),
      "Asha Textiles",
    );
    const whatsappInput = screen.getByPlaceholderText("9876543210");
    await user.type(whatsappInput, "9876543210");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled();
    });

    await user.clear(whatsappInput);
    await user.type(whatsappInput, "12345");

    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
  });
});
