# Storefront Promotion Banner Carousel — Design

**Date:** 2026-09-15
**Status:** Approved

## Problem

Admins can create promotions (dashboard) and they persist per-business in
localStorage under `whatscart_promotions_${businessId}`. Product tiles and
prices already apply these discounts (`src/lib/storefrontPromotions.ts`), but
the storefront top banner only ever shows static shipping text
(`StorefrontHeader.tsx` lines 375–385). Storefront visitors never see active
promotions surfaced.

## Goal

Turn the shipping banner into a rotating carousel:

1. Active promotions appear as slides (promotion shown first).
2. Auto-scroll to the next promotion; after the last one show shipping details.
3. Clicking a promotion navigates to the relevant section or product.
4. Shipping slide is always last.

## Current State

- `src/lib/storefrontPromotions.ts` — `getActivePromotions(businessId)` returns
  `ACTIVE` promos from localStorage; `StoredPromotion` has `title`,
  `discountLabel`, `couponCode`, `applyTo` (`cart`|`products`|`categories`),
  `selectedProductIds`, `selectedCategoryIds`.
- `src/components/StorefrontHeader.tsx` — static one-line shipping bar, styled
  with `storefrontTheme.shippingBarBackground`/`shippingBarText`. Used by
  `Storefront.tsx` (mobile + desktop), `ProductDetail.tsx` (desktop only), and
  `StorefrontNotFound.tsx`.
- `src/components/Storefront.tsx` — holds loaded products, categories, router,
  and `handleCategorySelect(categoryId)` (sets filter + scrolls to products).

## Approach

**A: Navigation callbacks, header stays presentational.**
The header owns slides + auto-scroll. Click targets are resolved by the page
component, which has the data and router.

## Design

### 1. Slide model (`StorefrontHeader.tsx`)

Build slides from `getActivePromotions(business._id)`:

- One slide per active promo: renders `title` + `discountLabel`
  (e.g. `Festive Sale — 20% OFF`); cart promos also show `couponCode`.
- Final slide: shipping text (`business.shippingBannerText || "Free shipping
  across India"`).
- No active promotions → single static line, no animation, no timer. Existing
  behavior and tests preserved.

Slides are a flat array: `{ kind: "promo", promo }[]` followed by one
`{ kind: "shipping" }` slide.

### 2. Carousel behavior (`StorefrontHeader.tsx`)

- Auto-advance every 4000 ms via `setInterval`.
- Pause on hover (`pointerenter`/`pointerleave`) and while the document tab is
  hidden (`visibilitychange`).
- Loop: after shipping slide wraps back to first promotion.
- No dots indicator.
- One-line bar with fixed height, `overflow-hidden`, `translateX` slide
  (`transform: translateX(-${activeIndex * 100}%)`), `transition` ~300ms.
- Accessibility: allow reduced motion (`prefers-reduced-motion`) → no auto-advance.
- Promo slides render as `<button>` (clickable); shipping slide is plain text.

### 3. Navigation (`onPromotionClick` prop)

New header prop `onPromotionClick(promo: StoredPromotion): void`. Required;
all three call sites updated.

- `Storefront.tsx`:
  - `applyTo === "products"` → first id in `selectedProductIds`; if that
    product exists in loaded `products`, `navigate` to its storefront product
    page; otherwise scroll to `#category-products`.
  - `applyTo === "categories"` → first id in `selectedCategoryIds`;
    `handleCategorySelect(categoryId)`.
  - `applyTo === "cart"` → scroll to `#category-products` (product grid).
- `ProductDetail.tsx` (desktop header) → navigate to storefront home.
- `StorefrontNotFound.tsx` → navigate to storefront home.

### 4. Files touched

- `src/components/StorefrontHeader.tsx` — carousel, slides, timer, prop.
- `src/components/Storefront.tsx` — pass `onPromotionClick` (type-aware).
- `src/components/ProductDetail.tsx` — pass no-op-to-home handler.
- `src/components/StorefrontNotFound.tsx` — pass no-op-to-home handler.
- `src/components/__tests__/storefront-redesign.test.tsx` — extend.

No new routes, no schema changes, no new components.

### 5. Testing

Extend `src/components/__tests__/storefront-redesign.test.tsx`:

- No promotions in localStorage → static shipping text renders (existing test
  keeps passing).
- Promotions seeded in localStorage (`whatscart_promotions_biz_1`) →
  promotion slide (title + label) renders; shipping slide present last.
- Clicking a product-promotion slide navigates to the product route.
- Clicking a category-promotion slide filters the product grid to that category.

## Out of Scope

- ProductDetail mobile header (separate `header` element, no shipping bar today).
- Actual sale/discount computation — already handled by
  `storefrontPromotions.ts`.
- Cross-device promo sync — promotions remain per-browser local
  (existing behavior).