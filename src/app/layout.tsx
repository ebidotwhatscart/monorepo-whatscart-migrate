import type { Metadata } from "next";
import type { ReactNode } from "react";

import "../index.css";

export const metadata: Metadata = {
  title: {
    default: "WhatsCart",
    template: "%s | WhatsCart",
  },
  description: "Discover unique products from independent brands on WhatsCart.",
  applicationName: "WhatsCart",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/app-icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/app-icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
