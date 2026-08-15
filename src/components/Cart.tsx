import { useParams, Link } from "react-router-dom";
import { useFirebaseQuery as useQuery } from "../lib/firebase/hooks";
import { api, type Id } from "../lib/firebase/operations";
import { useMemo } from "react";
import { ShoppingBag } from "lucide-react";
import { createStorefrontTheme } from "../lib/storefrontTheme";
import { getTenantSlug, productSlug, storefrontPath } from "../lib/urls";
import { useRuntimeHostname } from "../context/RuntimeLocationContext";

interface CartItem {
  cartItemId?: string;
  productId: Id<"products">;
  quantity: number;
  name: string;
  price: number;
  customizationNotes?: string[];
}

export function Cart() {
  const { slug: routeSlug, cartId } = useParams<{ slug: string; cartId: string }>();
  const runtimeHostname = useRuntimeHostname();
  const slug = routeSlug ?? getTenantSlug(runtimeHostname);
  const business = useQuery(api.businesses.getBusinessBySlug, { slug: slug! });
  const savedCart = useQuery(api.carts.getCart, { cartId: cartId! });

  // Fetch products to get images
  const products = useQuery(
    api.products.getPublicProducts,
    business ? { businessId: business._id } : "skip"
  );

  // Create a map of product IDs to image URLs
  const productImageMap = useMemo(() => {
    const map = new Map<string, string | null>();
    if (products) {
      products.forEach((product) => {
        map.set(product._id, product.imageUrls?.[0] || null);
      });
    }
    return map;
  }, [products]);

  // Load cart from saved cart (Convex)
  const cart = useMemo(() => {
    if (!savedCart) return [];
    // Load from database only
    return savedCart.products
      .filter(item => item.name && item.price)
      .map(item => ({
        cartItemId: item.cartItemId,
        productId: item.productId,
        quantity: item.quantity,
        name: item.name!,
        price: item.price!,
        customizationNotes: item.customizationNotes,
      }));
  }, [savedCart]);

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  if (business === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Store Not Found</h1>
          <p className="text-gray-600">The store you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  const cartTheme = createStorefrontTheme({
    themeColor: business.themeColor,
    brandPalette: business.brandPalette,
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              to={storefrontPath(business.slug)}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
            >
              <span>←</span>
              <span>Back to Store</span>
            </Link>
            <h1 className="text-xl font-bold text-gray-900">Order Details</h1>
            <div></div>
          </div>
        </div>
      </header>

      {/* Cart Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {cart.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">🛒</div>
            <h2 className="text-xl font-medium text-gray-900 mb-2">
              Your cart is empty
            </h2>
            <p className="text-gray-600 mb-6">
              Add some products to get started
            </p>
            <Link
              to={storefrontPath(business.slug)}
              className="inline-flex items-center px-6 py-3 rounded-lg font-medium"
              style={{
                backgroundColor: business.themeColor,
                color: cartTheme.ctaText,
              }}
            >
              Continue Shopping
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {cart.map((item) => (
                <Link
                  key={item.cartItemId ?? item.productId}
              to={storefrontPath(business.slug, `products/${productSlug(item.name, item.productId)}`)}
                  className="block bg-white rounded-lg p-4 shadow-sm border hover:shadow-md transition-shadow"
                >
                  <div className="flex gap-4">
                    {/* Product Thumbnail */}
                    <div className="flex-shrink-0">
                      {productImageMap.get(item.productId) ? (
                        <img
                          src={productImageMap.get(item.productId)!}
                          alt={item.name}
                          className="w-20 h-20 rounded-lg object-cover border border-gray-200"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center">
                          <ShoppingBag className="w-8 h-8 text-gray-400" />
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 hover:text-primary">{item.name}</h3>
                      <p className="text-sm text-gray-600">₹{item.price.toFixed(2)} each</p>
                      {item.customizationNotes?.length ? (
                        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-gray-500">
                          {item.customizationNotes.map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      ) : null}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm text-gray-600">Qty: {item.quantity}</span>
                        <span className="font-medium text-gray-900">₹{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Order Summary */}
            <div className="bg-white rounded-lg p-6 shadow-sm border h-fit">
              <h2 className="text-lg font-semibold mb-4">Order Summary</h2>

              <div className="space-y-2 mb-4">
                {cart.map((item) => (
                  <div key={item.cartItemId ?? item.productId} className="flex justify-between text-sm">
                    <span>{item.name} x{item.quantity}</span>
                    <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total</span>
                  <span>₹{cartTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
