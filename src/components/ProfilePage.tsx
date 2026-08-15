import { useFirebaseQuery as useQuery } from "../lib/firebase/hooks";
import { api, type Id } from "../lib/firebase/operations";
import { storefrontUrl } from "../lib/urls";
import { Link, useNavigate } from "react-router-dom";
import { useFirebaseAuth } from "../lib/firebase/auth-context";
import { useState } from "react";
import {
  Settings,
  User,
  Bell,
  HelpCircle,
  FileText,
  LogOut,
  ChevronRight,
  Store,
  ShoppingBag,
  LayoutDashboard,
  Package,
  TrendingUp,
} from "lucide-react";
import {
  formatCurrency,
  type DateRange,
  type DateRangeType,
} from "../lib/analytics";

type PresetDateRangeType = Exclude<DateRangeType, "custom">;

interface BrandPalette {
  seedColor: string;
  mode: "light" | "dark";
  colors: string[];
  primaryColor: string;
}

interface Business {
  _id: Id<"businesses">;
  name: string;
  slug: string;
  themeColor: string;
  brandPalette?: BrandPalette;
  logoId?: Id<"_storage">;
  logoUrl?: string | null;
  whatsappPhone: string;
  description?: string;
  businessType?: string;
}

interface ProfilePageProps {
  business: Business;
}

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
}

