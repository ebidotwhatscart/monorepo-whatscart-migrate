import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, max-age=0, must-revalidate",
          },
          { key: "CDN-Cache-Control", value: "no-store" },
          { key: "Vercel-CDN-Cache-Control", value: "no-store" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },
  images: {
    disableStaticImages: true,
  },
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: {
    root: process.cwd(),
  },
  // The imported legacy surface has pre-existing strict errors recorded in
  // contracts/source-baseline.json. `npm run typecheck` remains an explicit
  // red gate until Firebase repositories replace the Convex signatures.
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
