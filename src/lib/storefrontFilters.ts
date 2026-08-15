export type StorefrontSortDirection = "asc" | "desc";

export type StorefrontFilterableProduct = {
  price: number;
};

export type StorefrontAppliedFilters = {
  minPrice?: number;
  maxPrice?: number;
};

export type StorefrontPriceBounds = {
  min: number;
  max: number;
};

export function getStorefrontPriceBounds(
  products: StorefrontFilterableProduct[],
): StorefrontPriceBounds {
  if (products.length === 0) return { min: 0, max: 0 };

  return products.reduce(
    (bounds, product) => ({
      min: Math.min(bounds.min, product.price),
      max: Math.max(bounds.max, product.price),
    }),
    { min: products[0].price, max: products[0].price },
  );
}

export function filterAndSortStorefrontProducts<
  Product extends StorefrontFilterableProduct,
>(
  products: Product[],
  filters: StorefrontAppliedFilters,
  sortDirection: StorefrontSortDirection,
) {
  const filtered = products.filter((product) => {
    if (filters.minPrice !== undefined && product.price < filters.minPrice) {
      return false;
    }
    if (filters.maxPrice !== undefined && product.price > filters.maxPrice) {
      return false;
    }
    return true;
  });

  return [...filtered].sort((first, second) =>
    sortDirection === "asc"
      ? first.price - second.price
      : second.price - first.price,
  );
}

export function countActiveStorefrontFilters(filters: StorefrontAppliedFilters) {
  return filters.minPrice !== undefined || filters.maxPrice !== undefined ? 1 : 0;
}
