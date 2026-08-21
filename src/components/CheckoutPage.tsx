import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useFirebaseMutation as useMutation } from "../lib/firebase/mutations";
import { useFirebaseQuery as useQuery } from "../lib/firebase/hooks";
import { orderAccessPath } from "../lib/firebase/customer-access";
import { api, type Id } from "../lib/firebase/operations";
import { ShoppingBag, MapPin, User, Phone, Loader2, Home, FileText, Download } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "../context/CartContext";
import { CheckoutLocationPicker } from "./CheckoutLocationPicker";
import {
  formatCustomizationMessageLines,
  hasMeaningfulCustomizationLines,
  parseProductCustomization,
} from "../lib/productCustomization";
import { normalizeBusinessType, type StoredBusinessType } from "../types/product";
import { createStorefrontTheme } from "../lib/storefrontTheme";
import { storefrontPath } from "../lib/urls";
import {
  getCustomizationSectionTitle,
  getGoogleMapsLocationUrl,
  type CustomerLocation,
} from "../lib/orderDetails";
import {
  buildReferenceImagePath,
  extractReferenceImageId,
  extractReferenceImageUrlFromLine,
} from "../lib/orderFiles";
import {
  buildWhatsAppOrderMessage,
  buildWhatsAppOrderUrl,
} from "../lib/whatsappOrder";

type CheckoutSource = "product" | "cart";

interface CheckoutItem {
  cartItemId?: string;
  productId: Id<"products">;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  customizationNotes?: string[];
}

type CheckoutItems = CheckoutItem[];

