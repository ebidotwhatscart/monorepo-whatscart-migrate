import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SuperAdminPortal } from "../SuperAdminPortal";

const mockSetBusinessEnabled = vi.fn();
const mockSetBusinessTemplate = vi.fn();
const mockDeleteUserData = vi.fn();

const businesses = [
  {
    _id: "business_123",
    name: "Asha Textiles",
    slug: "asha-textiles",
    ownerId: "user_123",
    ownerName: "Asha",
    ownerEmail: "asha@example.com",
    productCount: 8,
    orderCount: 4,
    createdAt: 1,
    isEnabled: true,
    businessType: "garments",
    customTemplateId: null,
  },
];

vi.mock("../../lib/firebase/auth-ui", () => ({
  Authenticated: ({ children }: { children: ReactNode }) => children,
  Unauthenticated: () => null,
  SignInButton: ({ children }: { children: ReactNode }) => children,
  EmailSignInForm: () => null,
  LogoutButton: () => <button type="button">Log out</button>,
  UserButton: () => null,
}));
vi.mock("../../lib/firebase/hooks", () => ({
  useFirebaseQuery: vi.fn((_query, args) =>
    args === undefined
      ? { _id: "admin_123", email: "admin@example.com", role: "super_admin" }
      : businesses,
  ),
}));
vi.mock("../../lib/firebase/mutations", () => ({
  useFirebaseMutation: vi.fn((operation: { __operationName?: string }) =>
    operation?.__operationName === "superAdmin:setBusinessTemplate"
      ? mockSetBusinessTemplate
      : mockSetBusinessEnabled,
  ),
  useFirebaseAction: vi.fn(() => mockDeleteUserData),
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
    mockSetBusinessTemplate.mockReset().mockResolvedValue({
      businessId: "business_123",
      customTemplateId: null,
    });
    mockDeleteUserData.mockReset().mockResolvedValue({
      identifier: "user_123",
      email: "asha@example.com",
      authAccount: "already_missing",
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

  it("renders a visible log out control in the admin header", () => {
    render(<SuperAdminPortal />);

    expect(
      screen.getByRole("button", { name: /log out/i }),
    ).toBeInTheDocument();
  });

  it("requires a matching email or ID before permanent deletion", async () => {
    render(<SuperAdminPortal />);

    fireEvent.click(screen.getByRole("button", { name: /delete user data/i }));
    expect(
      screen.getByRole("dialog", { name: /permanently delete user data/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "User ID" }));
    fireEvent.change(screen.getByLabelText("Firebase user ID"), {
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

  it("assigns a storefront template from the business row", async () => {
    mockSetBusinessTemplate.mockResolvedValue({
      businessId: "business_123",
      customTemplateId: "nilav",
    });
    render(<SuperAdminPortal />);

    fireEvent.change(screen.getByLabelText("Storefront template"), {
      target: { value: "nilav" },
    });

    expect(screen.getByLabelText("Storefront template")).toHaveValue("nilav");

    await waitFor(() =>
      expect(mockSetBusinessTemplate).toHaveBeenCalledWith({
        businessId: "business_123",
        customTemplateId: "nilav",
      }),
    );
  });
});
