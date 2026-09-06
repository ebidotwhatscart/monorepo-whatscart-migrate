import { useParams, Link, useNavigate } from "react-router-dom";
import dynamic from "next/dynamic";
import { useFirebaseMutation as useMutation } from "../lib/firebase/mutations";
import { useFirebaseQuery as useQuery } from "../lib/firebase/hooks";
import { api, type Id } from "../lib/firebase/operations";
import { useState, useRef, useEffect, useCallback, type ChangeEvent, type CSSProperties } from "react";
import { useCart } from "../context/CartContext";
import {
  ShoppingCart,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Package,
  Share2,
  ArrowLeft,
  Upload,
  Loader2,
  Minus,
  Plus,
  ImageIcon,
  Expand,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAnalytics } from "../hooks/useAnalytics";
import { createStorefrontTheme, isDark, type StorefrontTheme } from "../lib/storefrontTheme";
import { compressImage } from "../lib/imageCompression";
import { StorefrontFooter } from "./StorefrontFooter";
import { StorefrontHeader } from "./StorefrontHeader";
import { StorefrontNotFound } from "./StorefrontNotFound";
import { getTenantSlug, productSlug, storefrontPath, storefrontUrl } from "../lib/urls";
import { useRuntimeHostname } from "../context/RuntimeLocationContext";

import {
  normalizeBusinessType,
  type BusinessType,
  type ProductCustomizationOption,
  type ProductTypeDetails,
  type StoredBusinessType,
} from "../types/product";
import {
  getAvailableCustomizationOptions,
  getCustomizationImageFieldLabel,
  getCustomizationOptionLabel,
  getCustomizationTextFieldLabel,
  getCustomizationTextPlaceholder,
  hasSelectedCustomizations,
  isImageCustomizationOption,
  isTextCustomizationOption,
  createCartItemId,
  formatCustomizationMessageLines,
} from "../lib/productCustomization";
import { calculateProductDiscount } from "../lib/storefrontPromotions";

// These surfaces are not needed to paint or operate the product hero. Loading
// them only when they can be seen keeps their query clients and icon bundles
// out of the critical mobile hydration path.
const CartSidebar = dynamic(() => import("./CartSidebar").then((module) => module.CartSidebar));
const ProductReviewsSection = dynamic(() =>
  import("./ProductReviewsSection").then((module) => module.ProductReviewsSection),
);
const ShareSheet = dynamic(() => import("./ShareSheet"));

