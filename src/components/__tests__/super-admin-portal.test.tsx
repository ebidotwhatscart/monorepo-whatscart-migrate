import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SuperAdminPortal } from "../SuperAdminPortal";

const mockSetBusinessEnabled = vi.fn();
const mockDeleteUserData = vi.fn();

const businesses = [
  {
    _id: "business_123",
    name: "Asha Textiles",
    slug: "asha-textiles",
    ownerId: "user_123",
    ownerName: "Asha",
    ownerEmail: "asha@example.com",
    ownerClerkId: "user_clerk123",
    productCount: 8,
    orderCount: 4,
    createdAt: 1,
    isEnabled: true,
  },
];

vi.mock("@clerk/clerk-react", () => ({
  SignInButton: ({ children }: { children: ReactNode }) => children,
  UserButton: () => <div aria-label="User menu" />,
}));

vi.mock("convex/react", () => ({
  Authenticated: ({ children }: { children: ReactNode }) => children,
  Unauthenticated: () => null,
  useQuery: vi.fn((_query, args) =>
    args === undefined
      ? { _id: "admin_123", email: "admin@example.com", role: "super_admin" }
      : businesses,
  ),
  useMutation: vi.fn(() => mockSetBusinessEnabled),
  useAction: vi.fn(() => mockDeleteUserData),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("SuperAdminPortal", () => {
  beforeEach(() => {
    mockSetBusinessEnabled.mockReset().mockResolvedValue({
      businessId: "business_123",
      isEnabled: false,
    });
    mockDeleteUserData.mockReset().mockResolvedValue({
      identifier: "user_123",
      email: "asha@example.com",
      clerkAccount: "already_missing",
      users: 1,
      businesses: 1,
      categories: 2,
      products: 8,
      businessVariationOptions: 0,
      catalogs: 1,
      carts: 1,
      orders: 4,
      pageViews: 3,
      productViews: 2,
      productShares: 1,
      storageFiles: 4,
    });
  });

  it("toggles store availability from the business row", async () => {
    render(<SuperAdminPortal />);

    expect(screen.getByText("Asha Textiles")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Disable" }));

    await waitFor(() =>
      expect(mockSetBusinessEnabled).toHaveBeenCalledWith({
        businessId: "business_123",
        isEnabled: false,
      }),
    );
  });

  it("requires a matching email or ID before permanent deletion", async () => {
    render(<SuperAdminPortal />);

    fireEvent.click(screen.getByRole("button", { name: /delete user data/i }));
    expect(
      screen.getByRole("dialog", { name: /permanently delete user data/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "User ID" }));
    fireEvent.change(screen.getByLabelText("Convex or Clerk user ID"), {
      target: { value: "user_123" },
    });
    fireEvent.change(screen.getByLabelText(/type the id again/i), {
      target: { value: "user_123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Permanently delete" }));

    await waitFor(() =>
      expect(mockDeleteUserData).toHaveBeenCalledWith({
        id: "user_123",
        confirmId: "user_123",
      }),
    );
  });
});
