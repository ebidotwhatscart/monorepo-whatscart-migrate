import { describe, expect, it } from "vitest";
import {
  buildUpiPaymentUrl,
  buildWhatsAppOrderMessage,
  buildWhatsAppOrderUrl,
} from "../whatsappOrder";

describe("WhatsApp order recovery & UPI payment links", () => {
  it("generates correct UPI payment deep link URL", () => {
    const link = buildUpiPaymentUrl({
      vpa: "bhuvana@okaxis",
      receiverName: "Bhuvaneshwari",
      amount: 250,
      transactionNote: "Payment",
    });

    expect(link).toBe("upi://pay?pa=bhuvana%40okaxis&pn=Bhuvaneshwari&am=250.00&cu=INR&tn=Payment");
  });

  it("includes UPI payment link in WhatsApp order message when UPI ID is configured", () => {
    const message = buildWhatsAppOrderMessage({
      customerName: "Anu",
      customerMobile: "9876543210",
      items: [{ name: "Vel Keychain", quantity: 2, price: 200 }],
      totalAmount: 400,
      orderLink: "https://store.example/order-success?orderId=ORD123",
      upiId: "bhuvana@okaxis",
      businessName: "Bhuvaneshwari Store",
    });

    expect(message).toContain("* Vel Keychain ×2 — ₹400");
    expect(message).toContain("*Payment link:*");
    expect(message).toContain("*Payment:* UPI link above");
    expect(message).toContain("upi://pay?pa=bhuvana%40okaxis&pn=Bhuvaneshwari+Store&am=400.00&cu=INR&tn=Order+Payment+%28Anu%29");
  });

  it("formats the customer order as a scannable WhatsApp message", () => {
    const message = buildWhatsAppOrderMessage({
      customerName: "Ebinesh",
      customerMobile: "6381631017",
      customerAlternateMobile: "8778340856",
      customerDoorNumber: "100",
      items: [
        {
          name: "Grey Kurta - White",
          quantity: 1,
          price: 499,
          customizationNotes: ["Variant: 32"],
        },
        {
          name: "Beach Dress Black",
          quantity: 1,
          price: 399,
          customizationNotes: ["Variant: M"],
        },
        {
          name: "Floral Kurta Set - Casual",
          quantity: 1,
          price: 499,
          customizationNotes: ["Variant: M"],
        },
      ],
      totalAmount: 1397,
      address: "JRD Hill County, Palathurai Road, Madukkarai – 641105",
      mapLink: "https://www.google.com/maps?q=10.888321859111889,76.95581802321392",
      orderLink: "https://positronclothing.whatscart.in/order-success?orderId=POSI00003",
      upiId: "positron@upi",
      businessName: "PositronClothing",
    });

    expect(message).toBe(`Hi! I've placed an order 👋

*Customer:* Ebinesh
📞 6381631017 / 8778340856

*Items:*
* Grey Kurta – White (32) ×1 — ₹499
* Beach Dress Black (M) ×1 — ₹399
* Floral Kurta Set – Casual (M) ×1 — ₹499

*Total: ₹1,397*

*Delivery Address:* 100, JRD Hill County, Palathurai Road, Madukkarai – 641105

*Payment link:* upi://pay?pa=positron%40upi&pn=PositronClothing&am=1397.00&cu=INR&tn=Order+Payment+%28Ebinesh%29
*Payment:* UPI link above

*Delivery Address link:* https://www.google.com/maps?q=10.888321859111889,76.95581802321392

*Order:* https://positronclothing.whatscart.in/order-success?orderId=POSI00003

Please confirm my order. Thank you!`);
  });

  it("normalizes the WhatsApp number and encodes the retry message", () => {
    const url = buildWhatsAppOrderUrl("+91 98765 43210", "Order #123");

    expect(url).toBe("https://wa.me/919876543210?text=Order%20%23123");
  });
});
