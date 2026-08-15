import { render, screen, fireEvent } from "@testing-library/react";
import { describe, test, expect, vi } from "vitest";
import { DashboardHome } from "../DashboardHome";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("../../lib/firebase/hooks", () => ({
  useFirebaseQuery: () => [],
}));
vi.mock("../../lib/firebase/mutations", () => ({
  useFirebaseMutation: () => vi.fn(),
}));

describe("DashboardHome Business Verification Banner", () => {
  test("renders 'Verify Your Bakery Business' banner when FSSAI number is missing", () => {
    const business = {
      _id: "biz_1" as any,
      name: "My Bakery",
      slug: "my-bakery",
      themeColor: "#3dac35",
      whatsappPhone: "919876543210",
      businessType: "home_bakery",
    };

    render(<DashboardHome business={business} />);

    expect(screen.getByText("Verify Your Bakery Business")).toBeInTheDocument();
    const verifyBtn = screen.getByRole("button", { name: /verify now/i });
    expect(verifyBtn).toBeInTheDocument();

    fireEvent.click(verifyBtn);
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard/settings");
  });

  test("renders 'FSSAI Business Verified' badge when FSSAI number is present", () => {
    const business = {
      _id: "biz_1" as any,
      name: "My Bakery",
      slug: "my-bakery",
      themeColor: "#3dac35",
      whatsappPhone: "919876543210",
      businessType: "home_bakery",
      fssaiNumber: "12345678901234",
    };

    render(<DashboardHome business={business} />);

    expect(screen.getByText("FSSAI Business Verified")).toBeInTheDocument();
    expect(screen.getByText("12345678901234")).toBeInTheDocument();
  });
});
