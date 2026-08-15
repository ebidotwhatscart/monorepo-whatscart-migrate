import { describe, expect, it } from "vitest";
import {
  buildReviewRequestMessage,
  buildReviewWhatsAppUrl,
  normalizeWhatsAppPhone,
} from "../reviews";

describe("review WhatsApp links", () => {
  it("normalizes common Indian customer phone formats", () => {
    expect(normalizeWhatsAppPhone("98765 43210")).toBe("919876543210");
    expect(normalizeWhatsAppPhone("09876543210")).toBe("919876543210");
    expect(normalizeWhatsAppPhone("+91 98765 43210")).toBe("919876543210");
  });

  it("includes the order cart, total, and secure review link", () => {
    const message = buildReviewRequestMessage({
      customerName: "Anu",
      businessName: "Kanchi House",
      orderNumber: "KANC00042",
      items: [
        { name: "Silk Saree", quantity: 2, price: 8500 },
        { name: "Blouse", quantity: 1, price: 1200 },
      ],
      totalAmount: 18200,
      reviewUrl: "https://kanchi-house.whatscart.in/review/secret-token",
    });

    expect(message).toContain("2 × Silk Saree — ₹17000.00");
    expect(message).toContain("1 × Blouse — ₹1200.00");
    expect(message).toContain("Total: ₹18200.00");
    expect(message).toContain(
      "https://kanchi-house.whatscart.in/review/secret-token",
    );
    expect(message).toContain("rate every product");
  });

  it("targets the customer and URL-encodes the message", () => {
    expect(buildReviewWhatsAppUrl("98765-43210", "Order #42\nReview now")).toBe(
      "https://wa.me/919876543210?text=Order%20%2342%0AReview%20now",
    );
  });

  it("refuses invalid customer numbers", () => {
    expect(() => buildReviewWhatsAppUrl("123", "Review")).toThrow(
      "valid WhatsApp number",
    );
  });
});
