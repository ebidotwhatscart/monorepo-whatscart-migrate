import { describe, expect, it } from "vitest";
import {
  buildJsonLd,
  buildSeoBody,
  buildSitemapXml,
  convexSiteUrl,
  isKnownStorefrontPath,
} from "../../../netlify/edge-functions/share-meta.js";

describe("share-meta SEO rendering", () => {
  it("renders crawlable storefront content and product links", () => {
    const html = buildSeoBody(
      {
        type: "store",
        businessName: "Asha Textiles",
        businessDescription: "Handwoven clothing for modern families.",
        products: [
          {
            slug: "silk-saree-abc123",
            name: "Silk Saree",
            description: "Pure silk from Kanchipuram.",
            price: 8500,
          },
        ],
      },
      "https://asha.whatscart.in/",
    );

    expect(html).toContain("<h1>Asha Textiles</h1>");
    expect(html).toContain("Handwoven clothing for modern families.");
    expect(html).toContain("https://asha.whatscart.in/products/silk-saree-abc123");
    expect(html).toContain("Silk Saree");
  });

  it("emits product structured data without allowing script injection", () => {
    const json = buildJsonLd(
      {
        type: "product",
        title: 'Bad </script><script>alert("x")</script>',
        productName: "Silk Saree",
        description: "Pure silk",
        businessName: "Asha Textiles",
        price: 8500,
        currency: "INR",
      },
      "https://asha.whatscart.in/products/silk-saree-abc123",
      "https://cdn.example.com/saree.jpg",
    );

    expect(json).toContain('"@type":"Product"');
    expect(json).toContain('"price":8500');
    expect(json).not.toContain("</script>");
  });

  it("builds a valid sitemap from public product slugs and catalog ids", () => {
    const xml = buildSitemapXml(
      {
        products: [{ slug: "heart & roses" }, { slug: "" }, null],
        catalogIds: ["summer-sale", ""],
      },
      "https://asha.whatscart.in",
    );

    expect(xml).toContain("<url><loc>https://asha.whatscart.in/</loc></url>");
    expect(xml).toContain('<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>');
    expect(xml).toContain("/products/heart%20%26%20roses");
    expect(xml).toContain("/catalog/summer-sale");
    expect(xml).not.toContain("undefined");
  });

  it("normalizes the Convex cloud URL for the HTTP API", () => {
    expect(convexSiteUrl("https://example.convex.cloud/")).toBe("https://example.convex.site");
    expect(convexSiteUrl("https://example.convex.site")).toBe("https://example.convex.site");
  });

  it("distinguishes valid storefront paths from incomplete and unknown routes", () => {
    expect(isKnownStorefrontPath("/")).toBe(true);
    expect(isKnownStorefrontPath("/products/crochet-heart-abc123")).toBe(true);
    expect(isKnownStorefrontPath("/catalog/summer")).toBe(true);
    expect(isKnownStorefrontPath("/products")).toBe(false);
    expect(isKnownStorefrontPath("/catalog")).toBe(false);
    expect(isKnownStorefrontPath("/does-not-exist")).toBe(false);
  });
});
