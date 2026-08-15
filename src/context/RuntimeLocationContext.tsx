"use client";

import { createContext, useContext, type ReactNode } from "react";

const RuntimeHostnameContext = createContext("");

export function RuntimeLocationProvider({
  children,
  initialHostname = "",
}: {
  children: ReactNode;
  initialHostname?: string;
}) {
  return (
    <RuntimeHostnameContext.Provider value={initialHostname}>
      {children}
    </RuntimeHostnameContext.Provider>
  );
}

export function useRuntimeHostname() {
  const initialHostname = useContext(RuntimeHostnameContext);
  return typeof window === "undefined"
    ? initialHostname
    : window.location.hostname;
}