export function ProductDetail() {
  const { slug: routeSlug, productId: productSlugParam } = useParams<{ slug: string; productId: string }>();
  const runtimeHostname = useRuntimeHostname();
  const slug = routeSlug ?? getTenantSlug(runtimeHostname);
  const navigate = useNavigate();
  const business = useQuery(api.businesses.getBusinessBySlug, { slug: slug! });
  const slugProduct = useQuery(
    api.products.getPublicProductBySlug,
    slug && productSlugParam ? { slug, productSlug: productSlugParam } : "skip",
  );
  // Storefront URLs are opaque public references: the server resolves a
  // canonical slug first, then safely falls back to a migrated legacy ID. Do
  // not infer an ID from URL formatting or cast an untrusted route value.
  const product = slugProduct;
  const relatedProducts = useQuery(
    api.products.getRelatedProducts,
    business?._id && product?._id
      ? {
          businessId: business._id,
          categoryId: product.categoryId,
          excludeProductId: product._id,
          limit: 8,
        }
      : "skip",
  );
  const variants = useQuery(
    api.products.getProductVariants,
    product?._id && business?._id
      ? {
          productId: product._id,
          businessId: business._id,
        }
      : "skip",
  );
  const categories = useQuery(
    api.categories.getPublicCategories,
    business?._id ? { businessId: business._id } : "skip",
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedSizePrice, setSelectedSizePrice] = useState<number>(0);
  const [isAboutProductOpen, setIsAboutProductOpen] = useState(true);
  const [isReturnPolicyOpen, setIsReturnPolicyOpen] = useState(true);
  const [selectedAddOns, setSelectedAddOns] = useState<ProductCustomizationOption[]>([]);
  const [customText, setCustomText] = useState("");
  const [uploadedImageUrl, setUploadedImageUrl] = useState("");
  const [uploadedImageName, setUploadedImageName] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const mainImageRef = useRef<HTMLImageElement>(null);

  const { items = [], addItem, updateQuantity, getTotalItems, updateBusinessId } = useCart();
  const generateCustomerUploadUrl = useMutation(api.orders.generateCustomerUploadUrl);
  const resolveCustomerUploadUrl = useMutation(api.orders.resolveCustomerUploadUrl);

  // Update businessId when business loads
  useEffect(() => {
    if (business) {
      updateBusinessId(business._id);
    }
  }, [business, updateBusinessId]);

  // Track product view
  const { trackProduct } = useAnalytics(business?._id || "");
  useEffect(() => {
    if (business?._id && product?._id) {
      trackProduct(product._id);
    }
  }, [business?._id, product?._id, trackProduct]);

  const colorVariantOptions = variants ?? [];
  const activeVariant = product;
  const activeVariantId = product?._id;

  const cartItemCount = getTotalItems();
  const storefrontTheme = createStorefrontTheme({
    themeColor: business?.themeColor,
    brandPalette: business?.brandPalette,
  });

  useEffect(() => {
    if (product && slug && productSlugParam) {
      const canonicalSlug = productSlug(product.name, product._id, product.slug);
      if (canonicalSlug !== productSlugParam) {
        navigate(storefrontPath(slug, `products/${canonicalSlug}`), { replace: true });
      }
    }
  }, [navigate, product, productSlugParam, slug]);
  const brandColor = storefrontTheme.ctaBackground;
  const productSizes = activeVariant?.sizes ?? product?.sizes ?? [];
  const sizesData = productSizes.filter((row: { size: string }) => row.size.trim());
  const availableSizes = sizesData.map((row: { size: string }) => row.size.trim());
  const sizeOptions = availableSizes;
  const baseProductPrice = activeVariant?.price ?? product?.price ?? sizesData.find((row) => typeof row.price === "number")?.price ?? 0;
  const currentProductPrice = selectedSizePrice > 0 ? selectedSizePrice : baseProductPrice;

  const discountInfo = calculateProductDiscount(
    product?._id ?? "",
    product?.categoryId,
    currentProductPrice,
    business?._id,
  );
  const finalEffectivePrice = discountInfo.discountedPrice;

  const priceLight = !isDark(brandColor);
  const darkenColor = (h: string, f: number) => {
    const v = parseInt(h.replace("#", ""), 16);
    const r = Math.round(((v >> 16) & 255) * f);
    const g = Math.round(((v >> 8) & 255) * f);
    const b = Math.round((v & 255) * f);
    return `rgb(${r}, ${g}, ${b})`;
  };
  const priceTextColor = priceLight ? darkenColor(brandColor, 0.38) : brandColor;
  const businessType = normalizeBusinessType(
    (business?.businessType as StoredBusinessType | undefined) ?? "garments",
  );
  const productImages = activeVariant?.imageUrls || product?.imageUrls || [];
  const images =
    businessType === "garments" && product?.sizeGuideImageUrl
      ? [...productImages, product.sizeGuideImageUrl]
      : productImages;
  const productInfoRows = getProductInfoRows(businessType, product?.productTypeDetails);
  const availableCustomizationOptions = getAvailableCustomizationOptions(
    businessType,
    product?.productTypeDetails,
  );
  const sizeLabel = businessType === "home_bakery" ? "Select Quantity" : "Select Size";
  const hasTextCustomization = selectedAddOns.some(isTextCustomizationOption);
  const hasImageCustomization = selectedAddOns.some(isImageCustomizationOption);
  const customizationPayload = {
    selectedSize: selectedSize || undefined,
    selectedAddOns,
    customText: customText.trim() || undefined,
    uploadedImageUrl: uploadedImageUrl || undefined,
    uploadedImageName: uploadedImageName || undefined,
  };
  const targetProduct = activeVariant ?? product;
  const currentCartItem = targetProduct
    ? items.find((item) => item.cartItemId === createCartItemId(targetProduct._id, customizationPayload))
    : undefined;

  const aboutProductItems = product?.description
    ? product.description
        .split(/\.\s*|\n+/)
        .map((item: string) => item.trim())
        .filter(Boolean)
    : [];
  const returnPolicyItems = product?.returnPolicy
    ? getReturnPolicyItems(product.returnPolicy)
    : [];

  useEffect(() => {
    if (!sizeOptions.length) return;
    if (!selectedSize || !sizeOptions.includes(selectedSize)) {
      setSelectedSize(sizeOptions[0]);
      const sizeData = sizesData.find((s) => s.size.trim() === sizeOptions[0]);
      setSelectedSizePrice(sizeData?.price ?? 0);
    }
  }, [selectedSize, sizeOptions, sizesData]);

  useEffect(() => {
    const allowedOptions = new Set(
      availableCustomizationOptions.map((option) => option.value),
    );
    setSelectedAddOns((prev) => {
      const next = prev.filter((option) => allowedOptions.has(option));
      if (
        next.length === prev.length &&
        next.every((option, index) => option === prev[index])
      ) {
        return prev;
      }

      return next;
    });
  }, [availableCustomizationOptions]);

  useEffect(() => {
    if (!hasTextCustomization) {
      setCustomText("");
    }
  }, [hasTextCustomization]);

  useEffect(() => {
    if (!hasImageCustomization) {
      setUploadedImageUrl("");
      setUploadedImageName("");
    }
  }, [hasImageCustomization]);

  // Handle swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const diff = touchStart - touchEnd;
    const threshold = 50; // Minimum swipe distance

    if (diff > threshold) {
      // Swiped left - next image
      goToNext();
    } else if (diff < -threshold) {
      // Swiped right - previous image
      goToPrevious();
    }
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const handleAddToCart = () => {
    if (!product || !business) return;
    const targetProduct = activeVariant ?? product;

    addItem({
      cartItemId: createCartItemId(targetProduct._id, customizationPayload),
      productId: targetProduct._id,
      name: targetProduct.name,
      price: finalEffectivePrice,
      image: product.imageUrls?.[0] ?? undefined,
      quantity,
      customization: hasSelectedCustomizations(customizationPayload)
        ? customizationPayload
        : undefined,
      customizationLines: formatCustomizationMessageLines(
        businessType,
        hasSelectedCustomizations(customizationPayload)
          ? customizationPayload
          : undefined,
      ),
    });

    toast.success(`Added ${quantity} ${product.name}${quantity > 1 ? 's' : ''} to cart!`);
    setQuantity(1);
  };

  const handleCustomizationToggle = (option: ProductCustomizationOption) => {
    setSelectedAddOns((prev) =>
      prev.includes(option)
        ? prev.filter((item) => item !== option)
        : [...prev, option],
    );
  };

  const handleReferenceImageChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose a valid image file.");
      return;
    }

    setIsUploadingImage(true);

    try {
      const compressed = await compressImage(file);
      const uploadUrl = await generateCustomerUploadUrl({});
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Type": compressed.type,
        },
        body: compressed,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const { storageId } = (await response.json()) as {
        storageId?: Id<"_storage">;
      };

      if (!storageId) {
        throw new Error("Upload failed");
      }

      const fileUrl = await resolveCustomerUploadUrl({ storageId });
      if (!fileUrl) {
        throw new Error("Could not resolve file URL");
      }

      setUploadedImageName(file.name);
      setUploadedImageUrl(fileUrl);
      toast.success("Reference image uploaded.");
    } catch {
      toast.error("Could not upload the image. Please try again.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleShare = () => {
    setShareOpen(true);
  };

  const handleBack = () => {
    if (business?.slug) navigate(storefrontPath(business.slug));
  };

  if (business === undefined || product === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!business || !product) {
    return <StorefrontNotFound />;
  }

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: storefrontTheme.background,
        color: storefrontTheme.textPrimary,
      }}
    >
      {isCartOpen && (
        <CartSidebar
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          businessId={business._id}
          businessSlug={business.slug}
          businessName={business.name}
          themeColor={storefrontTheme.ctaBackground}
          whatsappPhone={business.whatsappPhone}
        />
      )}

      {/* Desktop header */}
      <div className="hidden lg:block">
        <StorefrontHeader
          business={business}
          storefrontTheme={storefrontTheme}
          categories={categories ?? []}
          getTotalItems={getTotalItems}
          selectedCategory="all"
          onSelectCategory={() => navigate(storefrontPath(slug!, ""))}
          slug={slug!}
          onCartClick={() => navigate(storefrontPath(slug!, "cart"))}
          searchQuery=""
          onSearchChange={() => {}}
        />
      </div>

      {/* Mobile top bar */}
      <header className="fixed left-0 right-0 top-0 z-30 flex h-14 items-center justify-between border-b border-black/5 bg-white px-4 lg:hidden">
        <button
          onClick={handleBack}
          aria-label="Go back"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/70"
        >
          <ArrowLeft className="h-5 w-5 text-[#2D3435]" />
        </button>
        <span className="max-w-[200px] truncate text-center text-sm font-semibold text-[#2D3435]">
          {product.name}
        </span>
        <button
          onClick={() => navigate(storefrontPath(slug!, "cart"))}
          aria-label="Open cart"
          className="relative flex h-9 w-9 items-center justify-center"
        >
          <ShoppingCart className="h-5 w-5 text-[#2D3435]" />
          {cartItemCount > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white"
              style={{ backgroundColor: brandColor }}
            >
              {cartItemCount}
            </span>
          )}
        </button>
      </header>

      <main className="pb-20 pt-[3.75rem] mx-auto max-w-screen-xl lg:pt-12">

        {/* Two-column layout for desktop */}
        <div className="lg:grid lg:grid-cols-[1fr_1.22fr] lg:gap-[52px] lg:px-12">
          {/* Left: Image Section */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            {/* Mobile: card-style image */}
            <section className="relative mx-4 mt-4 overflow-hidden rounded-xl border border-[#3dac35]/5 bg-white shadow-sm lg:hidden">
              <div className="aspect-square bg-slate-100" style={{ position: "relative" }}>
                {images.length > 0 ? (
                  <img
                    src={images[currentIndex]!}
                    alt={product.name}
                    fetchPriority="high"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-300">
                    <ImageIcon className="h-10 w-10" />
                  </div>
                )}
                {images.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsFullscreen(true)}
                    aria-label="View fullscreen"
                    className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition hover:bg-black/50"
                  >
                    <Expand className="h-4 w-4" />
                  </button>
                )}
              </div>
              {images.length > 1 && (
                <div
                  role="group"
                  aria-label="Mobile product image thumbnails"
                  className="flex gap-2 overflow-x-auto px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {images.map((url, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCurrentIndex(idx)}
                      aria-label={`Show product image ${idx + 1}`}
                      aria-pressed={idx === currentIndex}
                      className={`h-14 w-14 shrink-0 overflow-hidden rounded-md bg-slate-100 transition ${
                        idx === currentIndex
                          ? "ring-2 ring-offset-1"
                          : "opacity-60 hover:opacity-100"
                      }`}
                      style={{
                        ...(idx === currentIndex
                          ? { "--tw-ring-color": brandColor }
                          : {}),
                      } as CSSProperties}
                    >
                      <img
                        src={url}
                        alt={`${product.name} mobile thumbnail ${idx + 1}`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Fullscreen image viewer (mobile) */}
            {isFullscreen && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 lg:hidden"
                onClick={() => setIsFullscreen(false)}
              >
                <button
                  type="button"
                  onClick={() => setIsFullscreen(false)}
                  aria-label="Close fullscreen"
                  className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm"
                >
                  <X className="h-5 w-5" />
                </button>
                <img
                  src={images[currentIndex] ?? images[0]!}
                  alt={product.name}
                  className="max-h-[90vh] max-w-[90vw] object-contain"
                  onClick={(e) => e.stopPropagation()}
                />
                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); goToPrevious(); }}
                      aria-label="Previous image"
                      className="absolute left-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm"
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); goToNext(); }}
                      aria-label="Next image"
                      className="absolute right-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm"
                    >
                      <ChevronRight className="h-6 w-6" />
                    </button>
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                      {images.map((_, idx) => (
                        <span
                          key={idx}
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            idx === currentIndex ? "w-6 bg-white" : "w-1.5 bg-white/40"
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Desktop image section */}
            <div
              className="hidden w-full flex-col items-center justify-center lg:flex lg:rounded-xl"
              style={{ backgroundColor: "#F2F4F4" }}
            >
              <div className="w-full relative aspect-[4/5] md:aspect-square group bg-surface-container-low lg:rounded-xl">
                  {images.length > 0 ? (
                    <>
                      <img
                        ref={mainImageRef}
                        src={images[currentIndex]!}
                        alt={`${product.name} image ${currentIndex + 1}`}
                        fetchPriority="high"
                        decoding="async"
                        className="absolute inset-0 h-full w-full object-cover transition-all duration-700 lg:rounded-xl"
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                      />

                      {images.length > 1 && (
                        <>
                          <div className="absolute inset-y-0 left-0 w-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={goToPrevious}
                              className="w-10 h-10 bg-white/20 backdrop-blur-xl rounded-full flex items-center justify-center text-white active:scale-90 transition-transform hover:bg-white/40"
                              aria-label="Previous image"
                            >
                              <ChevronLeft className="w-5 h-5" />
                            </button>
                          </div>
                          <div className="absolute inset-y-0 right-0 w-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={goToNext}
                              className="w-10 h-10 bg-white/20 backdrop-blur-xl rounded-full flex items-center justify-center text-white active:scale-90 transition-transform hover:bg-white/40"
                              aria-label="Next image"
                            >
                              <ChevronRight className="w-5 h-5" />
                            </button>
                          </div>

                          {/* Modern pagination dots */}
                          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                            {images.map((_, idx) => (
                              <button
                                key={idx}
                                onClick={() => setCurrentIndex(idx)}
                                className={`transition-all duration-300 rounded-full ${
                                  idx === currentIndex
                                    ? "w-6 h-1.5"
                                    : "w-1.5 h-1.5 bg-white/40 hover:bg-white/60"
                                }`}
                                style={{
                                  backgroundColor:
                                    idx === currentIndex
                                      ? brandColor
                                      : undefined,
                                }}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-surface-container">
                      <Package className="w-12 h-12 text-on-surface-variant/20" />
                    </div>
                  )}

                  <button
                    onClick={handleBack}
                    aria-label="Go back"
                    className="absolute top-4 left-4 w-10 h-10 bg-white/70 backdrop-blur-md rounded-full flex items-center justify-center active:scale-90 transition-transform hover:scale-110"
                  >
                    <ArrowLeft className="w-6 h-6 text-[#2D3435]" />
                  </button>
                  <button
                    onClick={handleShare}
                    aria-label="Share product"
                    className="absolute top-4 right-4 w-10 h-10 bg-white/70 backdrop-blur-md rounded-full flex items-center justify-center active:scale-90 transition-transform hover:scale-110"
                  >
                    <Share2 className="w-6 h-6 text-[#2D3435]" />
                  </button>
                </div>
              </div>

              {/* Desktop thumbnail gallery */}
              {images.length > 1 && (
                <div className="mt-3 hidden gap-2 lg:flex">
                  {images.map((url, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentIndex(idx)}
                      className={`overflow-hidden rounded-[4px] transition-opacity ${
                        idx === currentIndex ? "ring-2 ring-[#2D3435]" : "opacity-60 hover:opacity-100"
                      }`}
                    >
                      <img
                        src={url}
                        alt={`${product.name} thumbnail ${idx + 1}`}
                        className="h-16 w-16 object-cover"
                        loading="lazy"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Details Section */}
            <div className="flex flex-col gap-2 px-6 py-8 lg:px-0">
              <h2
                className="text-[30px] font-bold leading-[45px] lg:text-[36px]"
                style={{ color: "#2D3435", letterSpacing: "-0.05em" }}
              >
                {product.name}
              </h2>
              <div className="flex items-center gap-3 pt-2">
                <p
                  className="text-2xl font-bold leading-9 lg:text-[30px] lg:leading-[36px]"
                  style={{
                    width: "fit-content",
                    color: discountInfo.hasDiscount ? "#006E08" : priceTextColor,
                  }}
                >
                  ₹{finalEffectivePrice.toFixed(0)}
                </p>
                {discountInfo.hasDiscount && (
                  <>
                    <p className="text-lg text-slate-400 line-through font-normal">
                      ₹{currentProductPrice.toFixed(0)}
                    </p>
                    <span className="rounded-full bg-[#006E08] px-2.5 py-0.5 text-xs font-bold text-white shadow-sm">
                      {discountInfo.discountBadge}
                    </span>
                  </>
                )}
              </div>

              {colorVariantOptions.length > 0 && (
                <section aria-label="Colour variants" className="pt-6">
                  <p className="text-base font-bold leading-5 text-[#2D3435]">
                    {colorVariantOptions[0]?.variantType || "Select Variant"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {colorVariantOptions.map((variant) => {
                      const isSelected = activeVariantId === variant._id;

                      return (
                        <Link
                          key={variant._id}
                          to={storefrontPath(
                            slug!,
                            `products/${productSlug(variant.name, variant._id, variant.slug)}`,
                          )}
                          aria-current={isSelected ? "page" : undefined}
                          className="flex items-center gap-2 rounded-full border px-3 py-2 text-sm leading-5 transition"
                          style={{
                            borderColor: isSelected ? brandColor : "#D9D9D9",
                            borderWidth: isSelected ? 2 : 1,
                          }}
                        >
                          {variant.colorSwatch && variant.variantType === "Color" ? (
                            <span
                              className="h-5 w-5 rounded-full border border-slate-200"
                              style={{ backgroundColor: variant.colorSwatch }}
                            />
                          ) : (
                            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white text-[8px] font-bold text-slate-400">
                              {variant.variantType?.charAt(0) || "*"}
                            </span>
                          )}
                          <span
                            className="text-sm font-medium"
                            style={{ color: "#2D3435" }}
                          >
                            {variant.variantValue ||
                              variant.colorName ||
                              variant.variantType ||
                              product.name}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              )}

              {sizesData.length > 0 && (
                <section aria-label="Available sizes" className="pt-4">
                  <p className="text-base font-bold leading-5 text-[#2D3435]">
                    {sizeLabel}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {sizeOptions.map((size) => {
                      const selected = selectedSize === size;
                      const sizeData = sizesData.find((s) => s.size.trim() === size);
                      const sizePrice = sizeData?.price;

                      return (
                        <button
                          key={size}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => {
                            setSelectedSize(size);
                            setSelectedSizePrice(sizePrice ?? 0);
                          }}
                          className="flex h-9 items-center justify-center rounded-lg px-5 text-sm leading-5 transition"
                          style={{
                            backgroundColor: selected ? "#FFFFFF" : "#F2F4F4",
                            color: "#2D3435",
                            boxShadow: selected
                              ? `0 0 0 2px ${brandColor}`
                              : "none",
                            fontWeight: selected ? 700 : 400,
                          }}
                        >
                          {size}
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {availableCustomizationOptions.length > 0 && (
                <section className="pt-8">
                  <div className="space-y-6">
                    <div>
                      <p className="text-sm font-normal leading-5 text-[#5A6061]">
                        {businessType === "handicrafts"
                          ? "Personalization Add-ons"
                          : "Customization Add-ons"}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-3">
                        {availableCustomizationOptions.map((option) => {
                          const selected = selectedAddOns.includes(option.value);

                          return (
                            <button
                              key={option.value}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => handleCustomizationToggle(option.value)}
                              className={`rounded-lg border px-5 py-2 text-sm leading-5 transition ${
                                selected
                                  ? "border-[#2d3435] bg-white font-bold text-[#2d3435]"
                                  : "border-[#F2F4F4] bg-[#F2F4F4] text-[#2d3435]"
                              }`}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {hasTextCustomization && (
                      <label className="block">
                        <span className="block pl-1 text-sm font-normal leading-5 text-[#5A6061]">
                          {getCustomizationTextFieldLabel(businessType, selectedAddOns)}
                        </span>
                        <textarea
                          value={customText}
                          onChange={(event) => setCustomText(event.target.value)}
                          rows={4}
                          className="mt-2 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-base leading-6 text-[#2d3435] outline-none transition focus:border-[#032339]"
                          placeholder={getCustomizationTextPlaceholder(businessType)}
                        />
                      </label>
                    )}

                    {hasImageCustomization && (
                      <div>
                        <p className="pl-1 text-sm font-normal leading-5 text-[#5A6061]">
                          {getCustomizationImageFieldLabel(businessType, selectedAddOns)}
                        </p>
                        <div className="mt-2 rounded-xl border-2 border-dashed border-[#032339] bg-[rgba(3,35,57,0.05)] px-6 py-10 text-center">
                          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(3,35,57,0.2)] text-[#032339]">
                            <Upload className="h-6 w-6" />
                          </div>
                          <p className="mt-4 text-base font-bold leading-5 text-[#0F172A]">
                            Upload Image
                          </p>
                          <p className="mt-1 text-xs leading-[18px] text-[#64748B]">
                            Image up to 10MB (compressed to WebP)
                          </p>
                          <label className="mt-5 inline-flex cursor-pointer items-center justify-center rounded-lg border border-[#E2E8F0] bg-white px-5 py-2 text-sm font-semibold text-[#0F172A] shadow-sm">
                            {isUploadingImage ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Uploading...
                              </>
                            ) : (
                              "Choose File"
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              className="sr-only"
                              onChange={(event) => void handleReferenceImageChange(event)}
                              disabled={isUploadingImage}
                            />
                          </label>
                          {uploadedImageName && (
                            <div className="mt-4 rounded-lg bg-white/80 px-4 py-3 text-left">
                              <p className="text-sm font-semibold text-[#2d3435]">
                                {uploadedImageName}
                              </p>
                              {uploadedImageUrl && (
                                <a
                                  href={uploadedImageUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-1 block break-all text-xs text-[#056664] underline"
                                >
                                  {uploadedImageUrl}
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {productInfoRows.length > 0 && (
                <section className="pt-8">
                  <div className="rounded-3xl bg-[#F2F4F4] px-6 py-5">
                    <h3 className="text-base font-semibold leading-6 text-[#2D3435]">
                      Product Details
                    </h3>
                    <dl className="mt-4 space-y-3">
                      {productInfoRows.map((row) => (
                        <div
                          key={row.label}
                          className="flex items-start justify-between gap-4 border-b border-black/5 pb-3 last:border-b-0 last:pb-0"
                        >
                          <dt className="text-sm font-medium leading-5 text-[#5A6061]">
                            {row.label}
                          </dt>
                          <dd className="max-w-[60%] text-right text-sm font-semibold leading-5 text-[#2D3435]">
                            {row.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </section>
              )}

              <section className="border-t" style={{ borderColor: "#EBEEEF" }}>
                <div
                  className=""
                >
                  <button
                    type="button"
                    aria-expanded={isAboutProductOpen}
                    onClick={() => setIsAboutProductOpen((open) => !open)}
                    className="flex w-full items-center justify-between py-5 text-left"
                  >
                    <span
                      className="text-base font-bold leading-5"
                      style={{ color: "#2D3435" }}
                    >
                      About Product
                    </span>
                    <ChevronDown
                      className={`h-[7px] w-3 transition-transform ${
                        isAboutProductOpen ? "rotate-180" : ""
                      }`}
                      style={{ color: "#2D3435" }}
                      aria-hidden="true"
                    />
                  </button>
                  {isAboutProductOpen && (
                    <div className="pb-5">
                      <div className="h-px" style={{ backgroundColor: "#EBEEEF" }} />
                      <ul
                        className="space-y-2 pt-4 text-sm font-normal leading-[22.75px]"
                        style={{ color: "#5A6061" }}
                      >
                        {(aboutProductItems.length > 0
                          ? aboutProductItems
                          : ["Product details will be confirmed on WhatsApp."]
                        ).map((item: string) => (
                          <li key={item} className="flex gap-2">
                            <span className="inline-block w-[5px]" aria-hidden="true">&bull;</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </section>

              {product.returnPolicy && (
                <section
                  aria-label="Return Policy"
                  className="mt-2 overflow-hidden rounded-3xl bg-[#F2F4F4]"
                >
                  <button
                    type="button"
                    aria-expanded={isReturnPolicyOpen}
                    onClick={() => setIsReturnPolicyOpen((open) => !open)}
                    className="flex w-full items-center justify-between px-6 py-4 text-left"
                  >
                    <span className="text-base font-semibold leading-6 text-[#2D3435]">
                      Return Policy
                    </span>
                    <ChevronDown
                      className={`h-[7px] w-3 text-[#2D3435] transition-transform ${
                        isReturnPolicyOpen ? "rotate-180" : ""
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                  {isReturnPolicyOpen && (
                    <div className="px-6 pb-5">
                      <div className="h-px bg-[#E4E9EA]" />
                      <ul className="space-y-2 pt-4 text-sm font-normal leading-[22.75px] text-[#5A6061]">
                        {returnPolicyItems.map((item) => (
                          <li key={item} className="flex gap-2">
                            <span className="inline-block w-[5px] shrink-0" aria-hidden="true">&bull;</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              )}

              {/* Desktop Add to Cart */}
              <div className="hidden pt-8 lg:block">
                {currentCartItem ? (
                  <div
                    className="flex w-full items-center overflow-hidden rounded-xl text-base font-bold leading-6"
                    style={{ backgroundColor: brandColor, color: storefrontTheme.ctaText }}
                  >
                    <div className="flex flex-1 items-center justify-between px-4 py-3">
                      <button
                        onClick={() => updateQuantity(currentCartItem.cartItemId, currentCartItem.quantity - 1)}
                        disabled={currentCartItem.quantity <= 1}
                        className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-5 w-5" />
                      </button>
                      <span className="text-lg font-bold">{currentCartItem.quantity}</span>
                      <button
                        onClick={() => updateQuantity(currentCartItem.cartItemId, currentCartItem.quantity + 1)}
                        className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-white/20"
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                    </div>
                    <button
                      onClick={() => navigate(storefrontPath(slug!, "cart"))}
                      className="flex h-full flex-1 items-center justify-center gap-2 bg-white/15 py-4 transition-colors hover:bg-white/25"
                    >
                      <ShoppingCart className="h-5 w-5" />
                      Go to Cart
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleAddToCart}
                    disabled={!product.inStock}
                    className="flex w-full items-center justify-center gap-3 rounded-xl px-10 py-4 text-base font-bold leading-6 disabled:opacity-50"
                    style={{
                      backgroundColor: brandColor,
                      color: storefrontTheme.ctaText,
                    }}
                  >
                    <ShoppingCart className="w-5 h-5" />
                    Add to Cart
                  </button>
                )}
              </div>
            </div>
          </div>

        <ProductReviewsSection productId={product._id} />

        {/* Similar Products */}
        {relatedProducts && relatedProducts.length > 0 && (
          <section
            aria-label="Similar products"
            className="px-6 pt-12 lg:px-12"
          >
            <h3 className="text-xl font-semibold leading-7 text-[#2D3435]">
              Similar Products
            </h3>
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {relatedProducts.map((relatedProduct) => (
                <Link
                  key={relatedProduct._id}
                  to={storefrontPath(business.slug, `products/${productSlug(relatedProduct.name, relatedProduct._id, relatedProduct.slug)}`)}
                  className="overflow-hidden rounded-[8px] bg-white shadow-[0_16px_40px_rgba(14,23,38,0.08)] transition hover:-translate-y-1"
                >
                  <div className="aspect-[4/5] bg-[#F2F4F4]">
                    {relatedProduct.imageUrls[0] ? (
                      <img
                        src={relatedProduct.imageUrls[0]}
                        alt={relatedProduct.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Package className="h-10 w-10 text-[#9AA4A6]" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 px-4 py-4">
                    <p className="line-clamp-1 text-base font-semibold leading-6 text-[#2D3435]">
                      {relatedProduct.name}
                    </p>
                    <p
                      className="text-lg font-semibold leading-7"
                      style={{
                        color: priceTextColor,
                        width: "fit-content",
                      }}
                    >
                      ₹{relatedProduct.price.toFixed(0)}
                    </p>
                    <p className="line-clamp-1 text-sm leading-5" style={{ color: "#5A6061" }}>
                      {relatedProduct.category?.name ?? "More from this store"}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

      </main>
        {business && (
          <StorefrontFooter
            business={business}
            storefrontTheme={storefrontTheme}
          />
        )}

      {/* Sticky Footer Actions (mobile only) */}
      <footer
        className="fixed bottom-0 left-0 right-0 z-[40] flex justify-center border-t p-4 backdrop-blur-xl lg:hidden"
        style={{
          backgroundColor: "#FFFFFFcc",
          borderColor: "#E4E9EA",
        }}
      >
        {currentCartItem ? (
          <div
            className="flex w-full max-w-[362px] items-center overflow-hidden rounded-xl text-lg font-bold"
            style={{ backgroundColor: brandColor, color: storefrontTheme.ctaText }}
          >
            <div className="flex flex-1 items-center justify-between px-4 py-3">
              <button
                onClick={() => updateQuantity(currentCartItem.cartItemId, currentCartItem.quantity - 1)}
                disabled={currentCartItem.quantity <= 1}
                className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Decrease quantity"
              >
                <Minus className="h-5 w-5" />
              </button>
              <span className="text-lg font-bold">{currentCartItem.quantity}</span>
              <button
                onClick={() => updateQuantity(currentCartItem.cartItemId, currentCartItem.quantity + 1)}
                className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-white/20"
                aria-label="Increase quantity"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
            <button
              onClick={() => navigate(storefrontPath(slug!, "cart"))}
              className="flex h-full flex-1 items-center justify-center gap-2 bg-white/15 py-4 transition-colors hover:bg-white/25"
            >
              <ShoppingCart className="h-auto w-6" />
              Go to Cart
            </button>
          </div>
        ) : (
          <button
            onClick={handleAddToCart}
            disabled={!product.inStock}
            className="flex w-full max-w-[362px] items-center justify-center gap-2 rounded-xl py-4 text-lg font-bold disabled:opacity-50"
            style={{
              backgroundColor: brandColor,
              color: storefrontTheme.ctaText,
            }}
          >
            <ShoppingCart className="w-5 h-5" />
            Add to Cart
          </button>
        )}
      </footer>

      {shareOpen && (
        <ShareSheet
          isOpen={shareOpen}
          onClose={() => setShareOpen(false)}
          url={business && product ? storefrontUrl(business.slug, `products/${productSlug(product.name, product._id, product.slug)}`) : ""}
          title={product?.name}
          shareText={`Check out ${product?.name}`}
          productId={product?._id}
          businessId={business?._id}
        />
      )}
    </div>
  );
}

export function getReturnPolicyItems(
  policy: {
    returnable: boolean;
    returnWindowDays?: number;
    acceptedConditions: string[];
  },
): string[] {
  if (!policy.returnable) {
    return ["This product is not returnable."];
  }

  const items = ["Returnable"];
  if (policy.returnWindowDays) {
    items.push(`Request a return within ${policy.returnWindowDays} days after delivery.`);
  }

  const conditions = new Set(policy.acceptedConditions);
  if (conditions.has("unused") && conditions.has("original_packaging")) {
    items.push("Item should be unused and returned in its original packaging.");
    conditions.delete("unused");
    conditions.delete("original_packaging");
  }

  const conditionCopy: Record<string, string> = {
    unused: "Item should be unused.",
    original_packaging: "Item should be returned in its original packaging.",
    damaged: "Returns are accepted if the item arrives damaged.",
    wrong_item: "Returns are accepted if you receive the wrong item.",
    other: "Other return reasons can be discussed with the seller.",
  };
  conditions.forEach((condition) => {
    const copy = conditionCopy[condition];
    if (copy) items.push(copy);
  });

  return items;
}

function getProductInfoRows(
  businessType: BusinessType,
  details?: ProductTypeDetails,
) {
  if (!details) {
    return [];
  }

  const rows: Array<{ label: string; value: string }> = [];

  if (businessType === "home_bakery") {
    if (details.dietaryClassification) {
      rows.push({
        label: "Dietary",
        value: formatDietaryClassification(details.dietaryClassification),
      });
    }

    if (details.sizeFormat) {
      rows.push({
        label: "Serving Format",
        value: formatBakerySizeFormat(details.sizeFormat),
      });
    }

    if (details.customizationEnabled) {
      rows.push({
        label: "Customization",
        value: formatCustomizationOptions(businessType, details.customizationOptions),
      });
    }

    return rows;
  }

  if (details.audience) {
    rows.push({
      label: businessType === "garments" ? "Gender" : "Audience",
      value: formatAudience(details.audience),
    });
  }

  if (businessType === "garments" && details.sizeFormat) {
    rows.push({
      label: "Size Format",
      value: formatGarmentSizeFormat(details.sizeFormat),
    });
  }

  if (businessType === "handicrafts" && details.customizationEnabled) {
    rows.push({
      label: "Personalization",
      value: formatCustomizationOptions(businessType, details.customizationOptions),
    });
  }

  return rows;
}

function formatAudience(audience: string) {
  return audience.charAt(0).toUpperCase() + audience.slice(1);
}

function formatDietaryClassification(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatGarmentSizeFormat(value: string) {
  return value === "numeric" ? "Numeric" : "Alpha";
}

function formatBakerySizeFormat(value: string) {
  return value === "quantity" ? "Quantity (per piece)" : "Weight (gm/kg)";
}

function formatCustomizationOptions(
  businessType: BusinessType,
  options?: ProductCustomizationOption[],
) {
  if (!options?.length) {
    return "Available";
  }

  return options
    .map((option) => getCustomizationOptionLabel(businessType, option))
    .join(", ");
}
