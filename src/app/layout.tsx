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
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
