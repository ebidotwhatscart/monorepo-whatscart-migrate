import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useFirebaseQuery as useQuery } from "../lib/firebase/hooks";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  SlidersHorizontal,
  Sparkles,
  Store,
  X,
} from "lucide-react";
import { api, type Id } from "../lib/firebase/operations";
import type { BusinessType, ProductTypeDetails, StoredBusinessType } from "../types/product";
import { getStorefrontCopy, getProductMetaChips } from "./products/storefrontVariants";
import { normalizeBusinessType } from "../types/product";
import { useCart } from "../context/CartContext";
import { useAnalytics } from "../hooks/useAnalytics";
import { createStorefrontTheme, isDark, type StorefrontTheme } from "../lib/storefrontTheme";
import {
  countActiveStorefrontFilters,
  filterAndSortStorefrontProducts,
  getStorefrontPriceBounds,
  type StorefrontAppliedFilters,
} from "../lib/storefrontFilters";
import { StorefrontFooter } from "./StorefrontFooter";
import { StorefrontFilterModal } from "./StorefrontFilterModal";
import { StorefrontHeader } from "./StorefrontHeader";
import { StorefrontNotFound } from "./StorefrontNotFound";
import storefrontWebFilterUrl from "../assets/figma/storefront-web-filter.svg";
import storefrontWebSortUrl from "../assets/figma/storefront-web-sort.svg";
import whatscartPoweredLogoUrl from "../assets/figma/whatscart-powered-logo.svg";
import whatsappLogoUrl from "../assets/figma/whatsapp-logo.svg";
import { getTenantSlug, productSlug, storefrontPath } from "../lib/urls";
import { useRuntimeHostname } from "../context/RuntimeLocationContext";
import { staticAssetUrl } from "../lib/staticAsset";

type PublicProduct = {
  _id: Id<"products">;
  businessId: Id<"businesses">;
  categoryId?: Id<"categories">;
  name: string;
  slug?: string;
  description?: string;
  price: number;
  inStock: boolean;
  imageUrls?: (string | null)[];
  productTypeDetails?: ProductTypeDetails;
};

type PublicCategory = {
  _id: Id<"categories">;
  name: string;
};

const STORE_TEAL = "#046664";

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);
}

function productImage(product: PublicProduct | null | undefined) {
  return product?.imageUrls?.find(Boolean) ?? null;
}


