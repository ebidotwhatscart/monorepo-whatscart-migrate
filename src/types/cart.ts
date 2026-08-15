import type { ProductCustomizationPayload } from "../lib/productCustomization";

export interface CartItem {
  cartItemId: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  customization?: ProductCustomizationPayload;
  customizationLines?: string[];
}

export interface RemovedCartItem extends CartItem {
  timestamp: number;
}

export interface CartState {
  items: CartItem[];
  removedItems: RemovedCartItem[];
}
