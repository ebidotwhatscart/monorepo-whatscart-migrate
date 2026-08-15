"use client";

import {
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type MouseEventHandler,
  type ReactElement,
  type ReactNode,
} from "react";

import { useFirebaseAuth } from "./auth-context";

type SignInChildProps = {
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLElement>;
};

export function Authenticated({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useFirebaseAuth();
  return isLoaded && isSignedIn ? <>{children}</> : null;
}

export function Unauthenticated({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useFirebaseAuth();
  return isLoaded && !isSignedIn ? <>{children}</> : null;
}

export function SignInButton({
  children,
}: {
  children: ReactElement<SignInChildProps>;
  mode?: string;
}) {
  const { signIn } = useFirebaseAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);

  if (!isValidElement<SignInChildProps>(children)) return null;

  const onClick: MouseEventHandler<HTMLElement> = async (event) => {
    children.props.onClick?.(event);
    if (event.defaultPrevented || isSigningIn) return;

    setIsSigningIn(true);
    try {
      await signIn();
    } catch (error) {
      console.error("Firebase sign-in failed", error);
    } finally {
      setIsSigningIn(false);
    }
  };

  return cloneElement(children, {
    disabled: children.props.disabled || isSigningIn,
    onClick,
  });
}

export function UserButton() {
  const { isLoaded, isSignedIn, signOut, user } = useFirebaseAuth();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  if (!isLoaded || !isSignedIn || !user) return null;

  const displayName = user.displayName || user.email || "WhatsCart user";
  const initial = displayName.slice(0, 1).toUpperCase();

  return (
    <div ref={rootRef} style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        aria-label="Open user menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        style={{
          alignItems: "center",
          background: "#e2e8f0",
          border: 0,
          borderRadius: "9999px",
          color: "#0f172a",
          cursor: "pointer",
          display: "inline-flex",
          fontSize: "0.75rem",
          fontWeight: 700,
          height: "2rem",
          justifyContent: "center",
          overflow: "hidden",
          padding: 0,
          width: "2rem",
        }}
      >
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={displayName}
            referrerPolicy="no-referrer"
            style={{ height: "100%", objectFit: "cover", width: "100%" }}
          />
        ) : (
          initial
        )}
      </button>

      {isOpen ? (
        <div
          role="menu"
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "0.75rem",
            boxShadow: "0 12px 30px rgba(15, 23, 42, 0.16)",
            minWidth: "14rem",
            padding: "0.75rem",
            position: "absolute",
            right: 0,
            top: "calc(100% + 0.5rem)",
            zIndex: 100,
          }}
        >
          <div style={{ fontSize: "0.875rem", fontWeight: 600 }}>{displayName}</div>
          {user.email ? (
            <div
              style={{
                color: "#64748b",
                fontSize: "0.75rem",
                marginTop: "0.125rem",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {user.email}
            </div>
          ) : null}
          <button
            type="button"
            role="menuitem"
            onClick={() => void signOut()}
            style={{
              background: "#f8fafc",
              border: 0,
              borderRadius: "0.5rem",
              color: "#0f172a",
              cursor: "pointer",
              fontSize: "0.875rem",
              fontWeight: 600,
              marginTop: "0.75rem",
              padding: "0.625rem 0.75rem",
              textAlign: "left",
              width: "100%",
            }}
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
