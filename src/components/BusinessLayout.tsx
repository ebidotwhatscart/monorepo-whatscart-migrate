import { ReactNode } from "react";
import { useLocation, Link } from "react-router-dom";
import {
  ClipboardList,
  LayoutGrid,
  Package,
  User,
} from "lucide-react";
import whatscartPoweredLogoUrl from "../assets/figma/whatscart-powered-logo.svg";
import couponIconUrl from "../assets/figma/promotions/coupon-icon.svg";

const ADMIN_ACCENT = "#3DAC35";

interface Business {
  _id: string;
  name: string;
  slug: string;
  themeColor: string;
  logoId?: string;
  logoUrl?: string | null;
  whatsappPhone: string;
}

interface BusinessLayoutProps {
  children: ReactNode;
  business: Business;
}

export function BusinessLayout({ children, business }: BusinessLayoutProps) {
  const location = useLocation();

  const hideBottomNav = (() => {
    const p = location.pathname;
    const s = location.search;
    if (p.includes("/products/view/")) return true;
    if (p.includes("/products/edit/")) return true;
    if (p.includes("/products/collections/edit/")) return true;
    if (p.startsWith("/dashboard/orders/") && p.length > "/dashboard/orders/".length) return true;
    if (p === "/dashboard/products" && s.includes("action=create")) return true;
    return false;
  })();

  const getActiveTab = () => {
    if (location.pathname.includes("/products")) return "products";
    if (location.pathname.includes("/orders")) return "orders";
    if (location.pathname.includes("/promotions")) return "promotions";
    if (location.pathname.includes("/profile")) return "profile";
    return "dashboard";
  };

  const activeTab = getActiveTab();
  const navItems: Array<{
    id: "dashboard" | "products" | "orders" | "promotions" | "profile";
    label: string;
    icon: any;
    customIcon?: string;
    to: string;
  }> = [
    { id: "dashboard", label: "Dashboard", icon: LayoutGrid, to: "/dashboard" },
    {
      id: "products",
      label: "Products",
      icon: Package,
      to: "/dashboard/products",
    },
    {
      id: "orders",
      label: "Orders",
      icon: ClipboardList,
      to: "/dashboard/orders",
    },
    {
      id: "promotions",
      label: "Promotions",
      icon: null,
      customIcon: couponIconUrl,
      to: "/dashboard/promotions",
    },
    { id: "profile", label: "Profile", icon: User, to: "/dashboard/profile" },
  ];

  return (
    <div className="min-h-screen flex justify-center">
      <div className="w-full bg-white min-h-screen flex flex-col max-w-[428px] mx-auto">
        <div className={`flex-1 ${hideBottomNav ? "" : "pb-24"}`}>{children}</div>

        <div className="fixed left-[-21px] bottom-0 scale-[0.8] z-50 hidden md:block">
          <PoweredByWhatsCartPill />
        </div>
      </div>

      {!hideBottomNav && (
        <nav className="fixed bottom-0 z-50 border-t border-slate-200 bg-white w-[428px] max-w-full left-1/2 -translate-x-1/2">
          <div className="grid grid-cols-5 px-1 py-3">
              {navItems.map(({ id, label, icon: Icon, customIcon, to }) => {
                const isActive = activeTab === id;

                return (
                  <Link
                    key={id}
                    to={to}
                    className="flex flex-col items-center justify-center gap-1.5 px-1 py-1.5 transition"
                  >
                    {Icon ? (
                      <Icon
                        className="h-6 w-6 stroke-[2.1]"
                        style={{
                          color: isActive ? ADMIN_ACCENT : "#64748B",
                        }}
                      />
                    ) : (
                      <img
                        src={customIcon}
                        alt={label}
                        className="h-6 w-6"
                        style={{
                          filter: isActive
                            ? "invert(58%) sepia(85%) saturate(415%) hue-rotate(69deg) brightness(91%) contrast(87%)"
                            : "invert(49%) sepia(16%) saturate(464%) hue-rotate(177deg) brightness(90%) contrast(92%)",
                        }}
                      />
                    )}
                    <span
                      className="text-[10.5px] font-semibold tracking-[0.04em] truncate max-w-full"
                      style={{
                        color: isActive ? ADMIN_ACCENT : "#64748B",
                      }}
                    >
                      {label.toUpperCase()}
                    </span>
                  </Link>
                );
              })}
            </div>
        </nav>
      )}
    </div>
  );
}

function PoweredByWhatsCartPill() {
  return (
    <a href="https://whatscart.in/" aria-label="Powered by WhatsCart" className="relative block h-14 w-[253px] overflow-hidden rounded-[10px] bg-black">
      <div className="absolute -left-1 -top-8 h-32 w-32 rounded-full bg-[#033500] blur-[31px]" />
      <div className="relative flex h-full items-center gap-3 px-5 text-base font-medium text-[#fafafa]">
        <span>Powered by</span>
        <span className="flex items-center gap-2">
          <img
            src={whatscartPoweredLogoUrl}
            alt="Whatscart logo"
            className="h-7 w-[22px]"
          />
          Whatscart
        </span>
      </div>
    </a>
  );
}