export function Storefront() {
  const { slug: routeSlug } = useParams<{ slug: string }>();
  const runtimeHostname = useRuntimeHostname();
  const slug = routeSlug ?? getTenantSlug(runtimeHostname);
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [activeFeaturedIndex, setActiveFeaturedIndex] = useState(0);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] =
    useState<StorefrontAppliedFilters>({});
  const closeFilterModal = useCallback(() => setIsFilterModalOpen(false), []);
  const applyFilters = useCallback(
    (
      nextFilters: StorefrontAppliedFilters,
      nextSortDirection: "asc" | "desc",
    ) => {
      setAppliedFilters(nextFilters);
      setSortDirection(nextSortDirection);
      setIsFilterModalOpen(false);
    },
    [],
  );

  const business = useQuery(
    api.businesses.getBusinessBySlug,
    slug ? { slug } : "skip",
  );
  const products = useQuery(
    api.products.getPublicProducts,
    business ? { businessId: business._id } : "skip",
  ) as PublicProduct[] | undefined;
  const categories = useQuery(
    api.categories.getPublicCategories,
    business ? { businessId: business._id } : "skip",
  ) as PublicCategory[] | undefined;

  const handleCategorySelect = useCallback((categoryId: string) => {
    setSelectedCategory(categoryId);
    const cat = categories?.find((c) => c._id === categoryId);
    const hash = categoryId === "all" ? "" : (cat?.name ?? categoryId);
    window.location.hash = hash;
    setTimeout(() => {
      const target = window.innerWidth >= 1024
        ? document.querySelector('[aria-label="Desktop collection categories"]')
        : document.getElementById("category-pills");
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }, [categories]);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (hash && categories) {
      const match = categories.find((c) => c.name === hash);
      if (match) setSelectedCategory(match._id);
    }
  }, [categories]);

  const searchedProducts = useQuery(
    api.products.searchProducts,
    business && searchQuery.trim()
      ? { businessId: business._id, searchTerm: searchQuery.trim() }
      : "skip",
  ) as PublicProduct[] | undefined;

  const { getTotalItems, updateBusinessId } = useCart();
  const { trackPage } = useAnalytics(business?._id ?? "");

  const themeColor = business?.themeColor || STORE_TEAL;
  const storefrontTheme = createStorefrontTheme({
    themeColor,
    brandPalette: business?.brandPalette,
  });
  const businessType: BusinessType = normalizeBusinessType(
    (business?.businessType as StoredBusinessType | undefined) ?? "garments",
  );
  const storefrontCopy = getStorefrontCopy(businessType);

  useEffect(() => {
    if (!business) return;
    updateBusinessId(business._id);
  }, [business, updateBusinessId]);

  useEffect(() => {
    if (!business) return;
    trackPage(`/store/${business.slug}`);
  }, [business, trackPage]);

  const priceBounds = useMemo(
    () => getStorefrontPriceBounds(products ?? []),
    [products],
  );
  const activeFilterCount = countActiveStorefrontFilters(appliedFilters);

  const displayedProducts = useMemo(() => {
    const sourceProducts = searchQuery.trim() ? searchedProducts : products;
    const categoryFiltered =
      selectedCategory === "all" || searchQuery.trim()
        ? (sourceProducts ?? [])
        : (sourceProducts ?? []).filter(
            (product) => product.categoryId === selectedCategory,
          );

    return filterAndSortStorefrontProducts(
      categoryFiltered,
      appliedFilters,
      sortDirection,
    );
  }, [
    appliedFilters,
    products,
    searchQuery,
    searchedProducts,
    selectedCategory,
    sortDirection,
  ]);

  const featuredProductIds = business?.featuredProductIds as string[] | undefined;
  const featuredProductsFromQuery = useQuery(
    api.businesses.getFeaturedProducts,
    featuredProductIds && featuredProductIds.length > 0
      ? { businessId: business!._id }
      : "skip",
  );
  const featuredProducts = useMemo(() => {
    if (featuredProductsFromQuery && featuredProductsFromQuery.length > 0) {
      return featuredProductsFromQuery;
    }
    const inStockProducts = (products ?? []).filter(
      (product) => product.inStock,
    );
    return inStockProducts.length > 0 ? inStockProducts : (products ?? []);
  }, [featuredProductsFromQuery, products]);
  const isLoading =
    business === undefined ||
    (business !== null &&
      (products === undefined || categories === undefined));

  useEffect(() => {
    if (activeFeaturedIndex >= featuredProducts.length) {
      setActiveFeaturedIndex(0);
    }
  }, [activeFeaturedIndex, featuredProducts.length]);

  if (!slug) {
    return <StorefrontNotFound />;
  }

  if (isLoading) {
    return <StorefrontSkeleton />;
  }

  if (!business) {
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
      <StorefrontHeader
        business={business}
        storefrontTheme={storefrontTheme}
        categories={categories ?? []}
        getTotalItems={getTotalItems}
        selectedCategory={selectedCategory}
        onSelectCategory={handleCategorySelect}
        slug={slug!}
        onCartClick={() => navigate(storefrontPath(slug!, "cart", runtimeHostname))}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <main className="mx-auto max-w-md px-4 pb-20 pt-[148px] lg:max-w-none lg:px-0 lg:pt-12">
        <label className="relative block lg:hidden">
          <Search
            className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#878787]"
            aria-hidden="true"
          />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search"
            className="h-[54px] w-full rounded-md border-0 pl-14 pr-12 text-base outline-none ring-1 ring-transparent transition placeholder:text-[#878787]"
            style={{
              backgroundColor: storefrontTheme.surfaceMuted,
              color: storefrontTheme.textPrimary,
              boxShadow: `0 0 0 0 ${storefrontTheme.accent}`,
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-black/10 transition"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" style={{ color: storefrontTheme.textSecondary }} />
            </button>
          )}
        </label>

        {featuredProducts.length > 0 && !searchQuery.trim() && (
          <section
            className="mt-5 lg:mx-auto lg:mt-0 lg:max-w-[1184px]"
            aria-label="Featured products"
          >
            <FeaturedProductCarousel
              products={featuredProducts}
              activeIndex={activeFeaturedIndex}
              onSelect={setActiveFeaturedIndex}
              businessSlug={business.slug}
              storefrontTheme={storefrontTheme}
            />
          </section>
        )}

        <section id="category-pills" className="mt-7 scroll-mt-[100px] lg:hidden">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[20px] font-semibold text-[#1b1b1b]">
              Categories
            </h2>
          </div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            <CategoryChip
              label="All"
              selected={selectedCategory === "all"}
              onClick={() => setSelectedCategory("all")}
              storefrontTheme={storefrontTheme}
            />
            {(categories ?? []).map((category) => (
              <CategoryChip
                key={category._id}
                label={category.name}
                selected={selectedCategory === category._id}
                onClick={() => setSelectedCategory(category._id)}
                storefrontTheme={storefrontTheme}
              />
            ))}
          </div>
        </section>

        <DesktopCollectionNav
          categories={categories ?? []}
          selectedCategory={selectedCategory}
          onSelectCategory={handleCategorySelect}
          storefrontTheme={storefrontTheme}
        />

        <div
          className="mt-5 flex h-12 items-center rounded-full px-2 text-sm font-medium lg:hidden"
          style={{
            backgroundColor: storefrontTheme.background,
            color: storefrontTheme.textPrimary,
          }}
        >
          <button
            type="button"
            onClick={() => setIsFilterModalOpen(true)}
            aria-haspopup="dialog"
            className="flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2"
          >
            <Filter className="h-4 w-4" aria-hidden="true" />
            Filter
            {activeFilterCount > 0 && (
              <span
                className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold"
                style={{
                  backgroundColor: storefrontTheme.accent,
                  color: storefrontTheme.ctaText,
                }}
              >
                {activeFilterCount}
              </span>
            )}
          </button>
          <div className="h-6 w-px bg-[#d0d0d0]" aria-hidden="true" />
          <button
            type="button"
            onClick={() => setIsFilterModalOpen(true)}
            aria-haspopup="dialog"
            className="flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            Price: {sortDirection === "asc" ? "Low to High" : "High to Low"}
          </button>
        </div>

        <div
          aria-label="Desktop product filters"
        className="mx-auto mt-6 hidden h-[52px] max-w-[1184px] items-center justify-between rounded-xl px-4 text-sm font-semibold lg:flex"
        style={{
          backgroundColor: storefrontTheme.background,
          color: storefrontTheme.textPrimary,
        }}
      >
          <button
            type="button"
            onClick={() => setIsFilterModalOpen(true)}
            aria-haspopup="dialog"
            className="flex items-center gap-2"
          >
            <img
              src={staticAssetUrl(storefrontWebFilterUrl)}
              alt=""
              className="h-3 w-[18px]"
              aria-hidden="true"
            />
            Filter
            {activeFilterCount > 0 && (
              <span
                className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold"
                style={{
                  backgroundColor: storefrontTheme.accent,
                  color: storefrontTheme.ctaText,
                }}
              >
                {activeFilterCount}
              </span>
            )}
          </button>
          <div className="h-4 w-px bg-[rgba(173,179,180,0.3)]" />
          <button
            type="button"
            aria-label={`Desktop sort products by price ${
              sortDirection === "asc" ? "low to high" : "high to low"
            }`}
            onClick={() => setIsFilterModalOpen(true)}
            aria-haspopup="dialog"
            className="flex items-center gap-2"
          >
            Price: {sortDirection === "asc" ? "Low to High" : "High to Low"}
            <img
              src={staticAssetUrl(storefrontWebSortUrl)}
              alt=""
              className="h-1 w-[7px]"
              aria-hidden="true"
            />
          </button>
        </div>

        <section
          id="category-products"
          aria-label="Products"
          className="mx-auto mt-5 grid grid-cols-2 gap-x-4 gap-y-2 scroll-mt-[100px] lg:max-w-[1184px] lg:grid-cols-4 lg:gap-x-6 lg:gap-y-8"
        >
          {displayedProducts.map((product) => (
            <Link
              key={product._id}
              to={storefrontPath(business!.slug, `products/${productSlug(product.name, product._id, product.slug)}`, runtimeHostname)}
              className="[grid-template-rows:subgrid] row-span-4 min-w-0 rounded-[12px] p-2 transition-transform duration-200 hover:-translate-y-1"
            >
              <ProductTile
                product={product}
                businessType={businessType}
                storefrontTheme={storefrontTheme}
              />
            </Link>
          ))}
        </section>

        {displayedProducts.length === 0 && (
          <div
            className="mt-12 rounded-2xl p-6 text-center text-sm"
            style={{
              backgroundColor: storefrontTheme.surface,
              color: storefrontTheme.textSecondary,
            }}
          >
            No products found.
          </div>
        )}

        <section
          aria-label={storefrontCopy.directConnectionTitle}
          className="mt-8 flex flex-col items-center rounded-[20px] px-6 py-10 text-center"
          style={{
            background: `linear-gradient(135deg, ${storefrontTheme.supportSoft} 0%, ${storefrontTheme.surface} 100%)`,
          }}
        >
          <img src={staticAssetUrl(whatsappLogoUrl)} alt="" className="h-8 w-[33px]" />
          <h2
            className="mt-3 text-[18px] font-bold leading-7"
            style={{ color: storefrontTheme.textPrimary }}
          >
            {storefrontCopy.directConnectionTitle}
          </h2>
          <p
            className="mt-2 max-w-[310px] text-[14px] leading-5"
            style={{ color: storefrontTheme.textSecondary }}
          >
            {storefrontCopy.directConnectionBody}
          </p>
        </section>
      </main>

      <div className="fixed left-[-21px] bottom-0 scale-[0.8] z-50">
        <PoweredByWhatsCartPill />
      </div>

      <StorefrontFooter
        business={business}
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={handleCategorySelect}
        storefrontTheme={storefrontTheme}
      />

      <StorefrontFilterModal
        isOpen={isFilterModalOpen}
        priceBounds={priceBounds}
        filters={appliedFilters}
        sortDirection={sortDirection}
        storefrontTheme={storefrontTheme}
        onClose={closeFilterModal}
        onApply={applyFilters}
      />
    </div>
  );
}