function MenuItem({ icon, label, onClick, href, danger }: MenuItemProps) {
  const content = (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <div className={`${danger ? "text-red-500" : "text-slate-500"}`}>
          {icon}
        </div>
        <span
          className={`text-sm font-semibold ${
            danger ? "text-red-500" : "text-slate-700"
          }`}
        >
          {label}
        </span>
      </div>
      {!danger && <ChevronRight className="w-4 h-4 text-slate-400" />}
    </div>
  );

  if (href) {
    return (
      <Link to={href} className="block">
        {content}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className="w-full text-left">
      {content}
    </button>
  );
}

function BottomNavItem({
  icon,
  label,
  href,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
  active?: boolean;
}) {
  return (
    <Link
      to={href}
      className={`flex flex-col items-center gap-1 ${
        active ? "text-green-500" : "text-slate-500"
      }`}
    >
      {icon}
      <span className="text-[10px] font-medium uppercase tracking-wider">
        {label}
      </span>
    </Link>
  );
}

export function ProfilePage({ business }: ProfilePageProps) {
  const navigate = useNavigate();
  const { signOut } = useFirebaseAuth();
  const orders = useQuery(api.orders.getBusinessOrders, {
    businessId: business._id,
  });

  const [dateRange, setDateRange] = useState<DateRange>({ type: "7days" });

  const visitors = useQuery(api.analytics.getTotalVisitors, {
    businessId: business._id,
    dateRange,
  });
  const pageViews = useQuery(api.analytics.getTotalPageViews, {
    businessId: business._id,
    dateRange,
  });
  const revenue = useQuery(api.analytics.getTotalRevenue, {
    businessId: business._id,
    dateRange,
  });

  const handleLogout = () => {
    signOut();
  };

  const totalOrders =
    orders?.filter(
      (order) =>
        order.status !== "cancelled" && order.excludedFromBilling !== true,
    ).length || 0;

  const SupportTemplate = encodeURIComponent(
    `Hello! I need support in whatsCart. My Business Name is ${business.name}.\n My registered number is ${business?.whatsappPhone}.\n My Business Type is ${business?.businessType}.\n My Store URL is ${storefrontUrl(business.slug)}.\n Could you please help me with this issue?.\n\nIssue Description:\n\n`,
  );

  return (
    <div className="min-h-screen bg-slate-100 pb-20">
      {/* Header with gradient background */}
      <div className="bg-green-500 px-5 pt-10 pb-16 rounded-b-[24px]">
        {/* Business Info */}
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center overflow-hidden">
            {business.logoUrl ? (
              <img
                src={business.logoUrl}
                alt={business.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Store className="w-6 h-6 text-slate-400" />
            )}
          </div>

          {/* Business details */}
          <div>
            <h1 className="text-xl font-bold text-white">{business.name}</h1>
            <div className="flex items-center gap-1.5 text-white/70 text-sm font-medium mt-0.5">
              <span>{business.businessType || "Business"}</span>
              <span className="text-white/50">|</span>
              <span>{totalOrders} orders</span>
            </div>
          </div>
        </div>
      </div>

      {/* Menu Cards */}
      <div className="px-5 -mt-8 space-y-4">
        {/* Website Insights Card */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700">
              Your website insights
            </h2>
            <select
              value={dateRange.type}
              onChange={(e) =>
                setDateRange({ type: e.target.value as PresetDateRangeType })
              }
              className="text-xs border rounded-lg px-2 py-1 bg-slate-50"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="7days">7 days</option>
              <option value="30days">30 days</option>
              <option value="alltime">All time</option>
            </select>
          </div>
          <div className="flex justify-between">
            <div className="text-center">
              <p className="text-lg font-bold text-slate-700">
                {visitors ?? "-"}
              </p>
              <p className="text-xs text-slate-500">Visitors</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-slate-700">
                {pageViews ?? "-"}
              </p>
              <p className="text-xs text-slate-500">Page Views</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-slate-700">
                {formatCurrency(revenue ?? 0)}
              </p>
              <p className="text-xs text-slate-500">Revenue</p>
            </div>
          </div>
        </div>

        {/* Settings Menu Card */}
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-1">
          {/* Store Settings */}
          <MenuItem
            icon={<Settings className="w-5 h-5" />}
            label="Store settings"
            href="/dashboard/profile/settings"
          />

          {/* Analytics */}
          <MenuItem
            icon={<TrendingUp className="w-5 h-5" />}
            label="Analytics"
            href="/dashboard/profile/analytics"
          />

          <div className="border-t border-slate-100 my-1" />

          {/* Admin Profile */}
          <MenuItem
            icon={<User className="w-5 h-5" />}
            label="Admin profile"
            onClick={() => navigate("/dashboard/profile/admin")}
          />

          <div className="border-t border-slate-100 my-1" />

          {/* Notifications */}
          {/* <MenuItem
            icon={<Bell className="w-5 h-5" />}
            label="Notifications"
            onClick={() => {}}
          /> */}

          {/* <div className="border-t border-slate-100 my-1" /> */}

          {/* Support */}
          <MenuItem
            icon={<HelpCircle className="w-5 h-5" />}
            label="Support"
            onClick={() => {
              const whatsappUrl = `https://wa.me/916381631017?text=${SupportTemplate}`;
              window.open(whatsappUrl, "_blank");
            }}
          />

          <div className="border-t border-slate-100 my-1" />

          {/* About & Legal */}
          {/* <MenuItem
            icon={<FileText className="w-5 h-5" />}
            label="About & Legal"
            onClick={() => {}}
          /> */}

          {/* <div className="border-t border-slate-100 my-1" /> */}

          {/* Logout */}
          <MenuItem
            icon={<LogOut className="w-5 h-5" />}
            label="Logout"
            onClick={handleLogout}
            danger
          />
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 bg-white border-t border-slate-100 px-4 py-3 w-[428px] max-w-full left-1/2 -translate-x-1/2">
        <div className="flex justify-between items-center">
          <BottomNavItem
            icon={<LayoutDashboard className="w-6 h-6" />}
            label="Dashboard"
            href="/dashboard"
          />
          <BottomNavItem
            icon={<Package className="w-6 h-6" />}
            label="Products"
            href="/dashboard/products"
          />
          <BottomNavItem
            icon={<ShoppingBag className="w-6 h-6" />}
            label="Orders"
            href="/dashboard/orders"
          />
          <BottomNavItem
            icon={<User className="w-6 h-6" />}
            label="Profile"
            href="/dashboard/profile"
            active
          />
        </div>
      </div>
    </div>
  );
}
