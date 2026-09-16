import type { Metadata } from "next";
import Script from "next/script";
import type { ReactNode } from "react";

import "../index.css";

const CLARITY_ID =
  process.env.NODE_ENV === "production" ? "xdj4az2q0d" : "wtmfck3w0n";

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

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        {children}
        <Script
          id="microsoft-clarity"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window, document, "clarity", "script", "${CLARITY_ID}");`,
          }}
        />
      </body>
    </html>
  );
}
