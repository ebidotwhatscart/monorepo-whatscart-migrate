import { render, screen, fireEvent } from "@testing-library/react";
import { describe, test, expect, vi } from "vitest";
import { StorefrontFooter } from "../StorefrontFooter";
import { createStorefrontTheme } from "../../lib/storefrontTheme";

const mockTheme = createStorefrontTheme({ themeColor: "#3dac35" });

describe("StorefrontFooter FSSAI License & Certificate", () => {
  test("renders FSSAI License Number and Certificate download link when present", () => {
    const business = {
      name: "Sweet Bakes",
      slug: "sweet-bakes",
      whatsappPhone: "919876543210",
      fssaiNumber: "12345678901234",
      fssaiDocUrl: "https://example.com/fssai-cert.pdf",
    };

    render(
      <StorefrontFooter
        business={business}
        categories={[]}
        storefrontTheme={mockTheme}
      />
    );

    expect(screen.getByText(/FSSAI Lic: 12345678901234/i)).toBeInTheDocument();
    const downloadLink = screen.getByRole("link", { name: /download fssai certificate pdf/i });
    expect(downloadLink).toBeInTheDocument();
    expect(downloadLink).toHaveAttribute("href", "https://example.com/fssai-cert.pdf");
    expect(downloadLink).toHaveAttribute("target", "_blank");
  });

  test("does not render FSSAI badge when fssaiNumber is missing", () => {
    const business = {
      name: "Sweet Bakes",
      slug: "sweet-bakes",
      whatsappPhone: "919876543210",
    };

    render(
      <StorefrontFooter
        business={business}
        categories={[]}
        storefrontTheme={mockTheme}
      />
    );

    expect(screen.queryByText(/FSSAI Lic/i)).not.toBeInTheDocument();
  });
});
