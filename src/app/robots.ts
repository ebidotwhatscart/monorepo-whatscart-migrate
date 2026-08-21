import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "whatscart.in";
  const origin = `https://app.${rootDomain}`;

  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
    host: origin,
  };
}