export function CheckoutPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const source = (searchParams.get("source") || "cart") as CheckoutSource;
  const productId = searchParams.get("productId");
  const productQty = parseInt(searchParams.get("quantity") || "1");
  const selectedUnitPrice = parseFloat(searchParams.get("unitPrice") || "");
  const customization = useMemo(
    () => parseProductCustomization(searchParams.get("customization")),
    [searchParams],
  );

  const [customerName, setCustomerName] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [customerAlternateMobile, setCustomerAlternateMobile] = useState("");
  const [customerDoorNumber, setCustomerDoorNumber] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerLocation, setCustomerLocation] = useState<CustomerLocation | null>(null);
  const [locationLabel, setLocationLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [addressLookupStatus, setAddressLookupStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [addressLookupMessage, setAddressLookupMessage] = useState("");
  const addressWasEdited = useRef(false);
  const lookupAddressBase = useRef("");

  const { items, clearCart } = useCart();
  const createOrder = useMutation(api.orders.createOrder);
  const saveCart = useMutation(api.carts.saveCart);

  useEffect(() => {
    if (!customerLocation) {
      lookupAddressBase.current = "";
      setAddressLookupStatus("idle");
      setAddressLookupMessage("");
      return;
    }

    const controller = new AbortController();
    addressWasEdited.current = false;
    setAddressLookupStatus("loading");
    setAddressLookupMessage("Finding the address for this map location...");

    const lookupAddress = async () => {
      try {
        const params = new URLSearchParams({
          format: "jsonv2",
          addressdetails: "1",
          zoom: "18",
          lat: String(customerLocation.latitude),
          lon: String(customerLocation.longitude),
        });
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!response.ok) throw new Error("Reverse geocoding failed");
        const data = (await response.json()) as {
          display_name?: string;
          address?: Record<string, string>;
        };
        const displayNameFirstPart = data.display_name?.split(",")[0]?.trim() || "";
        const displayNameDoorNumber = /^\d+[A-Za-z]?(?:[\s/-]+[A-Za-z0-9]+)?$/.test(
          displayNameFirstPart,
        )
          ? displayNameFirstPart
          : "";
        const mapDoorNumber =
          data.address?.house_number?.trim() || displayNameDoorNumber;
        const parts = [
          data.address?.road,
          data.address?.neighbourhood ?? data.address?.suburb,
          data.address?.city ?? data.address?.town ?? data.address?.village,
          data.address?.state,
          data.address?.postcode,
        ].filter(Boolean);
        const resolvedAddressBase = [...new Set(parts)].join(", ") || data.display_name || "";
        const resolvedDoorNumber = customerDoorNumber.trim() || mapDoorNumber;
        const resolvedAddress = [resolvedDoorNumber, resolvedAddressBase]
          .filter(Boolean)
          .join(", ");

        if (resolvedAddress && !addressWasEdited.current) {
          lookupAddressBase.current = resolvedAddressBase;
          if (mapDoorNumber && !customerDoorNumber.trim()) {
            setCustomerDoorNumber(mapDoorNumber);
          }
          setCustomerAddress(resolvedAddress);
          setAddressLookupStatus("success");
          setAddressLookupMessage("Address filled from the map. You can edit it if needed.");
        } else if (!resolvedAddress) {
          setAddressLookupStatus("error");
          setAddressLookupMessage("Could not find an address here. Please enter it manually.");
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setAddressLookupStatus("error");
        setAddressLookupMessage("Could not fill the address automatically. Please enter it manually.");
      }
    };

    void lookupAddress();
    return () => controller.abort();
  }, [customerLocation, customerDoorNumber]);

  // Fetch business and product data
  const slug = searchParams.get("slug");
  const business = useQuery(api.businesses.getBusinessBySlug, { slug: slug! });

  const checkoutTheme = business ? createStorefrontTheme({
    themeColor: business.themeColor,
    brandPalette: business.brandPalette,
  }) : null;

  const product = useQuery(
    api.products.getProduct,
    productId && business?._id
      ? {
          productId: productId as Id<"products">,
          businessId: business._id,
        }
      : "skip"
  );

  // Fetch products to get images
  const products = useQuery(
    api.products.getPublicProducts,
    business ? { businessId: business._id } : "skip"
  );

  // Create a map of product IDs to image URLs
  const productImageMap = useMemo(() => {
    const map = new Map<string, string | undefined>();
    if (products) {
      products.forEach((product) => {
        const image = product.imageUrls?.[0];
        if (image) {
          map.set(product._id, image);
        }
      });
    }
    return map;
  }, [products]);

  const businessType = normalizeBusinessType(
    ((business?.businessType as StoredBusinessType | undefined) ?? "garments"),
  );
  const customizationLines =
    source === "product"
      ? formatCustomizationMessageLines(businessType, customization)
      : [];
  const normalizedCustomizationLines = customizationLines.map((line) => {
    const imageUrl = extractReferenceImageUrlFromLine(line);
    const fileId = imageUrl ? extractReferenceImageId(imageUrl) : "";

    if (!slug || !fileId) {
      return line;
    }

    return `Reference image: ${window.location.origin}${buildReferenceImagePath(slug, fileId)}`;
  });
  const customizationSectionTitle = getCustomizationSectionTitle(businessType);

  // Build checkout items
  const checkoutItems: CheckoutItems = [];

  if (source === "product" && product) {
    const image = product.imageUrls?.[0];
    checkoutItems.push({
      cartItemId: product._id,
      productId: product._id,
      name: product.name,
      price: Number.isFinite(selectedUnitPrice) ? selectedUnitPrice : product.price,
      quantity: productQty,
      customizationNotes:
        normalizedCustomizationLines.length > 0
          ? normalizedCustomizationLines
          : undefined,
      ...(image ? { image } : {}),
    });
  } else {
    // From cart
    items.forEach((item) => {
      const image = productImageMap.get(item.productId);
      checkoutItems.push({
        cartItemId: item.cartItemId,
        productId: item.productId as Id<"products">,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        customizationNotes: hasMeaningfulCustomizationLines(item.customizationLines)
          ? item.customizationLines
          : undefined,
        ...(image ? { image } : {}),
      });
    });
  }

  const totalAmount = checkoutItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );


  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Location is not supported on this device.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCustomerLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          label: locationLabel.trim() || undefined,
        });
        setIsLocating(false);
      },
      () => {
        setIsLocating(false);
        toast.error("Could not access your current location.");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      },
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!customerName.trim()) {
      toast.error("Please enter your name");
      return;
    }
    if (!customerMobile.trim()) {
      toast.error("Please enter your mobile number");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(customerMobile.trim())) {
      toast.error("Enter a valid 10-digit Indian mobile number");
      return;
    }
    const trimmedAlternateMobile = customerAlternateMobile.trim();
    if (!/^[6-9]\d{9}$/.test(trimmedAlternateMobile)) {
      toast.error("Enter a valid 10-digit alternate mobile number");
      return;
    }
    const trimmedDoorNumber = customerDoorNumber.trim();
    if (!trimmedDoorNumber) {
      toast.error("Please enter your door or flat number");
      return;
    }
    const trimmedAddress = customerAddress.trim();
    const trimmedLocationLabel = locationLabel.trim();
    const normalizedLocation = customerLocation
      ? {
          ...customerLocation,
          label: trimmedLocationLabel || undefined,
        }
      : undefined;

    if (!trimmedAddress) {
      toast.error("Please enter your delivery address");
      return;
    }
    if (!normalizedLocation) {
      toast.error("Please select your delivery location on the map");
      return;
    }
    if (checkoutItems.length === 0) {
      toast.error("Your cart is empty");
      return;
    }
    if (!business) {
      toast.error("Business not found");
      return;
    }

    setIsSubmitting(true);
    try {
      const trimmedNotes = notes.trim();

      const result = await createOrder({
        businessId: business._id,
        customerName: customerName.trim(),
        customerMobile: customerMobile.trim(),
        customerAlternateMobile: trimmedAlternateMobile,
        customerDoorNumber: trimmedDoorNumber,
        customerAddress: trimmedAddress,
        customerLocation: normalizedLocation,
        items: checkoutItems,
        totalAmount,
        source,
        notes: trimmedNotes || undefined,
        customerNotes: trimmedNotes || undefined,
        customizationNotes:
          normalizedCustomizationLines.length > 0
            ? normalizedCustomizationLines
            : undefined,
      });

      // Save the Firebase-backed cart so the cart link remains functional.
      const cartId = result.orderId;
      await saveCart({
        businessId: business._id,
        cartId,
        products: checkoutItems.map((item) => ({
          cartItemId: item.cartItemId,
          productId: item.productId,
          quantity: item.quantity,
          name: item.name,
          price: item.price,
          customizationNotes: item.customizationNotes,
        })),
        totalAmount,
      });

      // Clear cart if checkout was from cart
      if (source === "cart") {
        clearCart();
      }

      const orderSuccessPath = orderAccessPath(
        `/order-success?orderId=${encodeURIComponent(result.orderId)}`,
        result.orderId,
      );
      const orderSuccessLink = `${window.location.origin}${orderSuccessPath}`;
      const locationLink = getGoogleMapsLocationUrl(normalizedLocation);

      const whatsappMessage = buildWhatsAppOrderMessage({
        customerName: customerName.trim(),
        customerMobile: customerMobile.trim(),
        customerAlternateMobile: trimmedAlternateMobile,
        customerDoorNumber: trimmedDoorNumber,
        items: checkoutItems,
        totalAmount,
        address: trimmedAddress,
        mapLink: locationLink,
        notes: trimmedNotes || undefined,
        customizationTitle: customizationSectionTitle,
        customizationNotes:
          source === "product" ? normalizedCustomizationLines : undefined,
        orderLink: orderSuccessLink,
        upiId: business.upiId,
        businessName: business.name,
        businessPhone: business.whatsappPhone,
      });
      const whatsappUrl = buildWhatsAppOrderUrl(
        business.whatsappPhone,
        whatsappMessage,
      );

      // Navigate to success page
      navigate(orderSuccessPath);

      // Open WhatsApp in a new tab after a short delay
      setTimeout(() => {
        window.open(whatsappUrl, "_blank", "noopener,noreferrer");
      }, 500);
    } catch (error) {
      toast.error("Failed to place order. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!business) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link
              to={storefrontPath(business.slug)}
            className="inline-flex items-center text-gray-600 hover:text-gray-900"
          >
            ← Back to Store
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Checkout Form */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <ShoppingBag className="w-6 h-6" />
                Checkout
              </h1>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Customer Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                      placeholder="John Doe"
                      required
                    />
                  </div>
                </div>

                {/* Mobile Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mobile Number *
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={customerMobile}
                      onChange={(e) =>
                        setCustomerMobile(e.target.value.replace(/\D/g, "").slice(0, 10))
                      }
                      className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                      placeholder="9876543210"
                      maxLength={10}
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    10-digit Indian mobile number (e.g., 9876543210)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Alternate Mobile Number *
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={customerAlternateMobile}
                      onChange={(e) => setCustomerAlternateMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                      placeholder="9876543210"
                      maxLength={10}
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">A second number for delivery updates.</p>
                </div>

                {/* Delivery Address */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Door / Flat Number *
                  </label>
                  <div className="relative">
                    <Home className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={customerDoorNumber}
                      onChange={(e) => {
                        const nextDoorNumber = e.target.value;
                        setCustomerDoorNumber(nextDoorNumber);
                        if (!addressWasEdited.current && lookupAddressBase.current) {
                          setCustomerAddress([nextDoorNumber.trim(), lookupAddressBase.current]
                            .filter(Boolean)
                            .join(", "));
                        }
                      }}
                      className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                      placeholder="Door no, flat no, floor"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Delivery Address *
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <textarea
                      value={customerAddress}
                      onChange={(e) => {
                        addressWasEdited.current = true;
                        setCustomerAddress(e.target.value);
                      }}
                      rows={3}
                      className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
                      placeholder="House, street, area, city"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Select a map location below to fill this field automatically, then add any missing details.
                  </p>
                  {addressLookupMessage && (
                    <p className={`mt-2 text-xs ${addressLookupStatus === "error" ? "text-red-600" : addressLookupStatus === "success" ? "text-green-700" : "text-gray-500"}`}>
                      {addressLookupMessage}
                    </p>
                  )}
                </div>

                <CheckoutLocationPicker
                  location={customerLocation}
                  setLocation={setCustomerLocation}
                  locationLabel={locationLabel}
                  setLocationLabel={setLocationLabel}
                  onUseCurrentLocation={handleUseCurrentLocation}
                  isLocating={isLocating}
                />

                {/* Notes (Optional) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Order Notes (Optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
                    placeholder="Any special instructions..."
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full px-6 py-4 rounded-lg font-semibold text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ backgroundColor: business.themeColor, color: checkoutTheme?.ctaText ?? "#FFFFFF" }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Placing Order...
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-5 h-5" />
                      Place Order -  ₹{totalAmount.toFixed(2)}
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Order Summary */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-24">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>

              <div className="space-y-4 mb-6">
                {checkoutItems.map((item, index) => (
                  <div key={index} className="flex gap-3">
                    {item.image && (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-16 h-16 object-cover rounded"
                      />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 line-clamp-2">
                        {item.name}
                      </p>
                      <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                      <p className="text-sm font-semibold text-gray-900">
                        ₹{(item.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">₹{totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Delivery</span>
                  <span className="font-medium text-green-600">TBD</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span>Total</span>
                  <span>₹{totalAmount.toFixed(2)}</span>
                </div>
              </div>

              {business.fssaiNumber && (
                <div className="mt-4 pt-4 border-t border-dashed border-gray-200">
                  <div className="flex items-start gap-2 bg-amber-50 p-3 rounded-lg border border-amber-200/60 text-xs text-amber-900">
                    <FileText className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold">FSSAI Certified Bakery</p>
                      <p className="text-amber-800">Lic. No: <span className="font-mono font-semibold">{business.fssaiNumber}</span></p>
                      {business.fssaiDocUrl && (
                        <a
                          href={business.fssaiDocUrl}
                          target="_blank"
                          rel="noreferrer"
                          download="FSSAI_Certificate.pdf"
                          className="inline-flex items-center gap-1 font-semibold text-amber-700 hover:text-amber-900 underline mt-1"
                        >
                          <Download className="w-3 h-3" /> View / Download Certificate
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