function PoweredByWhatsCartPill() {
  return (
    <a href="https://whatscart.in/" className="relative block h-14 w-[253px] overflow-hidden rounded-[10px] bg-black">
      <div className="absolute -left-1 -top-8 h-32 w-32 rounded-full bg-[#033500] blur-[31px]" />
      <div className="relative flex h-full items-center gap-3 px-5 text-base font-medium text-[#fafafa]">
        <span>Powered by</span>
        <span className="flex items-center gap-2">
          <img
            src={staticAssetUrl(whatscartPoweredLogoUrl)}
            alt="Whatscart logo"
            className="h-7 w-[22px]"
          />
          Whatscart
        </span>
      </div>
    </a>
  );
}

function DesktopCollectionNav({
  categories,
  selectedCategory,
  onSelectCategory,
  storefrontTheme,
}: {
  categories: PublicCategory[];
  selectedCategory: string;
  onSelectCategory: (categoryId: string) => void;
  storefrontTheme: StorefrontTheme;
}) {
  return (
    <nav
      aria-label="Desktop collection categories"
      className="mt-10 hidden border-y border-[rgba(228,189,194,0.1)] py-6 lg:block"
    >
      <div className="mx-auto flex max-w-[1184px] items-stretch justify-center gap-12">
        <DesktopCollectionButton
          label="All Collections"
          selected={selectedCategory === "all"}
          onClick={() => onSelectCategory("all")}
          storefrontTheme={storefrontTheme}
        />
        {categories.map((category) => (
          <DesktopCollectionButton
            key={category._id}
            label={category.name}
            selected={selectedCategory === category._id}
            onClick={() => onSelectCategory(category._id)}
            storefrontTheme={storefrontTheme}
          />
        ))}
      </div>
    </nav>
  );
}

