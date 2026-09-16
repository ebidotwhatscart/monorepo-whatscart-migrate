export interface StoredPromotion {
  id: string;
  title: string;
  type: string;
  category: "percentage" | "fixed" | "combo" | "flash";
  status: "ACTIVE" | "SCHEDULED" | "EXPIRED" | "REJECTED";
  discountLabel: string;
  scheduleLabel?: string;
  applyTo: "cart" | "products" | "categories";
  discountValue: string;
  couponCode?: string;
  totalUsageLimit?: string;
  minOrderValue?: string;
  applyByDefault?: boolean;
  applyToDiscounted?: boolean;
  startDate?: string;
  endDate?: string;
  selectedProductIds?: string[];
  selectedCategoryIds?: string[];
  createdAt?: number;
}

function isWithinTimeFrame(promo: StoredPromotion): boolean {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  if (promo.startDate && today < promo.startDate) return false;
  if (promo.endDate && today > promo.endDate) return false;
  return true;
}

export function getActivePromotions(businessId?: string): StoredPromotion[] {
  if (typeof window === "undefined" || !businessId) return [];
  try {
    const storageKey = `whatscart_promotions_${businessId}`;
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (p) => p.status === "ACTIVE" && isWithinTimeFrame(p),
      );
    }
  } catch {
    // ignore
  }
  return [];
}

export function getAutoAppliedCoupon(businessId?: string): string | null {
  const promotions = getActivePromotions(businessId);
  const autoPromo = promotions.find(
    (p) => p.applyTo === "cart" && p.applyByDefault && p.couponCode,
  );
  return autoPromo?.couponCode?.trim().toUpperCase() ?? null;
}

export interface ProductDiscountResult {
  hasDiscount: boolean;
  originalPrice: number;
  discountedPrice: number;
  discountBadge?: string;
  promotionTitle?: string;
}

export function calculateProductDiscount(
  productId: string,
  categoryId?: string,
  originalPrice: number = 0,
  businessId?: string,
): ProductDiscountResult {
  const promotions = getActivePromotions(businessId);
  let bestDiscountedPrice = originalPrice;
  let appliedPromo: StoredPromotion | null = null;

  for (const promo of promotions) {
    let applies = false;
    if (promo.applyTo === "products" && promo.selectedProductIds?.includes(productId)) {
      applies = true;
    } else if (promo.applyTo === "categories" && categoryId && promo.selectedCategoryIds?.includes(categoryId)) {
      applies = true;
    }

    if (applies) {
      const val = parseFloat(promo.discountValue) || 0;
      let calculated = originalPrice;
      if (promo.category === "percentage") {
        calculated = Math.max(0, Math.round(originalPrice * (1 - val / 100)));
      } else {
        calculated = Math.max(0, originalPrice - val);
      }

      if (calculated < bestDiscountedPrice) {
        bestDiscountedPrice = calculated;
        appliedPromo = promo;
      }
    }
  }

  if (appliedPromo && bestDiscountedPrice < originalPrice) {
    return {
      hasDiscount: true,
      originalPrice,
      discountedPrice: bestDiscountedPrice,
      discountBadge: appliedPromo.discountLabel,
      promotionTitle: appliedPromo.title,
    };
  }

  return {
    hasDiscount: false,
    originalPrice,
    discountedPrice: originalPrice,
  };
}

export interface CartDiscountResult {
  hasCoupon: boolean;
  couponCode?: string;
  discountAmount: number;
  finalTotal: number;
  error?: string;
}

export function evaluateCartCoupon(
  code: string,
  subtotal: number,
  businessId?: string,
): CartDiscountResult {
  const promotions = getActivePromotions(businessId);
  const cleanCode = code.trim().toUpperCase();
  
  if (!cleanCode) {
    return {
      hasCoupon: false,
      discountAmount: 0,
      finalTotal: subtotal,
    };
  }

  const found = promotions.find(
    (p) => p.applyTo === "cart" && p.couponCode && p.couponCode.trim().toUpperCase() === cleanCode
  );

  if (!found) {
    return {
      hasCoupon: false,
      discountAmount: 0,
      finalTotal: subtotal,
      error: "Invalid or expired coupon code",
    };
  }

  if (found.minOrderValue) {
    const minVal = parseFloat(found.minOrderValue) || 0;
    if (subtotal < minVal) {
      return {
        hasCoupon: false,
        discountAmount: 0,
        finalTotal: subtotal,
        error: `Minimum order value for this coupon is ₹${minVal}`,
      };
    }
  }

  const val = parseFloat(found.discountValue) || 0;
  let discountAmount = 0;
  if (found.category === "percentage") {
    discountAmount = Math.round((subtotal * val) / 100);
  } else {
    discountAmount = Math.min(subtotal, val);
  }

  return {
    hasCoupon: true,
    couponCode: found.couponCode,
    discountAmount,
    finalTotal: Math.max(0, subtotal - discountAmount),
  };
}
