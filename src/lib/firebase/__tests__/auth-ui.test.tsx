import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authState, signOut } = vi.hoisted(() => {
  const signOut = vi.fn();
  return {
    signOut,
    authState: {
      isLoaded: true,
      isSignedIn: true,
      user: {
        email: "admin@example.com",
        displayName: "Admin",
        photoURL: null,
      },
      signIn: vi.fn(),
      signInWithEmail: vi.fn(),
      signOut,
    },
  };
});

vi.mock("../auth-context", () => ({
  useFirebaseAuth: () => authState,
}));

import { LogoutButton } from "../auth-ui";

describe("LogoutButton", () => {
  beforeEach(() => {
    signOut.mockReset().mockResolvedValue(undefined);
    authState.isLoaded = true;
    authState.isSignedIn = true;
  });

  it("signs the user out when clicked", () => {
    render(<LogoutButton />);
    fireEvent.click(screen.getByRole("button", { name: /log out/i }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when signed out", () => {
    authState.isSignedIn = false;
    const { container } = render(<LogoutButton />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing before auth has loaded", () => {
    authState.isLoaded = false;
    const { container } = render(<LogoutButton />);
    expect(container).toBeEmptyDOMElement();
  });
});