function DesktopCollectionButton({
  label,
  selected,
  onClick,
  storefrontTheme,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  storefrontTheme: StorefrontTheme;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={selected ? "page" : undefined}
      className="border-b-2 pb-1 text-base font-semibold tracking-normal transition"
      style={{
        borderColor: selected ? storefrontTheme.support : "transparent",
        color: selected
          ? storefrontTheme.textPrimary
          : storefrontTheme.textSecondary,
      }}
    >
      {label}
    </button>
  );
}

function FeaturedProductCarousel({
  products,
  activeIndex,
  onSelect,
  businessSlug,
  storefrontTheme,
}: {
  products: PublicProduct[];
  activeIndex: number;
  onSelect: (index: number) => void;
  businessSlug: string;
  storefrontTheme: StorefrontTheme;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const touchRef = useRef({ startX: 0, currentX: 0, isDragging: false });
  const [isCarouselReady, setIsCarouselReady] = useState(false);

  useEffect(() => {
    const revealCarousel = () => setIsCarouselReady(true);
    // Keep the hero lightweight until first paint, but expose its interaction
    // as soon as the visitor signals intent. The timeout covers passive reads.
    const timeout = window.setTimeout(revealCarousel, 1_000);
    const events: (keyof WindowEventMap)[] = [
      "pointerdown",
      "touchstart",
      "scroll",
      "keydown",
    ];
    const options: AddEventListenerOptions = { passive: true };
    events.forEach((event) => window.addEventListener(event, revealCarousel, options));

    return () => {
      window.clearTimeout(timeout);
      events.forEach((event) =>
        window.removeEventListener(event, revealCarousel, options),
      );
    };
  }, []);

  const goNext = () => onSelect((activeIndex + 1) % products.length);
  const goPrev = () => onSelect((activeIndex - 1 + products.length) % products.length);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchRef.current.startX = e.touches[0].clientX;
    touchRef.current.isDragging = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchRef.current.isDragging) return;
    touchRef.current.currentX = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchRef.current.isDragging) return;
    touchRef.current.isDragging = false;
    const diff = touchRef.current.startX - touchRef.current.currentX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goNext();
      else goPrev();
    }
  };

  if (products.length === 0) return null;
  const visibleProducts = isCarouselReady ? products : products.slice(0, 1);

  return (
    <div>
      <div className="relative">
        <div
          ref={containerRef}
          className="overflow-hidden rounded-[20px]"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className="flex transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${activeIndex * 100}%)` }}
          >
            {visibleProducts.map((product, index) => (
              <div
                key={product._id}
                role="group"
                aria-label={`Featured product ${index + 1} of ${products.length}`}
                className="w-full shrink-0"
              >
                <div
                  aria-hidden={index !== activeIndex}
                  inert={index !== activeIndex}
                >
                  <FeaturedProductCard
                    product={product}
                    businessSlug={businessSlug}
                    storefrontTheme={storefrontTheme}
                    headingLevel={index === activeIndex ? 1 : 2}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {isCarouselReady && products.length > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous featured product"
              className="absolute left-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 shadow-md hover:bg-white transition z-10 max-lg:hidden"
            >
              <ChevronLeft className="h-5 w-5 text-slate-700" />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next featured product"
              className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 shadow-md hover:bg-white transition z-10 max-lg:hidden"
            >
              <ChevronRight className="h-5 w-5 text-slate-700" />
            </button>
          </>
        )}
      </div>

      <div
        style={{
          minHeight: products.length > 1 ? 52 : 0,
          overflow: "hidden",
        }}
      >
        {isCarouselReady && products.length > 1 && (
          <div
            className="mt-4 flex items-center justify-between lg:justify-center lg:gap-2"
            aria-label="Featured product slides"
          >
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous featured product"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 shadow-md hover:bg-white transition lg:hidden"
          >
            <ChevronLeft className="h-5 w-5 text-slate-700" />
          </button>
          <div className="flex gap-2">
            {products.map((product, index) => (
              <button
                key={product._id}
                type="button"
                onClick={() => onSelect(index)}
                className="h-[13px] w-[13px] rounded-full transition"
                style={{
                  width: 24,
                  height: 24,
                  backgroundColor: "transparent",
                }}
                aria-label={`Show featured product ${index + 1}`}
                aria-current={index === activeIndex ? "true" : undefined}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: "block",
                    width: 8,
                    height: 8,
                    borderRadius: "9999px",
                    transition: "background-color 150ms ease",
                    backgroundColor:
                      index === activeIndex
                        ? storefrontTheme.support
                        : storefrontTheme.supportSoft,
                  }}
                />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={goNext}
            aria-label="Next featured product"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 shadow-md hover:bg-white transition lg:hidden"
          >
            <ChevronRight className="h-5 w-5 text-slate-700" />
          </button>
          </div>
        )}
      </div>
    </div>
  );
}

function FeaturedProductCard({
  product,
  businessSlug,
  storefrontTheme,
  headingLevel,
}: {
  product: PublicProduct;
  businessSlug: string;
  storefrontTheme: StorefrontTheme;
  headingLevel: 1 | 2;
}) {
  const imageUrl = productImage(product);
  const HeadingTag = headingLevel === 1 ? "h1" : "h2";
  const { addItem } = useCart();
  const navigate = useNavigate();
  const runtimeHostname = useRuntimeHostname();
  const productPath = storefrontPath(
    businessSlug,
    `products/${productSlug(product.name, product._id, product.slug)}`,
    runtimeHostname,
  );

  const handleOrderNow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem({
      productId: product._id,
      name: product.name,
      price: product.price,
      image: product.imageUrls?.[0] ?? undefined,
    });
    navigate(`/checkout?source=cart&slug=${businessSlug}`);
  };

  return (
    <div
      className="relative block h-[448px] overflow-hidden rounded-[20px] lg:grid lg:h-[600px] lg:grid-cols-[567px_1fr] lg:items-center lg:gap-12 lg:overflow-visible lg:rounded-none lg:bg-transparent"
      style={{
        background: `linear-gradient(135deg, ${storefrontTheme.supportSoft} 0%, ${storefrontTheme.surface} 100%)`,
      }}
    >
      <Link
        to={productPath}
        aria-label={`View ${product.name}`}
        className="absolute inset-0 block lg:static lg:h-[600px] lg:overflow-hidden lg:rounded-xl"
        style={{ backgroundColor: storefrontTheme.surfaceStrong }}
      >
        {imageUrl ? (
          <span
            aria-hidden="true"
            className="h-full w-full object-cover"
            style={{
              position: "relative",
              display: "block",
              height: "100%",
              width: "100%",
            }}
          >
            {headingLevel === 1 && (
              <img
                src={imageUrl}
                alt=""
                fetchPriority="high"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
          </span>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#777]">
            <Store className="h-12 w-12" aria-hidden="true" />
          </div>
        )}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 lg:hidden"
          style={{ background: storefrontTheme.heroOverlay }}
        />
      </Link>
      {/* Mobile: product details overlay */}
      <div
        className="flex h-full flex-col justify-end gap-2 p-5 absolute inset-x-0 bottom-0 items-start text-white lg:hidden pointer-events-none"
      >
        <span
          className="inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em]"
          style={{
            backgroundColor: storefrontTheme.shippingBarBackground,
            color: storefrontTheme.shippingBarText,
          }}
        >
          New Arrival
        </span>
        <HeadingTag
          className="max-w-[280px] pt-[7px] text-[30px] font-bold leading-[37.5px] tracking-[-0.025em]"
        >
          {product.name}
        </HeadingTag>
        <p
          className="text-lg font-medium leading-7"
          style={{ color: "rgba(255,255,255,0.9)" }}
        >
          {formatPrice(product.price)}
        </p>
        {product.description && (
          <p
            className="line-clamp-2 max-w-[300px] pt-[14.75px] pb-6 text-sm font-normal leading-[22.75px]"
            style={{ color: "rgba(255,255,255,0.8)" }}
          >
            {product.description}
          </p>
        )}
        <button
          type="button"
          onClick={handleOrderNow}
          className="pointer-events-auto mt-2 inline-flex h-[52px] w-full cursor-pointer items-center justify-center rounded-xl px-8 text-base font-bold shadow-[0px_4px_6px_-4px_rgba(184,0,73,0.2),0px_10px_15px_-3px_rgba(184,0,73,0.2)]"
          style={{
            backgroundColor: storefrontTheme.ctaBackground,
            color: storefrontTheme.ctaText,
          }}
        >
          Order Now
        </button>
      </div>

      {/* Desktop: product details panel */}
      <div className="hidden flex-col justify-center gap-6 lg:flex">
        <Link
          to={productPath}
          className="flex flex-col items-start gap-6 rounded-xl transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D3435] focus-visible:ring-offset-4"
        >
          <span
            className="inline-flex w-fit rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em]"
            style={{
              backgroundColor: storefrontTheme.shippingBarBackground,
              color: storefrontTheme.shippingBarText,
            }}
          >
            New Arrival
          </span>
          <HeadingTag
            className="max-w-[520px] text-[60px] font-black leading-[60px] tracking-normal text-[#2D3435]"
          >
            {product.name}
          </HeadingTag>
          <p
            className="text-2xl font-medium leading-8"
            style={{ color: "rgba(45,52,53,0.9)" }}
          >
            {formatPrice(product.price)}
          </p>
          {product.description && (
            <p
              className="line-clamp-3 max-w-[520px] text-lg font-normal leading-[29.25px]"
              style={{ color: "rgba(45,52,53,0.8)" }}
            >
              {product.description}
            </p>
          )}
        </Link>
        <button
          type="button"
          onClick={handleOrderNow}
          className="inline-flex h-14 w-[260px] cursor-pointer items-center justify-center rounded-xl px-8 text-base font-bold shadow-black"
          style={{
            backgroundColor: storefrontTheme.ctaBackground,
            color: storefrontTheme.ctaText,
          }}
        >
          Order Now
        </button>
      </div>
    </div>
  );
}

function CategoryChip({
  label,
  selected,
  onClick,
  storefrontTheme,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  storefrontTheme: StorefrontTheme;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-10 shrink-0 rounded-full px-5 text-sm font-semibold transition"
      style={{
        backgroundColor: selected
          ? storefrontTheme.ctaBackground
          : storefrontTheme.surfaceMuted,
        color: selected
          ? storefrontTheme.ctaText
          : storefrontTheme.textSecondary,
      }}
    >
      {label}
    </button>
  );
}

function ProductTile({
  product,
  businessType,
  storefrontTheme,
}: {
  product: PublicProduct;
  businessType: BusinessType;
  storefrontTheme: StorefrontTheme;
}) {
  const imageUrl = productImage(product);
  const chips = getProductMetaChips(businessType, product.productTypeDetails);

  return (
    <>
      <div
        className="flex aspect-square items-center justify-center overflow-hidden rounded-[12px] lg:rounded-[12px]"
        style={{ backgroundColor: storefrontTheme.surfaceStrong }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
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
    </>
  );
}

function StorefrontSkeleton() {
  return (
    <div className="min-h-screen bg-[#f7f7f5]">
      <div
        data-testid="storefront-skeleton-mobile"
        className="mx-auto max-w-md animate-pulse px-4 pt-6 lg:hidden"
      >
        <div className="h-14 rounded-full bg-[#e8e8e8]" />
        <div className="mt-5 h-[448px] rounded-[20px] bg-[#dedede]" />
        <div className="mt-7 h-7 w-32 rounded bg-[#e8e8e8]" />
        <div className="mt-4 flex gap-2">
          <div className="h-10 w-20 rounded-full bg-[#e8e8e8]" />
          <div className="h-10 w-24 rounded-full bg-[#e8e8e8]" />
          <div className="h-10 w-24 rounded-full bg-[#e8e8e8]" />
        </div>
      </div>

      <div
        data-testid="storefront-skeleton-desktop"
        className="hidden animate-pulse lg:block"
      >
        <div className="border-b border-black/5 bg-white">
          <div className="mx-auto max-w-[1184px] px-6 py-5">
            <div className="grid grid-cols-[180px_1fr_320px] items-center gap-8">
              <div className="h-11 rounded-full bg-[#e8e8e8]" />
              <div className="mx-auto flex gap-8">
                <div className="h-6 w-14 rounded bg-[#ececec]" />
                <div className="h-6 w-16 rounded bg-[#ececec]" />
                <div className="h-6 w-16 rounded bg-[#ececec]" />
                <div className="h-6 w-16 rounded bg-[#ececec]" />
              </div>
              <div className="ml-auto flex items-center gap-4">
                <div className="h-12 w-[241px] rounded-2xl bg-[#ececec]" />
                <div className="h-12 w-14 rounded-2xl bg-[#ececec]" />
              </div>
            </div>
            <div className="mt-4 h-12 rounded-none bg-[#dedede]" />
          </div>
        </div>

        <div className="mx-auto max-w-[1184px] px-6 py-10">
          <div className="grid grid-cols-[1.15fr_0.85fr] gap-12">
            <div className="h-[520px] rounded-[24px] bg-[#dedede]" />
            <div className="flex flex-col justify-center">
              <div className="h-7 w-28 rounded-full bg-[#ececec]" />
              <div className="mt-6 h-20 w-72 rounded bg-[#e4e4e4]" />
              <div className="mt-5 h-8 w-32 rounded bg-[#ececec]" />
              <div className="mt-5 space-y-3">
                <div className="h-5 w-full rounded bg-[#ececec]" />
                <div className="h-5 w-[92%] rounded bg-[#ececec]" />
                <div className="h-5 w-[78%] rounded bg-[#ececec]" />
              </div>
              <div className="mt-8 h-14 w-52 rounded-xl bg-[#e0e0e0]" />
            </div>
          </div>

          <div className="mt-12 flex items-center justify-center gap-10 border-y border-[#eadde0] py-6">
            <div className="h-6 w-28 rounded bg-[#ececec]" />
            <div className="h-6 w-20 rounded bg-[#ececec]" />
            <div className="h-6 w-20 rounded bg-[#ececec]" />
            <div className="h-6 w-20 rounded bg-[#ececec]" />
          </div>

          <div className="mt-6 flex items-center justify-between rounded-xl bg-[#f1eeeb] px-4 py-4">
            <div className="h-5 w-20 rounded bg-[#e4e4e4]" />
            <div className="h-5 w-px bg-[#ddd7d1]" />
            <div className="h-5 w-36 rounded bg-[#e4e4e4]" />
          </div>

          <div className="mt-8 grid grid-cols-4 gap-6">
            <div className="space-y-4">
              <div className="h-[360px] rounded-[18px] bg-[#dedede]" />
              <div className="h-6 w-40 rounded bg-[#ececec]" />
              <div className="h-5 w-20 rounded bg-[#ececec]" />
            </div>
            <div className="space-y-4">
              <div className="h-[360px] rounded-[18px] bg-[#dedede]" />
              <div className="h-6 w-36 rounded bg-[#ececec]" />
              <div className="h-5 w-20 rounded bg-[#ececec]" />
            </div>
            <div className="space-y-4">
              <div className="h-[360px] rounded-[18px] bg-[#dedede]" />
              <div className="h-6 w-32 rounded bg-[#ececec]" />
              <div className="h-5 w-20 rounded bg-[#ececec]" />
            </div>
            <div className="space-y-4">
              <div className="h-[360px] rounded-[18px] bg-[#dedede]" />
              <div className="h-6 w-40 rounded bg-[#ececec]" />
              <div className="h-5 w-20 rounded bg-[#ececec]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
