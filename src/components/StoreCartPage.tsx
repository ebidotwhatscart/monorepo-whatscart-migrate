import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useFirebaseQuery as useQuery } from "../lib/firebase/hooks";
import {
  ArrowLeft,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { api } from "../lib/firebase/operations";
import { useCart } from "../context/CartContext";
import { createStorefrontTheme } from "../lib/storefrontTheme";
import { getTenantSlug, storefrontPath } from "../lib/urls";
import { useRuntimeHostname } from "../context/RuntimeLocationContext";
import { evaluateCartCoupon } from "../lib/storefrontPromotions";
import { toast } from "sonner";
import headerCartUrl from "../assets/figma/storefront-header-cart.svg";
import whatscartPoweredLogoUrl from "../assets/figma/whatscart-powered-logo.svg";

type PublicProduct = {
  _id: string;
  price?: number;
  imageUrls?: (string | null)[];
};

const STORE_TEAL = "#046664";

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);
}

export function StoreCartPage() {
  const { slug: routeSlug } = useParams<{ slug: string }>();
  const runtimeHostname = useRuntimeHostname();
  const slug = routeSlug ?? getTenantSlug(runtimeHostname);
  const navigate = useNavigate();
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");

  const business = useQuery(
    api.businesses.getBusinessBySlug,
    slug ? { slug } : "skip",
  );
  const products = useQuery(
    api.products.getPublicProducts,
    business ? { businessId: business._id } : "skip",
  ) as PublicProduct[] | undefined;
  const { items, updateQuantity, removeItem, getTotalItems, getTotalPrice } =
    useCart();

  const themeColor = business?.themeColor || STORE_TEAL;
  const storefrontTheme = createStorefrontTheme({
    themeColor,
    brandPalette: business?.brandPalette,
  });

  const imageMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const product of products ?? []) {
      const image = product.imageUrls?.find(Boolean);
      if (image) map.set(product._id, image);
    }
    return map;
  }, [products]);

  const originalPriceMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const product of products ?? []) {
      if (typeof product.price === "number") {
        map.set(product._id, product.price);
      }
    }
    return map;
  }, [products]);

  if (business === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f9f9f9]">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#046664]" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f9f9f9] px-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold text-[#2d3435]">
            Store not found
          </h1>
          <p className="mt-2 text-sm text-[#5e5e5e]">
            This cart link is not available.
          </p>
        </div>
      </div>
    );
  }

  const subtotal = getTotalPrice();
  const couponResult = useMemo(() => {
    if (!appliedCoupon) {
      return {
        hasCoupon: false,
        discountAmount: 0,
        finalTotal: subtotal,
      };
    }
    return evaluateCartCoupon(appliedCoupon, subtotal, business?._id);
  }, [appliedCoupon, subtotal, business?._id]);

  const handleApplyCoupon = () => {
    if (!couponInput.trim()) {
      toast.error("Please enter a coupon code");
      return;
    }
    const result = evaluateCartCoupon(couponInput, subtotal, business?._id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    if (result.hasCoupon) {
      setAppliedCoupon(couponInput.trim().toUpperCase());
      toast.success(`Coupon "${couponInput.trim().toUpperCase()}" applied!`);
    } else {
      toast.error("Invalid coupon code");
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput("");
    toast.info("Coupon removed");
  };

  const handlePlaceOrder = () => {
    const couponQuery = appliedCoupon ? `&coupon=${encodeURIComponent(appliedCoupon)}` : "";
    navigate(`/checkout?source=cart&slug=${business.slug}${couponQuery}`);
  };

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: storefrontTheme.background,
        color: storefrontTheme.textPrimary,
      }}
    >
      <header
        className="border-b"
        style={{
          borderColor: storefrontTheme.border,
          backgroundColor: "#ffffff",
        }}
      >
        <div className="mx-auto flex h-[73px] max-w-md items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Link
              to={storefrontPath(business.slug)}
              className="flex h-9 w-9 items-center justify-center rounded-full"
              aria-label="Back to store"
            >
              <ArrowLeft
                className="h-[18px] w-[18px]"
                style={{ color: storefrontTheme.textPrimary }}
                aria-hidden="true"
              />
            </Link>
            <h1
              className="text-[18px] font-semibold leading-9"
              style={{ color: storefrontTheme.textPrimary }}
            >
              Your Cart
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-md flex-col gap-[19px] px-6 py-8">
        <section className="space-y-3" aria-label="Cart items">
          <div className="flex items-baseline justify-between">
            <p
              className="text-base font-semibold leading-9"
              style={{ color: storefrontTheme.textPrimary }}
            >
              Your Cart
            </p>
            <span
              className="text-sm font-medium leading-5 tracking-[0.025em]"
              style={{ color: storefrontTheme.textSecondary }}
            >
              {getTotalItems()} Items
            </span>
          </div>

          {items.length === 0 ? (
            <div className="rounded-2xl border border-[rgba(173,179,180,0.1)] bg-white p-8 text-center shadow-[0_24px_48px_rgba(45,52,53,0.06)]">
              <ShoppingBag
                className="mx-auto h-10 w-10 text-[#adb3b4]"
                aria-hidden="true"
              />
              <p className="mt-3 text-sm text-[#5e5e5e]">Your cart is empty.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const cartLineId = item.cartItemId ?? item.productId;
                return (
                <article
                  key={cartLineId}
                  aria-label={`${item.name} item`}
                  className="rounded-2xl border p-4 shadow-[0_24px_48px_rgba(45,52,53,0.06)]"
                  style={{
                    borderColor: storefrontTheme.border,
                    backgroundColor: storefrontTheme.surface,
                  }}
                >
                  <div className="flex gap-3">
                    <div
                      className="flex h-[75px] w-[75px] shrink-0 items-center justify-center overflow-hidden rounded-lg"
                      style={{ backgroundColor: storefrontTheme.surfaceStrong }}
                    >
                      {imageMap.get(item.productId) ? (
                        <img
                          src={imageMap.get(item.productId)}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ShoppingBag
                          className="h-7 w-7 text-[#adb3b4]"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex gap-3">
                        <h3
                          className="min-w-0 flex-1 text-sm leading-5"
                          style={{ color: storefrontTheme.textPrimary }}
                        >
                          {item.name}
                        </h3>
                        <div className="shrink-0 text-right">
                          <p
                            className="text-sm font-semibold leading-5"
                            style={{ color: (originalPriceMap.get(item.productId) ?? 0) > item.price ? "#006E08" : storefrontTheme.textPrimary }}
                          >
                            {formatPrice(item.price)}
                          </p>
                          {(originalPriceMap.get(item.productId) ?? 0) > item.price && (
                            <p className="text-xs text-slate-400 line-through font-normal">
                              {formatPrice(originalPriceMap.get(item.productId)!)}
                            </p>
                          )}
                        </div>
                      </div>
                      {item.customizationLines?.length ? (
                        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-[#5a6061]">
                          {item.customizationLines.map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      ) : null}
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex w-24 items-center justify-between">
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(
                                cartLineId,
                                Math.max(1, item.quantity - 1),
                              )
                            }
                            className="flex h-[27px] w-[30px] items-center justify-center rounded-md bg-[#ebeeef]"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-3 w-3" aria-hidden="true" />
                          </button>
                          <span className="px-3 text-xs leading-[18px] text-[#2d3435]">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(cartLineId, item.quantity + 1)
                            }
                            className="flex h-[27px] w-[30px] items-center justify-center rounded-md"
                            style={{
                              backgroundColor: storefrontTheme.ctaBackground,
                              color: storefrontTheme.ctaText,
                            }}
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-3 w-3" aria-hidden="true" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(cartLineId)}
                          className="text-[#ff7d7d]"
                          aria-label={`Remove ${item.name}`}
                        >
                          <Trash2 className="h-6 w-6" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Coupon Code Section */}
        {items.length > 0 && (
          <section
            className="rounded-2xl border p-4 shadow-[0_24px_48px_rgba(45,52,53,0.06)]"
            style={{
              borderColor: storefrontTheme.border,
              backgroundColor: storefrontTheme.surface,
            }}
          >
            <div className="space-y-2">
              <label
                className="text-sm font-semibold leading-5"
                style={{ color: storefrontTheme.textPrimary }}
              >
                Have a coupon?
              </label>

              {appliedCoupon ? (
                <div className="flex items-center justify-between rounded-lg bg-[#006E08]/10 border border-[#006E08]/30 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#006E08] text-sm tracking-wider">
                      {appliedCoupon}
                    </span>
                    <span className="text-xs text-[#006E08] font-semibold">
                      (Saved {formatPrice(couponResult.discountAmount)})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="text-xs font-bold text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    placeholder="Enter coupon code"
                    className="flex-1 h-11 rounded-lg border px-3 text-sm font-medium uppercase tracking-wider outline-none"
                    style={{
                      borderColor: storefrontTheme.border,
                      backgroundColor: storefrontTheme.background,
                      color: storefrontTheme.textPrimary,
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    className="px-4 h-11 rounded-lg text-sm font-bold shadow-sm"
                    style={{
                      backgroundColor: storefrontTheme.ctaBackground,
                      color: storefrontTheme.ctaText,
                    }}
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        <section
          className="rounded-2xl border p-6 shadow-[0_24px_48px_rgba(45,52,53,0.06)]"
          style={{
            borderColor: storefrontTheme.border,
            backgroundColor: storefrontTheme.surface,
          }}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between text-base leading-6">
              <span>Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>

            {couponResult.hasCoupon && couponResult.discountAmount > 0 && (
              <div className="flex items-center justify-between text-base leading-6 text-[#006E08] font-semibold">
                <span>Coupon Discount ({appliedCoupon})</span>
                <span>-{formatPrice(couponResult.discountAmount)}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-base leading-6">
              <span>Shipping</span>
              <span>Calculated on WhatsApp</span>
            </div>
            <div className="border-t pt-4" style={{ borderColor: storefrontTheme.border }}>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-black leading-7">Total</span>
                <span
                  className="text-lg font-bold leading-8 text-[#006E08]"
                >
                  {formatPrice(couponResult.finalTotal)}
                </span>
              </div>
            </div>
            <div
              className="rounded-lg border p-4"
              style={{
                borderColor: storefrontTheme.support,
                backgroundColor: storefrontTheme.supportSoft,
              }}
            >
              <p
                className="text-xs leading-[19.5px]"
                style={{ color: storefrontTheme.textSecondary }}
              >
                <span className="font-semibold" style={{ color: storefrontTheme.textPrimary }}>Note:</span> &nbsp; Orders will be finalized on WhatsApp chat to ensure the
                highest quality and personalized service for your product.
              </p>
            </div>
          </div>
        </section>

        <button
          type="button"
          onClick={handlePlaceOrder}
          disabled={items.length === 0}
          className="flex h-[52px] items-center justify-center rounded-xl px-8 text-base font-bold disabled:opacity-50"
          style={{
            backgroundColor: storefrontTheme.ctaBackground,
            color: storefrontTheme.ctaText,
          }}
        >
          Place order
        </button>

        <a
          href="https://whatscart.in/"
          aria-label="Powered by WhatsCart"
          className="flex h-[28px] items-center justify-center gap-[10px] text-base font-medium leading-[1.4]"
          style={{ color: storefrontTheme.textPrimary }}
        >
          <span>Powered by</span>
          <span className="flex items-center gap-[10px]">
            <img
              src={whatscartPoweredLogoUrl}
              alt="Whatscart logo"
              className="h-7 w-[22px]"
            />
            Whatscart
          </span>
        </a>
      </main>
    </div>
  );
}

function CartInput({
  label,
  value,
  onChange,
  placeholder,
  storefrontTheme,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  storefrontTheme: ReturnType<typeof createStorefrontTheme>;
}) {
  return (
    <label className="block">
      <span
        className="mb-1.5 block pl-1 text-base font-medium leading-6"
        style={{ color: storefrontTheme.textPrimary }}
      >
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-[46px] w-full rounded-lg border bg-white px-4 text-base outline-none"
        style={{
          borderColor: storefrontTheme.border,
          backgroundColor: storefrontTheme.background,
          color: storefrontTheme.textPrimary,
        }}
        placeholder={placeholder}
      />
    </label>
  );
}
