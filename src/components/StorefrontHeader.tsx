import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ShoppingCart, X } from "lucide-react";
import type { StorefrontTheme } from "../lib/storefrontTheme";
import headerCartUrl from "../assets/figma/storefront-header-cart.svg";
import headerMenuUrl from "../assets/figma/storefront-header-menu.svg";
import storefrontWebSearchIconUrl from "../assets/figma/storefront-web-search-icon.svg";
import backButtonUrl from "../assets/figma/back-button.svg";
import { storefrontPath } from "../lib/urls";
import { useRuntimeHostname } from "../context/RuntimeLocationContext";

interface PublicCategory {
  _id: string;
  name: string;
}

interface StorefrontHeaderProps {
  business: {
    _id: string;
    name: string;
    slug: string;
    logoUrl?: string | null;
    themeColor: string;
    shippingBannerText?: string;
    brandPalette?: {
      seedColor: string;
      mode: string;
      colors: string[];
      primaryColor: string;
    };
    fssaiNumber?: string | null;
    fssaiDocUrl?: string | null;
  };
  storefrontTheme: StorefrontTheme;
  categories: PublicCategory[];
  getTotalItems: () => number;
  selectedCategory: string;
  onSelectCategory: (categoryId: string) => void;
  slug: string;
  onCartClick: () => void;
  showBackButton?: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
}

function DesktopNavButton({
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
      className="inline-flex self-center px-1 text-base font-medium transition"
      style={{
        color: selected ? storefrontTheme.textPrimary : storefrontTheme.textSecondary,
      }}
    >
      <span
        className="border-b-2 pb-1"
        style={{
          borderColor: selected ? storefrontTheme.support : "transparent",
        }}
      >
        {label}
      </span>
    </button>
  );
}

