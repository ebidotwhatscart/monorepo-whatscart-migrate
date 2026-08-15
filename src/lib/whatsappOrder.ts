type WhatsAppOrderItem = {
  name: string;
  quantity: number;
  price: number;
  customizationNotes?: string[];
};

export function buildUpiPaymentUrl({
  vpa,
  receiverName,
  amount,
  transactionNote = "Order Payment",
}: {
  vpa: string;
  receiverName: string;
  amount: number;
  transactionNote?: string;
}) {
  const cleanVpa = vpa.trim();
  const cleanName = receiverName.trim();
  const formattedAmount = amount.toFixed(2);
  const params = new URLSearchParams({
    pa: cleanVpa,
    pn: cleanName,
    am: formattedAmount,
    cu: "INR",
    tn: transactionNote,
  });
  return `upi://pay?${params.toString()}`;
}

type WhatsAppOrderMessageInput = {
  customerName: string;
  customerMobile: string;
  customerAlternateMobile?: string;
  customerDoorNumber?: string;
  items: WhatsAppOrderItem[];
  totalAmount: number;
  address?: string;
  mapLink?: string;
  notes?: string;
  customizationTitle?: string;
  customizationNotes?: string[];
  orderLink: string;
  upiId?: string;
  businessName?: string;
  businessPhone?: string;
};

function formatOrderAmount(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatOrderItemName(name: string) {
  return name.trim().replace(/\s+-\s+/g, " – ");
}

function getItemVariant(customizationNotes?: string[]) {
  return customizationNotes
    ?.find((line) => /^variant\s*:/i.test(line))
    ?.replace(/^variant\s*:\s*/i, "")
    .trim();
}

function getNonVariantCustomizationNotes(customizationNotes?: string[]) {
  return customizationNotes?.filter((line) => !/^variant\s*:/i.test(line)) ?? [];
}

function formatDeliveryAddress({
  customerDoorNumber,
  address,
}: Pick<WhatsAppOrderMessageInput, "customerDoorNumber" | "address">) {
  const doorNumber = customerDoorNumber?.trim();
  const deliveryAddress = address?.trim();
  const addressAlreadyIncludesDoorNumber = Boolean(
    doorNumber &&
      deliveryAddress &&
      deliveryAddress.toLowerCase().startsWith(`${doorNumber.toLowerCase()},`),
  );

  return [addressAlreadyIncludesDoorNumber ? "" : doorNumber, deliveryAddress]
    .filter(Boolean)
    .join(", ");
}

export function buildWhatsAppOrderMessage(input: WhatsAppOrderMessageInput) {
  const itemLines = input.items
    .map((item) => {
      const variant = getItemVariant(item.customizationNotes);
      return `* ${formatOrderItemName(item.name)}${variant ? ` (${variant})` : ""} ×${item.quantity} — ₹${formatOrderAmount(item.price * item.quantity)}`;
    })
    .join("\n");
  const itemCustomization = input.items
    .map((item) => ({
      name: item.name,
      notes: getNonVariantCustomizationNotes(item.customizationNotes),
    }))
    .filter((item) => item.notes.length)
    .map(
      (item) =>
        `${formatOrderItemName(item.name)} customization:\n${item.notes
          .map((line) => `- ${line}`)
          .join("\n")}`,
    )
    .join("\n\n");
  const itemCustomizationNotes = new Set(
    input.items.flatMap((item) => item.customizationNotes ?? []),
  );
  const remainingOrderCustomizationNotes = (input.customizationNotes ?? []).filter(
    (line) => !itemCustomizationNotes.has(line) && !/^variant\s*:/i.test(line),
  );
  const orderCustomization = remainingOrderCustomizationNotes.length
    ? `${input.customizationTitle || "Customization"}:\n${remainingOrderCustomizationNotes
        .map((line) => `- ${line}`)
        .join("\n")}`
    : "";
  const phoneNumbers = [
    input.customerMobile.trim(),
    input.customerAlternateMobile?.trim(),
  ]
    .filter(Boolean)
    .join(" / ");
  const deliveryAddress = formatDeliveryAddress(input);

  // Resolve UPI VPA: configured upiId or fallback to business whatsapp phone number as VPA (e.g. 9876543210@paytm)
  const upiVpa = input.upiId?.trim() || (input.businessPhone ? `${input.businessPhone.replace(/\D/g, "").slice(-10)}@upi` : undefined);
  const upiLink = upiVpa
    ? buildUpiPaymentUrl({
        vpa: upiVpa,
        receiverName: input.businessName || "Business Owner",
        amount: input.totalAmount,
        transactionNote: `Order Payment (${input.customerName})`,
      })
    : undefined;

  return [
    "Hi! I've placed an order 👋",
    `*Customer:* ${input.customerName.trim()}\n📞 ${phoneNumbers}`,
    `*Items:*\n${itemLines}`,
    orderCustomization,
    itemCustomization,
    `*Total: ₹${formatOrderAmount(input.totalAmount)}*`,
    deliveryAddress ? `*Delivery Address:* ${deliveryAddress}` : "",
    upiLink ? `*Payment link:* ${upiLink}\n*Payment:* UPI link above` : "*Payment:* Confirm with store",
    input.mapLink ? `*Delivery Address link:* ${input.mapLink}` : "",
    input.notes ? `*Notes:* ${input.notes.trim()}` : "",
    `*Order:* ${input.orderLink}`,
    "Please confirm my order. Thank you!",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildWhatsAppOrderUrl(phone: string, message: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}
