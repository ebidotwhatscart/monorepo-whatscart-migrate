import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { CartState, CartItem, RemovedCartItem } from '../types/cart';

interface CartContextType {
  items: CartItem[];
  removedItems: RemovedCartItem[];
  addItem: (item: Omit<CartItem, 'quantity' | 'cartItemId'> & { cartItemId?: string; quantity?: number }) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  removeItem: (cartItemId: string) => void;
  undoRemove: () => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
  updateBusinessId: (id: string) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_PREFIX = 'cart_';
const CART_UNDO_STORAGE_PREFIX = 'cart_undo_';
const MAX_UNDO_ITEMS = 9; // Maximum number of removed items to keep for undo

// Get businessId from localStorage (assuming it's stored when user logs in/visits a store)
const getBusinessId = (): string => {
  if (typeof window === 'undefined') return 'default';
  return localStorage.getItem('currentBusinessId') || 'default';
};

interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [cartState, setCartState] = useState<CartState>({
    items: [],
    removedItems: [],
  });
  const [businessId, setBusinessId] = useState<string>(() => getBusinessId());
  const [isLoaded, setIsLoaded] = useState(false);

  // Load cart from localStorage on mount and when businessId changes
  useEffect(() => {
    const cartKey = `${CART_STORAGE_PREFIX}${businessId}`;
    const undoKey = `${CART_UNDO_STORAGE_PREFIX}${businessId}`;

    const savedCart = localStorage.getItem(cartKey);
    const savedUndo = localStorage.getItem(undoKey);

    try {
      const parsedCart = savedCart ? JSON.parse(savedCart) : { items: [], removedItems: [] };
      const parsedUndo = savedUndo ? JSON.parse(savedUndo) : [];

      const normalizedItems = (parsedCart.items || []).map((item: CartItem) => ({
        ...item,
        cartItemId: item.cartItemId || item.productId,
      }));
      const normalizedRemoved = (parsedUndo || []).map((item: RemovedCartItem) => ({
        ...item,
        cartItemId: item.cartItemId || item.productId,
      }));

      setCartState({
        items: normalizedItems,
        removedItems: normalizedRemoved,
      });
    } catch (error) {
      console.error('Error loading cart from localStorage:', error);
      setCartState({
        items: [],
        removedItems: [],
      });
    } finally {
      setIsLoaded(true);
    }
  }, [businessId]);

  // Save cart to localStorage whenever cartState changes (after initial load)
  useEffect(() => {
    if (!isLoaded) return;

    const currentBusinessId = getBusinessId();
    const cartKey = `${CART_STORAGE_PREFIX}${currentBusinessId}`;
    const undoKey = `${CART_UNDO_STORAGE_PREFIX}${currentBusinessId}`;

    try {
      localStorage.setItem(cartKey, JSON.stringify({ items: cartState.items }));
      localStorage.setItem(undoKey, JSON.stringify(cartState.removedItems));
    } catch (error) {
      console.error('Error saving cart to localStorage:', error);
    }
  }, [cartState, isLoaded]);

  const addItem = useCallback((item: Omit<CartItem, 'quantity' | 'cartItemId'> & { cartItemId?: string; quantity?: number }) => {
    // Validate input
    const quantity = item.quantity ?? 1;
    if (quantity <= 0 || !Number.isFinite(quantity)) {
      console.warn('Invalid quantity provided to addItem:', quantity);
      return;
    }

    const cartItemId = item.cartItemId || item.productId;

    if (!cartItemId || !item.productId || !item.name || item.price < 0) {
      console.warn('Invalid item provided to addItem:', item);
      return;
    }

    setCartState((prev) => {
      const existingItemIndex = prev.items.findIndex((i) => i.cartItemId === cartItemId);

      if (existingItemIndex !== -1) {
        // Item exists, update quantity
        const updatedItems = [...prev.items];
        updatedItems[existingItemIndex] = {
          ...updatedItems[existingItemIndex],
          quantity: updatedItems[existingItemIndex].quantity + quantity,
        };
        return { ...prev, items: updatedItems };
      } else {
        // New item
        return {
          ...prev,
          items: [...prev.items, { ...item, cartItemId, quantity }],
        };
      }
    });
  }, []);

  const updateQuantity = useCallback((cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(cartItemId);
      return;
    }

    setCartState((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.cartItemId === cartItemId ? { ...item, quantity } : item
      ),
    }));
  }, []);

  const removeItem = useCallback((cartItemId: string) => {
    setCartState((prev) => {
      const itemToRemove = prev.items.find((i) => i.cartItemId === cartItemId);
      if (!itemToRemove) return prev;

      return {
        items: prev.items.filter((item) => item.cartItemId !== cartItemId),
        removedItems: [
          { ...itemToRemove, timestamp: Date.now() },
          ...prev.removedItems.slice(0, MAX_UNDO_ITEMS - 1),
        ],
      };
    });
  }, []);

  const undoRemove = useCallback(() => {
    setCartState((prev) => {
      if (prev.removedItems.length === 0) return prev;

      const [lastRemoved, ...remainingRemoved] = prev.removedItems;
      const { timestamp, ...itemToRestore } = lastRemoved;

      // Check if item already exists in cart
      const existingItemIndex = prev.items.findIndex((i) => i.cartItemId === itemToRestore.cartItemId);

      let newItems;
      if (existingItemIndex !== -1) {
        // Merge quantities if item exists
        newItems = prev.items.map((item, index) =>
          index === existingItemIndex
            ? { ...item, quantity: item.quantity + itemToRestore.quantity }
            : item
        );
      } else {
        newItems = [...prev.items, itemToRestore];
      }

      return {
        items: newItems,
        removedItems: remainingRemoved,
      };
    });
  }, []);

  const clearCart = useCallback(() => {
    setCartState({
      items: [],
      removedItems: [],
    });
  }, []);

  const getTotalItems = useCallback((): number => {
    return cartState.items.reduce((total, item) => total + item.quantity, 0);
  }, [cartState.items]);

  const getTotalPrice = useCallback((): number => {
    const total = cartState.items.reduce((total, item) => total + item.price * item.quantity, 0);
    // Round to 2 decimal places to handle floating point precision
    return Math.round(total * 100) / 100;
  }, [cartState.items]);

  const updateBusinessId = useCallback((id: string) => {
    localStorage.setItem('currentBusinessId', id);
    setBusinessId(id);
  }, []);

  const value: CartContextType = {
    items: cartState.items,
    removedItems: cartState.removedItems,
    addItem,
    updateQuantity,
    removeItem,
    undoRemove,
    clearCart,
    getTotalItems,
    getTotalPrice,
    updateBusinessId,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