function CategorySidebar({
  categories,
  selectedCategory,
  isOpen,
  onClose,
  onSelectCategory,
  businessName,
  businessLogoUrl,
  storefrontTheme,
}: {
  categories: PublicCategory[];
  selectedCategory: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectCategory: (categoryId: string) => void;
  businessName: string;
  businessLogoUrl?: string | null;
  storefrontTheme: StorefrontTheme;
}) {
  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Categories"
        className="fixed left-0 top-0 z-50 h-[754px] min-h-screen w-[290px] max-w-[82vw] bg-white shadow-2xl"
      >
        <div className="relative flex h-full flex-col">
          <div
            className="absolute left-[33px] top-[35px] flex h-8 w-[160px] "
          >
            {businessLogoUrl ? (
              <img
                src={businessLogoUrl}
                alt={businessName}
                className="h-12 w-auto max-w-[130px] object-contain"
              />
            ) : (
              <span className="truncate text-sm font-semibold">
                {businessName}
              </span>
            )}
          </div>

          <div className="mt-[95px] w-full overflow-y-auto">
            <div className="flex flex-col">
              {categories.map((category) => (
                <button
                  key={category._id}
                  type="button"
                  aria-label={category.name}
                  onClick={() => onSelectCategory(category._id)}
                  className="flex h-12 w-full items-center border border-[#e7e7e7] px-8 text-left text-[20px] font-normal leading-7 tracking-[-0.025em] text-[#2d3435] transition hover:bg-[#f7f7f5]"
                  style={{
                    backgroundColor:
                      selectedCategory === category._id
                        ? storefrontTheme.supportSoft
                        : "#ffffff",
                    color:
                      selectedCategory === category._id
                        ? storefrontTheme.textPrimary
                        : storefrontTheme.textPrimary,
                    borderColor: storefrontTheme.border,
                  }}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-auto border-t px-8 py-5" style={{ borderColor: storefrontTheme.border }}>
            <Link
              to="/"
              className="flex items-center gap-3 text-sm text-[#5A6061]"
            >
              <img
                src="http://localhost:5173/src/assets/figma/whatscart-powered-logo.svg"
                alt="Whatscart logo"
                className="h-7 w-[22px]"
              />
              Whatscart
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}

export function StorefrontHeader({
  business,
  storefrontTheme,
  categories,
  getTotalItems,
  selectedCategory,
  onSelectCategory,
  slug,
  onCartClick,
  showBackButton,
  searchQuery,
  onSearchChange,
}: StorefrontHeaderProps) {
  const runtimeHostname = useRuntimeHostname();
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const [isDesktopSearchOpen, setIsDesktopSearchOpen] = useState(false);
  const desktopSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isCategoriesOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isCategoriesOpen]);

  useEffect(() => {
    if (isDesktopSearchOpen && desktopSearchRef.current) {
      desktopSearchRef.current.focus();
    }
  }, [isDesktopSearchOpen]);

  return (
    <>
      <header
        className="fixed inset-x-0 top-0 z-30 border-b border-black/5 backdrop-blur-xl lg:static lg:border-b-0"
        style={{ backgroundColor: "#ffffff" }}
      >
        <div className="mx-auto max-w-md px-4 lg:max-w-[1184px] lg:px-0">
          <div className="flex h-[88px] items-center justify-between gap-3 lg:grid lg:h-20 lg:grid-cols-[auto_1fr_auto] lg:gap-8">
            {showBackButton ? (
              <Link
                to={storefrontPath(slug, "", runtimeHostname)}
                className="flex h-10 w-10 items-center justify-start rounded-full bg-white/70 backdrop-blur-md lg:hidden"
                aria-label="Go back"
              >
                <img src={backButtonUrl} alt="" className="w-[18px] h-[12px]" />
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setIsCategoriesOpen(true)}
                className="flex h-[37px]  items-center justify-start lg:hidden"
                aria-label="Open categories"
              >
                <img
                  src={headerMenuUrl}
                  alt=""
                  className="h-[37px] w-20"
                  aria-hidden="true"
                />
              </button>
            )}

            <Link
              to={storefrontPath(slug, "", runtimeHostname)}
              className="mx-auto flex h-10 min-w-0 max-w-[190px] items-center justify-center rounded-full px-4 lg:mx-0 lg:h-11 lg:max-w-[220px] lg:px-4"
               style={{ color: storefrontTheme.textPrimary }}
            >
              {business.logoUrl ? (
                <div className="flex flex-col items-center">
                  <img
                    src={business.logoUrl}
                    alt={business.name}
                    className="h-auto w-[6rem] max-w-[240px] object-contain"
                  />
                  {business.fssaiNumber && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200/80 px-1.5 py-0.2 rounded mt-0.5">
                      ✓ FSSAI Verified
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <span className="truncate text-sm font-semibold">
                    {business.name}
                  </span>
                  {business.fssaiNumber && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200/80 px-1.5 py-0.2 rounded mt-0.5">
                      ✓ FSSAI Verified
                    </span>
                  )}
                </div>
              )}
            </Link>

            <button
              type="button"
              onClick={onCartClick}
              className="relative flex h-10 w-16 items-center justify-end lg:hidden"
              aria-label="Open cart"
            >
              <ShoppingCart className="h-auto w-5 lg:h-6 lg:w-6" aria-hidden="true" />
              {getTotalItems() > 0 && (
                <span
                  className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold"
                  style={{
                    backgroundColor: storefrontTheme.cartBadgeBackground,
                    color: storefrontTheme.cartBadgeText,
                  }}
                >
                  {getTotalItems()}
                </span>
              )}
            </button>

            <nav
              aria-label="Desktop storefront categories"
              className="hidden items-stretch justify-center gap-8 self-stretch lg:flex"
            >
              <DesktopNavButton
                label="Home"
                selected={selectedCategory === "all"}
                onClick={() => onSelectCategory("all")}
                storefrontTheme={storefrontTheme}
              />
              {categories.slice(0, 4).map((category) => (
                <DesktopNavButton
                  key={category._id}
                  label={category.name}
                  selected={selectedCategory === category._id}
                  onClick={() => onSelectCategory(category._id)}
                  storefrontTheme={storefrontTheme}
                />
              ))}
            </nav>

            <div className="hidden items-center gap-4 lg:flex">
              {isDesktopSearchOpen ? (
                <div className="relative flex items-center">
                  <input
                    ref={desktopSearchRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    onBlur={() => setIsDesktopSearchOpen(false)}
                    placeholder="Search..."
                    className="h-12 w-[241px] rounded-2xl border border-[#ebe7e4] bg-[#f4f4f3] px-4 pr-10 text-base outline-none transition placeholder:text-[#6b7280] focus:bg-white"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => onSearchChange("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 hover:bg-black/10 transition"
                      aria-label="Clear search"
                    >
                      <X className="h-4 w-4 text-[#6b7280]" />
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsDesktopSearchOpen(true)}
                  className="flex h-12 w-[241px] items-center gap-3 rounded-2xl border border-[#ebe7e4] bg-[#f4f4f3] px-4 text-left text-base text-[#6b7280] transition hover:bg-[#efefed] lg:h-12 lg:rounded-2xl lg:border"
                >
                  <img
                    src={storefrontWebSearchIconUrl}
                    alt=""
                    className="h-[18px] w-[18px]"
                    aria-hidden="true"
                  />
                  Search
                </button>
              )}
              <button
                type="button"
                onClick={onCartClick}
                className="relative flex h-12 min-w-[56px] items-center justify-center rounded-2xl border border-[#ebe7e4] bg-white px-4 shadow-sm transition hover:bg-[#f8f8f7] lg:h-14 lg:min-w-[72px] lg:rounded-2xl"
                aria-label="Desktop cart"
              >
                <ShoppingCart className="h-auto w-5 lg:h-6 lg:w-6" aria-hidden="true" />
                {getTotalItems() > 0 && (
                  <span
                    className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold"
                    style={{
                      backgroundColor: storefrontTheme.cartBadgeBackground,
                      color: storefrontTheme.cartBadgeText,
                    }}
                  >
                    {getTotalItems()}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
        <div className="border-t border-black/5 lg:border-t-0">
          <div
            className="px-4 py-2 text-center text-sm font-medium lg:rounded-none lg:px-6"
            style={{
              backgroundColor: storefrontTheme.shippingBarBackground,
              color: storefrontTheme.shippingBarText,
            }}
          >
            {business?.shippingBannerText || "Free shipping across India"}
          </div>
        </div>
      </header>

      <CategorySidebar
        categories={categories}
        selectedCategory={selectedCategory}
        isOpen={isCategoriesOpen}
        onClose={() => setIsCategoriesOpen(false)}
        onSelectCategory={(categoryId) => {
          onSelectCategory(categoryId);
          setIsCategoriesOpen(false);
        }}
        businessName={business.name}
        businessLogoUrl={business.logoUrl}
        storefrontTheme={storefrontTheme}
      />
    </>
  );
}
