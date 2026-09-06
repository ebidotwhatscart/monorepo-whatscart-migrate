import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFirebaseQuery as useQuery } from '../lib/firebase/hooks';
import { api, type Id } from '../lib/firebase/operations';
import { useCart } from '../context/CartContext';
import { ShoppingBag, Trash2, X, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { createStorefrontTheme } from "../lib/storefrontTheme";

interface CartSidebarProps {
  businessId: Id<'businesses'>;
  businessSlug: string;
  businessName: string;
  themeColor: string;
  whatsappPhone: string;
  isOpen: boolean;
  onClose: () => void;
}

export function CartSidebar({
  businessId,
  businessSlug,
  businessName,
  themeColor,
  whatsappPhone,
  isOpen,
  onClose,
}: CartSidebarProps) {
  const navigate = useNavigate();
  const { items, updateQuantity, removeItem, addItem, getTotalPrice } = useCart();
  const storefrontTheme = createStorefrontTheme({ themeColor });

  // Fetch all products for the business to get thumbnails
  const products = useQuery(
    api.products.getPublicProducts,
    businessId ? { businessId } : 'skip'
  );

  // Create a map of product IDs to image URLs
  const productImageMap = useCallback(() => {
    const map = new Map<string, string | null>();
    if (products) {
      products.forEach((product) => {
        map.set(product._id, product.imageUrls?.[0] || null);
      });
    }
    return map;
  }, [products]);

  const productPriceMap = useCallback(() => {
    const map = new Map<string, number>();
    if (products) {
      products.forEach((product) => {
        if (typeof product.price === "number") {
          map.set(product._id, product.price);
        }
      });
    }
    return map;
  }, [products]);

  const imageMap = productImageMap();
  const originalPriceMap = productPriceMap();

  // Body scroll lock when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  // Handle quantity decrement
  const handleDecrement = useCallback(
    (cartItemId: string, currentQuantity: number) => {
      if (currentQuantity > 1) {
        updateQuantity(cartItemId, currentQuantity - 1);
      }
    },
    [updateQuantity]
  );

  // Handle quantity increment
  const handleIncrement = useCallback(
    (cartItemId: string, currentQuantity: number) => {
      updateQuantity(cartItemId, currentQuantity + 1);
    },
    [updateQuantity]
  );

  // Handle item removal with undo toast
  const handleRemove = useCallback(
    (item: { cartItemId?: string; productId: string; name: string; quantity: number; price: number }) => {
      // Capture the specific item data in the closure so the toast
      // can restore the exact item that was removed, not just the most recent one
      const removedItem = { ...item };

      removeItem(removedItem.cartItemId ?? removedItem.productId);

      toast(`${removedItem.name} removed from cart`, {
        duration: 3000,
        action: {
          label: 'Undo',
          onClick: () => {
            // Restore the specific item that was removed
            addItem(removedItem);
          },
        },
      });
    },
    [removeItem, addItem]
  );

  // Handle checkout - navigate to checkout page
  const handleCheckout = useCallback(() => {
    if (items.length === 0) return;

    // Navigate to checkout page with cart source
    const params = new URLSearchParams({
      source: 'cart',
      slug: businessSlug,
    });

    navigate(`/checkout?${params.toString()}`);
    onClose();
  }, [items, businessSlug, navigate, onClose]);

  return (
    <>
      {/* Backdrop overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={handleBackdropClick}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-sm shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ backgroundColor: storefrontTheme.background, color: storefrontTheme.textPrimary }}
        aria-label="Shopping cart"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4" style={{ borderColor: storefrontTheme.border }}>
          <h2 className="text-xl font-semibold" style={{ color: storefrontTheme.textPrimary }}>Shopping Cart</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close cart"
          >
            <X className="w-5 h-5" style={{ color: storefrontTheme.textSecondary }} />
          </button>
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 180px)' }}>
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 px-4">
              <ShoppingBag className="w-16 h-16 text-gray-300 mb-4" />
              <h3 className="mb-2 text-lg font-medium" style={{ color: storefrontTheme.textPrimary }}>Your cart is empty</h3>
              <p className="text-center" style={{ color: storefrontTheme.textSecondary }}>Add items to get started</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {items.map((item) => (
                <li
                  key={item.cartItemId ?? item.productId} 
                  className="p-4 hover:bg-gray-50 transition-colors"
                  style={{ borderColor: storefrontTheme.border, backgroundColor: storefrontTheme.background }}
                >
                  <div className="flex gap-4">
                    {/* Thumbnail */}
                    <div className="flex-shrink-0">
                      {imageMap.get(item.productId) ? (
                        <img
                          src={imageMap.get(item.productId)!}
                          alt={item.name}
                          className="w-20 h-20 rounded-lg object-cover border border-gray-200"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center">
                          <ShoppingBag className="w-8 h-8 text-gray-400" />
                        </div>
                      )}
                    </div>

                    {/* Product info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="truncate font-medium" style={{ color: storefrontTheme.textPrimary }}>{item.name}</h3>
                      <div className="flex items-baseline gap-2 mt-1">
                        <p
                          className="text-sm font-semibold"
                          style={{
                            color: (originalPriceMap.get(item.productId) ?? 0) > item.price ? "#006E08" : themeColor,
                          }}
                        >
                          ₹{item.price.toFixed(2)}
                        </p>
                        {(originalPriceMap.get(item.productId) ?? 0) > item.price && (
                          <p className="text-xs text-slate-400 line-through font-normal">
                            ₹{(originalPriceMap.get(item.productId)!).toFixed(2)}
                          </p>
                        )}
                      </div>
                      {item.customizationLines?.length ? (
                        <ul className="mt-2 list-disc pl-4 text-xs text-gray-500">
                          {item.customizationLines.map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      ) : null}

                      {/* Quantity controls */}
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDecrement(item.cartItemId ?? item.productId, item.quantity)}
                            disabled={item.quantity <= 1}
                            className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-8 text-center text-sm font-medium text-gray-900">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => handleIncrement(item.cartItemId ?? item.productId, item.quantity)}
                            className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100 transition-colors"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Remove button */}
                        <button
                          onClick={() => handleRemove(item)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          aria-label="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 bg-white border-t p-4 shadow-lg">
            {/* Subtotal */}
            <div className="mb-4 flex items-center justify-between">
              <span style={{ color: storefrontTheme.textSecondary }}>Subtotal</span>
              <span className="text-xl font-bold" style={{ color: storefrontTheme.textPrimary }}>
                ₹{getTotalPrice().toFixed(2)}
              </span>
            </div>

            {/* Checkout button */}
            <button
              onClick={handleCheckout}
              className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 font-semibold transition-opacity hover:opacity-90"
              style={{
                backgroundColor: storefrontTheme.ctaBackground,
                color: storefrontTheme.ctaText,
              }}
            >
              <ShoppingBag className="w-5 h-5" />
              Checkout
            </button>

            <p className="mt-2 text-center text-xs" style={{ color: storefrontTheme.textSecondary }}>
              Taxes and shipping calculated at WhatsApp
            </p>
          </div>
        )}
      </div>
    </>
  );
}
