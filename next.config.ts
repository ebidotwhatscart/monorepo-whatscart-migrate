import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['app.lvh.me', 'admin.lvh.me', '*.lvh.me'],
  async rewrites() {
    return [
      {
        source: '/.well-known/assetlinks.json',
        destination: '/assetlinks',
      },
      {
        source: '/firebase-media/:path*',
        destination: 'https://googleapis.com*',
      },
    ];
  },
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
    qualities: [60, 75],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        pathname: "/v0/b/**",
      },
    ],
  },
  poweredByHeader: false,
  reactStrictMode: true,
  // Next.js externally loads firebase-admin by default. Its current jwks-rsa
  // dependency requires an ESM-only jose build, so bundle the Admin SDK into
  // Route Handlers instead of using Node's runtime require.
  transpilePackages: ["firebase-admin"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
