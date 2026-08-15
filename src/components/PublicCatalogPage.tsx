import { useFirebaseQuery as useQuery } from "../lib/firebase/hooks";
import { Link, useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/firebase/operations";
import { useEffect, useState } from "react";
import { CartSidebar } from "./CartSidebar";
import ShareSheet from "./ShareSheet";
import { useCart } from "../context/CartContext";
import { ArrowLeft, Search, Share2, ShoppingCart, Store, X } from "lucide-react";
import { useAnalytics } from "../hooks/useAnalytics";
import { toast } from "sonner";
import { getProductMetaChips } from "../components/products/storefrontVariants";
import { normalizeBusinessType, type BusinessType } from "../types/product";
import { createStorefrontTheme, type StorefrontTheme } from "../lib/storefrontTheme";
import { getTenantSlug, productSlug, storefrontPath, storefrontUrl } from "../lib/urls";
import { useRuntimeHostname } from "../context/RuntimeLocationContext";

export function PublicCatalogPage() {
  const navigate = useNavigate();
  const { slug: routeSlug, catalogId } = useParams<{ slug: string; catalogId: string }>();
  const runtimeHostname = useRuntimeHostname();
  const slug = routeSlug ?? getTenantSlug(runtimeHostname);
  const data = useQuery(
    api.catalogs.getPublicCatalog,
    slug && catalogId ? { slug, catalogId } : "skip",
  );
  const { updateBusinessId, getTotalItems } = useCart();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const business = data?.business;
  const products = data?.products ?? [];
  const catalog = data?.catalog;
  const cartItemCount = getTotalItems();

  useEffect(() => {
    if (business) {
      updateBusinessId(business._id);
    }
  }, [business, updateBusinessId]);

  const { trackPage } = useAnalytics(business?._id || "");
  useEffect(() => {
    if (business?._id && catalogId) {
      trackPage(`/catalog/${catalogId}`);
    }
  }, [business?._id, catalogId, trackPage]);

  const displayProducts = searchQuery.trim()
    ? products.filter((product) =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : products;

  const [shareOpen, setShareOpen] = useState(false);

  const catalogUrl = business?.slug ? storefrontUrl(business.slug, `catalog/${catalogId}`) : "";

  const catalogShareText = (() => {
    if (!catalog?.name || !business?.name) return "";
    const productLines = products.map(
      (p, i) =>
        `${i + 1}. ${p.name} — ₹${p.price.toFixed(0)}${
          p.description ? `\n   ${p.description.slice(0, 100)}` : ""
        }\n   ${business?.slug ? storefrontUrl(business.slug, `products/${productSlug(p.name, p._id, p.slug)}`) : ""}`,
    );
    return [
      `My collection: ${catalog.name} from ${business.name}`,
      "",
      ...productLines,
      "",
      `View full collection: ${catalogUrl}`,
    ].join("\n");
  })();

  const handleNativeShare = async () => {
    if (!navigator.share || !catalogShareText) return;

    try {
      const imageUrls = products
        .map((p) => p.imageUrls?.[0])
        .filter(Boolean);

      if (imageUrls.length > 0 && navigator.canShare) {
        const results = await Promise.allSettled(
          imageUrls.map(async (url) => {
            const res = await fetch(url);
            const blob = await res.blob();
            return new File([blob], `product.jpg`, { type: blob.type });
          }),
        );

        const files = results
          .filter(
            (r): r is PromiseFulfilledResult<File> => r.status === "fulfilled",
          )
          .map((r) => r.value);

        if (files.length > 0) {
          const shareData: ShareData = { text: catalogShareText, files };
          if (navigator.canShare(shareData)) {
            await navigator.share(shareData);
            return;
          }
        }
      }

      await navigator.share({ text: catalogShareText });
    } catch {
      // user cancelled or share failed
    }
  };

  if (data === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fcf8ff]">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!data || !business || !catalog) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fcf8ff] px-6">
        <div className="rounded-3xl bg-white p-8 text-center shadow-xl">
          <h1 className="mb-2 text-2xl font-black text-gray-900">
            Catalog Not Found
          </h1>
          <p className="mb-6 text-gray-600">
            This catalog link is invalid or no longer available.
          </p>
          <Link
            to={slug ? storefrontPath(slug) : "/"}
            className="inline-flex rounded-full bg-primary px-8 py-3 text-sm font-bold uppercase tracking-widest text-on-primary"
          >
            Back to Store
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcf8ff] text-[#1b1b21]">
        <header className="fixed top-0 z-50 w-full bg-[#fcf8ff]/85 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-screen-xl items-center justify-between px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to={storefrontPath(business.slug)}
              className="active:scale-95"
              style={{ color: business.themeColor }}
              aria-label="Back to store"
            >
              <ArrowLeft className="h-6 w-6" />
            </Link>
            {business.logoUrl ? (
              <img
                src={business.logoUrl}
                alt={business.name}
                className="h-8 w-auto max-w-[140px] object-contain"
              />
            ) : (
              <div className="min-w-0">
                <p
                  className="truncate text-sm font-black uppercase tracking-widest"
                  style={{ color: business.themeColor }}
                >
                  {business.name}
                </p>
              </div>
            )}
            <p className="ml-2 truncate text-xs font-bold text-gray-500">
              {catalog.name}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setShareOpen(true)}
              className="active:scale-95"
              style={{ color: business.themeColor }}
              aria-label="Share collection"
            >
              <Share2 className="h-5 w-5" />
            </button>
            <button
              onClick={() => navigate(storefrontPath(slug!, "cart"))}
              className="relative flex h-10 w-10 items-center justify-center"
              aria-label="Cart"
            >
              <ShoppingCart className="h-6 w-6" aria-hidden="true" />
              {cartItemCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#f87171] px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
                  {cartItemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-screen-xl px-6 pb-32 pt-24">
        <section className="mb-8 rounded-[2rem] bg-white p-6 shadow-[0_25px_60px_-45px_rgba(15,23,42,0.6)]">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-gray-400">
            Shared catalog
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-gray-950">
            {catalog.name}
          </h1>
          <p className="mt-2 text-sm font-medium text-gray-500">
            {products.length} selected products from {business.name}
          </p>
        </section>

        <div className="mx-auto mb-8 max-w-2xl">
          <div className="group relative">
            <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-on-surface-variant">
              <Search className="h-5 w-5 opacity-50" />
            </div>
            <input
              type="text"
              placeholder="Search this catalog..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border-none bg-[#e5e1e9] py-4 pl-12 pr-12 transition-all placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2"
              style={
                {
                  "--tw-ring-color": business.themeColor,
                } as React.CSSProperties
              }
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600"
                aria-label="Clear search"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {displayProducts.length === 0 ? (
          <div className="py-20 text-center">
            <div className="mb-4 text-6xl text-gray-400">🔍</div>
            <h2 className="mb-2 text-xl font-bold text-gray-900">
              No products found
            </h2>
            <p className="text-gray-600">Try a different search term.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-8">
            {displayProducts.map((product, index) => (
              <CatalogProductCard
                key={product._id}
                product={product}
                businessSlug={business.slug}
                businessType={normalizeBusinessType(business.businessType as any)}
                themeColor={business.themeColor}
                index={index}
              />
            ))}
          </div>
        )}
      </main>

      <CartSidebar
        businessId={business._id}
        businessSlug={business.slug}
        businessName={business.name}
        themeColor={business.themeColor}
        whatsappPhone={business.whatsappPhone}
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
      />

      <ShareSheet
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        url={catalogUrl}
        title={`Collection: ${catalog?.name ?? ""}`}
        shareText={catalogShareText}
        onNativeShare={handleNativeShare}
      />
    </div>
  );
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);
}

function CatalogProductCard({
  product,
  businessSlug,
  businessType,
  themeColor,
  index,
}: {
  product: any;
  businessSlug: string;
  businessType: BusinessType;
  themeColor: string;
  index: number;
}) {
  const imageUrl = product.imageUrls?.find(Boolean) ?? null;
  const storefrontTheme = createStorefrontTheme({
    themeColor,
    brandPalette: undefined,
  });
  const chips = getProductMetaChips(businessType, product.productTypeDetails);
  const categoryName = product.category?.name;

  return (
    <Link
      to={storefrontPath(businessSlug, `products/${productSlug(product.name, product._id, product.slug)}`)}
      className="[grid-template-rows:subgrid] row-span-5 min-w-0 rounded-[12px] p-2 transition-transform duration-200 hover:-translate-y-1"
    >
      <div
        className="flex aspect-square items-center justify-center overflow-hidden rounded-[12px] lg:rounded-[12px]"
        style={{ backgroundColor: storefrontTheme.surfaceStrong }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="h-full w-full object-cover"
            loading={index === 0 ? "eager" : "lazy"}
          />
        ) : (
          <Store className="h-8 w-8 text-[#777]" aria-hidden="true" />
        )}
      </div>

      <p
        className="mt-3 line-clamp-2 text-[15px] font-semibold leading-5 lg:mt-4 lg:text-lg lg:font-bold lg:leading-7"
        style={{ color: storefrontTheme.textPrimary }}
      >
        {product.name}
      </p>

      <p
        className="mt-1 text-sm font-semibold lg:text-base lg:font-medium lg:leading-6"
        style={{ color: storefrontTheme.textPrimary }}
      >
        {formatPrice(product.price)}
      </p>

      <div className="mt-2 flex min-h-[24px] flex-wrap gap-1">
        {categoryName && (
          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{
              backgroundColor: storefrontTheme.chipBackground,
              color: storefrontTheme.chipText,
            }}
          >
            {categoryName}
          </span>
        )}
        {chips.map((chip) => (
          <span
            key={chip}
            className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{
              backgroundColor: storefrontTheme.chipBackground,
              color: storefrontTheme.chipText,
            }}
          >
            {chip}
          </span>
        ))}
      </div>
    </Link>
  );
}
