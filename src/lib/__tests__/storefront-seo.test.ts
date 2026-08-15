import { describe, expect, it } from "vitest";

import {
  buildStorefrontSitemapXml,
  escapeXml,
  serializeJsonLd,
} from "../storefront-seo";

describe("Next.js storefront SEO", () => {
  it("serializes structured data without allowing script injection", () => {
    const json = serializeJsonLd({
      "@type": "Product",
      name: 'Bad </script><script>alert("x")</script>',
      offers: { price: 8500, priceCurrency: "INR" },
    });

    expect(json).toContain('"@type":"Product"');
    expect(json).toContain('"price":8500');
    expect(json).not.toContain("</script>");
    expect(json).toContain("\\u003c/script>");
  });

  it("builds a valid sitemap for product and collection routes", () => {
    const xml = buildStorefrontSitemapXml(
      "https://asha.whatscart.in/",
      ["heart & roses", ""],
      ["summer-sale", ""],
    );

    expect(xml).toContain("<url><loc>https://asha.whatscart.in/</loc></url>");
    expect(xml).toContain("/products/heart%20%26%20roses");
    expect(xml).toContain("/catalog/summer-sale");
    expect(xml).not.toContain("undefined");
  });

  it("escapes XML metacharacters", () => {
    expect(escapeXml('A&B <store> "quoted"')).toBe(
      "A&amp;B &lt;store&gt; &quot;quoted&quot;",
    );
  });
});
