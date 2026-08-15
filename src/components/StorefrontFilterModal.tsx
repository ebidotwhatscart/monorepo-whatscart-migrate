import { Check, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { StorefrontTheme } from "../lib/storefrontTheme";
import type {
  StorefrontAppliedFilters,
  StorefrontPriceBounds,
  StorefrontSortDirection,
} from "../lib/storefrontFilters";
import "./StorefrontFilterModal.css";

type StorefrontFilterModalProps = {
  isOpen: boolean;
  priceBounds: StorefrontPriceBounds;
  filters: StorefrontAppliedFilters;
  sortDirection: StorefrontSortDirection;
  storefrontTheme: StorefrontTheme;
  onApply: (
    filters: StorefrontAppliedFilters,
    sortDirection: StorefrontSortDirection,
  ) => void;
  onClose: () => void;
};

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);
}

export function StorefrontFilterModal({
  isOpen,
  priceBounds,
  filters,
  sortDirection,
  storefrontTheme,
  onApply,
  onClose,
}: StorefrontFilterModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [draftMinPrice, setDraftMinPrice] = useState(priceBounds.min);
  const [draftMaxPrice, setDraftMaxPrice] = useState(priceBounds.max);
  const [draftSortDirection, setDraftSortDirection] =
    useState<StorefrontSortDirection>(sortDirection);

  useEffect(() => {
    if (!isOpen) return;

    setDraftMinPrice(filters.minPrice ?? priceBounds.min);
    setDraftMaxPrice(filters.maxPrice ?? priceBounds.max);
    setDraftSortDirection(sortDirection);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => dialogRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [filters, isOpen, onClose, priceBounds.max, priceBounds.min, sortDirection]);

  const priceSpan = Math.max(priceBounds.max - priceBounds.min, 1);
  const minPercent = ((draftMinPrice - priceBounds.min) / priceSpan) * 100;
  const maxPercent = ((draftMaxPrice - priceBounds.min) / priceSpan) * 100;
  const hasPriceRange = priceBounds.max > priceBounds.min;

  const selectedFilterCount = useMemo(
    () =>
      (draftMinPrice > priceBounds.min || draftMaxPrice < priceBounds.max
        ? 1
        : 0),
    [
      draftMaxPrice,
      draftMinPrice,
      priceBounds.max,
      priceBounds.min,
    ],
  );

  if (!isOpen) return null;

  const resetDraft = () => {
    setDraftMinPrice(priceBounds.min);
    setDraftMaxPrice(priceBounds.max);
    setDraftSortDirection("asc");
  };

  const applyDraft = () => {
    onApply(
      {
        minPrice:
          draftMinPrice > priceBounds.min ? draftMinPrice : undefined,
        maxPrice:
          draftMaxPrice < priceBounds.max ? draftMaxPrice : undefined,
      },
      draftSortDirection,
    );
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 backdrop-blur-[2px] lg:items-center lg:p-8"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="storefront-filter-title"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
          );
          if (!focusableElements?.length) return;

          const firstElement = focusableElements[0];
          const lastElement = focusableElements[focusableElements.length - 1];
          if (event.shiftKey && document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          } else if (!event.shiftKey && document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }}
        className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] shadow-2xl outline-none lg:max-h-[min(820px,90vh)] lg:max-w-[640px] lg:rounded-[24px]"
        style={{
          backgroundColor: storefrontTheme.surface,
          color: storefrontTheme.textPrimary,
        }}
      >
        <header
          className="flex items-center justify-between border-b px-5 py-5 lg:px-7"
          style={{ borderColor: storefrontTheme.border }}
        >
          <div>
            <h2
              id="storefront-filter-title"
              className="text-xl font-bold tracking-[-0.02em] lg:text-2xl"
            >
              Filters &amp; sort
            </h2>
            <p
              className="mt-1 text-sm"
              style={{ color: storefrontTheme.textSecondary }}
            >
              Refine products available from this store
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2"
            style={{ backgroundColor: storefrontTheme.surfaceMuted }}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-2 lg:px-7">
          <fieldset
            className="border-b py-6"
            style={{ borderColor: storefrontTheme.border }}
          >
            <legend className="text-base font-bold">Sort by</legend>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {([
                ["asc", "Price: Low to High"],
                ["desc", "Price: High to Low"],
              ] as const).map(([value, label]) => {
                const selected = draftSortDirection === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setDraftSortDirection(value)}
                    className="flex min-h-12 items-center justify-between rounded-xl border px-4 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2"
                    style={{
                      borderColor: selected
                        ? storefrontTheme.accent
                        : storefrontTheme.border,
                      backgroundColor: selected
                        ? storefrontTheme.accentSoft
                        : storefrontTheme.surface,
                    }}
                  >
                    {label}
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full border"
                      style={{
                        borderColor: selected
                          ? storefrontTheme.accent
                          : storefrontTheme.border,
                        backgroundColor: selected
                          ? storefrontTheme.accent
                          : "transparent",
                        color: storefrontTheme.ctaText,
                      }}
                    >
                      {selected && <Check className="h-3.5 w-3.5" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <section
            className="border-b py-6"
            style={{ borderColor: storefrontTheme.border }}
            aria-labelledby="price-range-title"
          >
            <div className="flex items-center justify-between gap-4">
              <h3 id="price-range-title" className="text-base font-bold">
                Price range
              </h3>
              <span
                className="text-sm font-semibold"
                style={{ color: storefrontTheme.textSecondary }}
              >
                {formatPrice(draftMinPrice)} – {formatPrice(draftMaxPrice)}
              </span>
            </div>

            <div className="mt-7 px-2">
              <div className="relative h-7">
                <div
                  className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full"
                  style={{ backgroundColor: storefrontTheme.surfaceStrong }}
                />
                <div
                  className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full"
                  style={{
                    left: `${Math.max(0, minPercent)}%`,
                    right: `${Math.max(0, 100 - maxPercent)}%`,
                    backgroundColor: storefrontTheme.accent,
                  }}
                />
                <input
                  type="range"
                  min={priceBounds.min}
                  max={priceBounds.max}
                  step={1}
                  value={draftMinPrice}
                  disabled={!hasPriceRange}
                  onChange={(event) =>
                    setDraftMinPrice(
                      Math.min(Number(event.target.value), draftMaxPrice),
                    )
                  }
                  aria-label="Minimum price"
                  className="storefront-filter-range"
                  style={{
                    "--storefront-filter-thumb": storefrontTheme.accent,
                    zIndex: draftMinPrice >= draftMaxPrice ? 3 : 2,
                  } as React.CSSProperties}
                />
                <input
                  type="range"
                  min={priceBounds.min}
                  max={priceBounds.max}
                  step={1}
                  value={draftMaxPrice}
                  disabled={!hasPriceRange}
                  onChange={(event) =>
                    setDraftMaxPrice(
                      Math.max(Number(event.target.value), draftMinPrice),
                    )
                  }
                  aria-label="Maximum price"
                  className="storefront-filter-range"
                  style={{
                    "--storefront-filter-thumb": storefrontTheme.accent,
                    zIndex: 2,
                  } as React.CSSProperties}
                />
              </div>
              <div
                className="mt-1 flex justify-between text-xs font-medium"
                style={{ color: storefrontTheme.textSecondary }}
              >
                <span>{formatPrice(priceBounds.min)}</span>
                <span>{formatPrice(priceBounds.max)}</span>
              </div>
            </div>
          </section>

        </div>

        <footer
          className="grid grid-cols-[auto_1fr] gap-3 border-t px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:px-7 lg:py-5"
          style={{
            borderColor: storefrontTheme.border,
            backgroundColor: storefrontTheme.surface,
          }}
        >
          <button
            type="button"
            onClick={resetDraft}
            className="min-h-12 rounded-xl border px-5 text-sm font-bold transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2"
            style={{ borderColor: storefrontTheme.border }}
          >
            Reset all
          </button>
          <button
            type="button"
            onClick={applyDraft}
            className="min-h-12 rounded-xl px-5 text-sm font-bold shadow-sm transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2"
            style={{
              backgroundColor: storefrontTheme.ctaBackground,
              color: storefrontTheme.ctaText,
            }}
          >
            Apply filters
            {selectedFilterCount > 0 ? ` (${selectedFilterCount})` : ""}
          </button>
        </footer>
      </div>
    </div>
  );
}
