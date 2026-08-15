export type ReviewMessageItem = {
  name: string;
  quantity: number;
  price: number;
};

type ReviewRequestMessageInput = {
  customerName: string;
  businessName: string;
  orderNumber: string;
  items: ReviewMessageItem[];
  totalAmount: number;
  reviewUrl: string;
};

const MAX_CART_LINES = 12;

function formatRupees(amount: number) {
  return `₹${amount.toFixed(2)}`;
}

export function normalizeWhatsAppPhone(phone: string) {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10) digits = `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) {
    digits = `91${digits.slice(1)}`;
  }
  return digits;
}

export function buildReviewRequestMessage({
  customerName,
  businessName,
  orderNumber,
  items,
  totalAmount,
  reviewUrl,
}: ReviewRequestMessageInput) {
  const visibleItems = items.slice(0, MAX_CART_LINES);
  const cartLines = visibleItems.map((item) => {
    const quantity = Math.max(1, Math.floor(item.quantity));
    return `• ${quantity} × ${item.name.trim() || "Product"} — ${formatRupees(
      item.price * quantity,
    )}`;
  });
  if (items.length > visibleItems.length) {
    cartLines.push(`• +${items.length - visibleItems.length} more item(s)`);
  }

  return [
    `Hi ${customerName.trim() || "there"},`,
    "",
    `Thank you for shopping with ${businessName}. We would love your feedback on order #${orderNumber}.`,
    "",
    "Your order:",
    ...cartLines,
    `Total: ${formatRupees(totalAmount)}`,
    "",
    "Please rate every product using this secure link:",
    reviewUrl,
    "",
    "The link can be submitted once. Thank you!",
  ].join("\n");
}

export function buildReviewWhatsAppUrl(customerPhone: string, message: string) {
  const phone = normalizeWhatsAppPhone(customerPhone);
  if (phone.length < 8 || phone.length > 15) {
    throw new Error("The customer does not have a valid WhatsApp number.");
  }
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
