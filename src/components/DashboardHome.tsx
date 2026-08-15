import { useFirebaseQuery as useQuery } from "../lib/firebase/hooks";
import { api, type Id } from "../lib/firebase/operations";
// import { ProductManager } from "./ProductManager";
import {
  // Bell,
  ShoppingCart,
  AlertTriangle,
  BadgeDollarSign,
  ClipboardList,
  BadgeCheck,
  ShieldAlert,
  FileCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import ShareSheet from "./ShareSheet";
import whatscartLogo from "../assets/whatscart-full-logo.png";
import { staticAssetUrl } from "../lib/staticAsset";
import { storefrontUrl } from "../lib/urls";

interface Business {
  _id: Id<"businesses">;
  name: string;
  slug: string;
  themeColor: string;
  logoId?: Id<"_storage">;
  logoUrl?: string | null;
  whatsappPhone: string;
  ownerName?: string;
  businessType?: string;
  fssaiNumber?: string;
  fssaiDocId?: Id<"_storage">;
}

interface DashboardHomeProps {
  business: Business;
}

export function DashboardHome({ business }: DashboardHomeProps) {
  const navigate = useNavigate();
  const products = useQuery(api.products.getBusinessProducts, {
    businessId: business._id,
  });
  const orders = useQuery(api.orders.getBusinessOrders, {
    businessId: business._id,
  });

  const todayOrders =
    orders?.filter((o) => {
      const orderDate = new Date(o._creationTime);
      const today = new Date();
      return (
        orderDate.toDateString() === today.toDateString() &&
        o.status !== "cancelled" &&
        o.excludedFromBilling !== true
      );
    }) ?? [];

  const lowStockCount = products?.filter((p) => !p.inStock).length ?? 0;

  const totalRevenue =
    useQuery(api.analytics.getTotalRevenue, {
      businessId: business._id,
      dateRange: { type: "today" },
    }) ?? 0;

  const recentOrders = orders?.slice(0, 5) ?? [];

  const formatTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const storeUrl = storefrontUrl(business.slug);
  const isAndroid =
    typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
  const isTwa =
    isAndroid &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (typeof document !== "undefined" &&
        document.referrer.includes("android-app://")));
  const viewStoreUrl = isTwa
    ? `intent://${storeUrl.replace(/^https?:\/\//, "")}#Intent;scheme=https;package=com.android.chrome;end;`
    : storeUrl;

  const copyStoreLink = async () => {
    try {
      await navigator.clipboard.writeText(storeUrl);
      toast.success("Store link copied!");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const [shareOpen, setShareOpen] = useState(false);

  const shareStore = () => setShareOpen(true);

  return (
    <div className="px-5 pt-6 pb-10 space-y-5">
      {/* Header with Logo and Notification */}
      <div className="flex items-center justify-between">
        <img src={staticAssetUrl(whatscartLogo)} alt="WhatsCart" className="h-8" />
        {/* <button className="relative w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
          <Bell className="w-5 h-5 text-gray-600" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button> */}
      </div>

      {/* Business Verification Banner for Home Bakery */}
      {(business.businessType === "home_bakery" || !business.businessType) &&
        (business.fssaiNumber ? (
          <div className="border border-green-200 bg-green-50/80 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 shrink-0">
                <BadgeCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold text-gray-900">
                    FSSAI Business Verified
                  </p>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-green-700 bg-green-200/60 px-2 py-0.5 rounded">
                    Verified
                  </span>
                </div>
                <p className="text-xs text-gray-600">
                  Lic. No:{" "}
                  <span className="font-mono font-semibold">
                    {business.fssaiNumber}
                  </span>
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate("/dashboard/settings")}
              className="text-xs font-bold text-green-700 hover:underline px-2 py-1"
            >
              View Certificate
            </button>
          </div>
        ) : (
          <div className="border border-amber-200 bg-amber-50 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-amber-950">
                  Verify Your Bakery Business
                </p>
                <p className="text-xs text-amber-800">
                  Add your FSSAI License & Certificate to get the verified badge
                  on your store.
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate("/dashboard/settings")}
              className="shrink-0 inline-flex items-center gap-1 bg-amber-600 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-xs hover:bg-amber-700 transition"
            >
              <FileCheck className="w-3.5 h-3.5" />
              Verify Now
            </button>
          </div>
        ))}

      {/* Stat Cards Row */}
      <div className="grid grid-cols-2 gap-3">
        {/* Orders Today */}
        <button
          onClick={() => navigate("/dashboard/orders")}
          className="border border-gray-100 rounded-2xl p-4 bg-white shadow-sm text-left w-full"
        >
          <div className="flex items-center gap-2 mb-3">
            <ShoppingCart className="w-4 h-4 text-green-500" />
            <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">
              Orders Today
            </span>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {todayOrders.length}
          </p>
        </button>

        {/* Stock Alert */}
        <button
          onClick={() => navigate("/dashboard/products?filter=outofstock")}
          className="border border-gray-100 rounded-2xl p-4 bg-white shadow-sm text-left w-full"
        >
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-green-500" />
            <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">
              Stock Alert
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <p className="text-3xl font-bold text-red-500">{lowStockCount}</p>
            <span className="text-xl font-bold text-red-500">Low</span>
          </div>
        </button>
      </div>

      {/* Revenue Card */}
      <button
        onClick={() => navigate("/dashboard/profile/analytics")}
        className="border border-green-100 rounded-2xl p-4 bg-green-50 shadow-sm text-left w-full"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BadgeDollarSign className="w-4 h-4 text-green-600" />
            <span className="text-[10px] font-bold tracking-widest text-green-700 uppercase">
              Total Revenue
            </span>
          </div>
          <span className="text-[10px] font-bold tracking-wider text-green-700 border border-green-400 bg-green-100 px-2.5 py-0.5 rounded-md">
            DAILY
          </span>
        </div>
        <p className="text-3xl font-bold text-gray-900">
          ₹{totalRevenue.toLocaleString("en-IN")}
        </p>
      </button>

      {/* Store Link & Share */}
      <div className="border border-green-500/20 bg-white rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <svg
            className="w-[18px] h-[18px]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          <span className="text-sm font-medium text-green-600/80 uppercase tracking-wider">
            Store url
          </span>
        </div>
        <p className="text-base font-bold text-slate-900">{storeUrl}</p>
        <div className="flex gap-2">
          <button
            onClick={shareStore}
            className="flex-1 py-2 px-4 rounded-lg bg-slate-100 text-slate-600 font-bold text-sm flex items-center justify-center"
          >
            Share Store
          </button>
          <a
            href={viewStoreUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-2 px-4 rounded-lg bg-[#3DAC35] text-white font-bold text-sm flex items-center justify-center"
          >
            View Store
          </a>
        </div>
      </div>

      {/* Recent Orders */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">Recent Orders</h2>
          <a
            href="/dashboard/orders"
            className="text-sm font-semibold text-green-600"
          >
            View All
          </a>
        </div>

        {recentOrders.length === 0 ? (
          <div className="border border-gray-100 rounded-2xl p-6 text-center text-sm text-gray-400">
            No orders yet
          </div>
        ) : (
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <button
                key={order._id}
                onClick={() => navigate(`/dashboard/orders/${order._id}`)}
                className="border border-gray-100 rounded-2xl p-4 flex items-center gap-4 bg-white shadow-sm text-left w-full"
              >
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <ClipboardList className="w-5 h-5 text-indigo-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">
                    #{order.orderId ?? order._id.slice(-6).toUpperCase()}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {order.customerName} • {formatTimeAgo(order._creationTime)}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-gray-900 mb-1">
                    ₹{(order.totalAmount ?? 0).toFixed(2)}
                  </p>
                  <span className="text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-600 uppercase">
                    {order.status ?? "New Order"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      {/* <div className="pt-2 border-t border-gray-100">
        <h2 className="text-lg font-bold text-gray-900 mb-4">All Products</h2>
        <ProductManager
          businessId={business._id}
          businessSlug={business.slug}
          autoOpenAdd={showAddProduct}
          onAddClose={() => setShowAddProduct(false)}
        />
      </div> */}

      <ShareSheet
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        url={storeUrl}
        title={`Check out ${business.name} store`}
        businessId={business._id}
      />
    </div>
  );
}
