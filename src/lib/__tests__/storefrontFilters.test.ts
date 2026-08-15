import { describe, expect, it } from "vitest";
import {
  countActiveStorefrontFilters,
  filterAndSortStorefrontProducts,
  getStorefrontPriceBounds,
} from "../storefrontFilters";

const products = [
  { id: "saree", price: 8500 },
  { id: "shirt", price: 3400 },
  { id: "jacket", price: 6200 },
];

describe("storefront filters", () => {
  it("filters by price and sorts the matching products", () => {
    const filtered = filterAndSortStorefrontProducts(
      products,
      {
        minPrice: 4000,
        maxPrice: 7000,
      },
      "desc",
    );

    expect(filtered.map((product) => product.id)).toEqual(["jacket"]);
  });

  it("reports price bounds and an active price filter", () => {
    expect(getStorefrontPriceBounds(products)).toEqual({
      min: 3400,
      max: 8500,
    });
    expect(countActiveStorefrontFilters({ maxPrice: 7000 })).toBe(1);
    expect(countActiveStorefrontFilters({})).toBe(0);
  });
});
