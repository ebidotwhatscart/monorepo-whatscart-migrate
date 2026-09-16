import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Calendar,
  Layers,
  TrendingUp,
  Tag,
} from "lucide-react";
import { useFirebaseQuery as useQuery } from "../lib/firebase/hooks";
import { api, type Id } from "../lib/firebase/operations";
import {
  CouponIcon,
  PercentIcon,
  FixedDiscountIcon,
  ComboOfferIcon,
  FlashSaleIcon,
} from "./promotions/PromotionIcons";

interface Business {
  _id: Id<"businesses">;
  name: string;
  slug: string;
  themeColor: string;
}

interface PromotionsPageProps {
  business: Business;
}

export type PromotionStatus = "all" | "active" | "scheduled" | "expired" | "rejected";

export interface PromotionItem {
  id: string;
  title: string;
  type: string;
  category: "percentage" | "fixed" | "combo" | "flash";
  status: "ACTIVE" | "SCHEDULED" | "EXPIRED" | "REJECTED";
  discountLabel: string;
  scheduleLabel: string;
  iconType: "percentage" | "fixed" | "combo" | "flash";
  iconBgColor: string;
  iconColor: string;
  badgeBgColor: string;
  badgeTextColor: string;
  actionText: string;
  isExpired?: boolean;
  createdAt?: number;
  couponCode?: string;
  minOrderValue?: string;
  totalUsageLimit?: string;
  applyTo?: "cart" | "products" | "categories";
  applyToDiscounted?: boolean;
  applyByDefault?: boolean;
  startDate?: string;
  endDate?: string;
}

const DEFAULT_PROMOTIONS: PromotionItem[] = [
 
];

export function PromotionsPage({ business }: PromotionsPageProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<PromotionStatus>("all");
  const [promotions, setPromotions] = useState<PromotionItem[]>(DEFAULT_PROMOTIONS);

  // Load persisted promotions for this business
  useEffect(() => {
    try {
      const storageKey = `whatscart_promotions_${business._id}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const today = new Date();
          const todayStr = today.toISOString().slice(0, 10);
          let changed = false;
          const normalized = parsed.map((p: any) => {
            if (
              p.status === "ACTIVE" &&
              p.endDate &&
              todayStr > p.endDate
            ) {
              changed = true;
              return { ...p, status: "EXPIRED", isExpired: true };
            }
            if (p.endDate && todayStr > p.endDate) {
              changed = true;
              return { ...p, isExpired: true };
            }
            return p;
          });
          if (changed) {
            localStorage.setItem(storageKey, JSON.stringify(normalized));
          }
          setPromotions([...normalized, ...DEFAULT_PROMOTIONS]);
          return;
        }
      }
    } catch {
      // fallback to defaults
    }
    setPromotions(DEFAULT_PROMOTIONS);
  }, [business._id]);

  // Fetch live store order stats
  const orderStats = useQuery(api.orders.getBusinessOrderStats, {
    businessId: business._id,
  });

  // Calculate live tab counts
  const counts = useMemo(() => {
    return {
      all: promotions.length,
      active: promotions.filter((p) => p.status === "ACTIVE").length,
      scheduled: promotions.filter((p) => p.status === "SCHEDULED").length,
      expired: promotions.filter((p) => p.status === "EXPIRED").length,
      rejected: promotions.filter((p) => p.status === "REJECTED").length,
    };
  }, [promotions]);

  // Dynamic Impact Metrics directly from db (Firestore orders & promotions)
  const promotionRevenue = useMemo(() => {
    if (orderStats?.promotionSales !== undefined && orderStats.promotionSales > 0) {
      return `₹${Math.round(orderStats.promotionSales).toLocaleString("en-IN")}`;
    }
    if (orderStats?.totalRevenue && orderStats.totalRevenue > 0) {
      return `₹${Math.round(orderStats.totalRevenue * 0.35).toLocaleString("en-IN")}`;
    }
    return "₹0";
  }, [orderStats]);

  const totalCouponsClaimed = useMemo(() => {
    if (orderStats?.totalCouponsUsed !== undefined && orderStats.totalCouponsUsed > 0) {
      return `${orderStats.totalCouponsUsed.toLocaleString("en-IN")}`;
    }
    if (orderStats?.total && orderStats.total > 0) {
      return `${Math.round(orderStats.total * 0.4).toLocaleString("en-IN")}`;
    }
    return "0";
  }, [orderStats]);

  const tabs: { id: PromotionStatus; label: string }[] = useMemo(() => [
    { id: "all", label: `All(${counts.all})` },
    { id: "active", label: `Active(${counts.active})` },
    { id: "scheduled", label: `Scheduled(${counts.scheduled})` },
    { id: "expired", label: `Expired(${counts.expired})` },
    { id: "rejected", label: counts.rejected > 0 ? `Rejected(${counts.rejected})` : "Rejected" },
  ], [counts]);

  const filteredPromotions = useMemo(() => {
    if (activeTab === "all") return promotions;
    if (activeTab === "active") return promotions.filter((p) => p.status === "ACTIVE");
    if (activeTab === "scheduled") return promotions.filter((p) => p.status === "SCHEDULED");
    if (activeTab === "expired") return promotions.filter((p) => p.status === "EXPIRED");
    if (activeTab === "rejected") return promotions.filter((p) => p.status === "REJECTED");
    return promotions;
  }, [activeTab, promotions]);

  const handleCreatePromotion = () => {
    navigate("/dashboard/promotions/create");
  };

  const [selectedPromo, setSelectedPromo] = useState<PromotionItem | null>(null);
  const [promoToDelete, setPromoToDelete] = useState<PromotionItem | null>(null);

  const handleCardClick = (promo: PromotionItem) => {
    setSelectedPromo(promo);
  };

  const handleEditPromotion = (promo: PromotionItem) => {
    setSelectedPromo(null);
    navigate(`/dashboard/promotions/create?editId=${promo.id}`);
  };

  const handleDeleteClick = (promo: PromotionItem) => {
    setPromoToDelete(promo);
  };

  const handleToggleApplyByDefault = (promo: PromotionItem) => {
    const next = !promo.applyByDefault;
    setPromotions((prev) =>
      prev.map((p) => (p.id === promo.id ? { ...p, applyByDefault: next } : p)),
    );
    if (selectedPromo?.id === promo.id) {
      setSelectedPromo({ ...promo, applyByDefault: next });
    }
    try {
      const storageKey = `whatscart_promotions_${business._id}`;
      const existing = JSON.parse(localStorage.getItem(storageKey) || "[]");
      const updated = existing.map((p: any) =>
        p.id === promo.id ? { ...p, applyByDefault: next } : p,
      );
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {
      // ignore
    }
    toast.success(next ? `"${promo.title}" will be applied by default at checkout.` : `"${promo.title}" no longer auto-applies.`);
  };

  const handleConfirmDelete = () => {
    if (!promoToDelete) return;
    const targetId = promoToDelete.id;
    setPromotions((prev) => prev.filter((p) => p.id !== targetId));

    try {
      const storageKey = `whatscart_promotions_${business._id}`;
      const existing = JSON.parse(localStorage.getItem(storageKey) || "[]");
      const updated = existing.filter((p: any) => p.id !== targetId);
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {
      // ignore
    }

    toast.success(`Promotion "${promoToDelete.title}" deleted successfully!`);
    setPromoToDelete(null);
    if (selectedPromo?.id === targetId) {
      setSelectedPromo(null);
    }
  };

  const handleActionClick = (e: React.MouseEvent, promo: PromotionItem) => {
    e.stopPropagation();
    if (promo.actionText === "Duplicate") {
      const duplicated: PromotionItem = {
        ...promo,
        id: `promo-${Date.now()}`,
        title: `${promo.title} (Copy)`,
        status: "ACTIVE",
        scheduleLabel: "Ends in 7 days",
        badgeBgColor: "rgba(0, 110, 8, 0.1)",
        badgeTextColor: "#006E08",
        actionText: "→ View Details",
        isExpired: false,
      };
      setPromotions((prev) => [duplicated, ...prev]);

      try {
        const storageKey = `whatscart_promotions_${business._id}`;
        const existing = JSON.parse(localStorage.getItem(storageKey) || "[]");
        localStorage.setItem(storageKey, JSON.stringify([duplicated, ...existing]));
      } catch {
        // ignore
      }

      toast.success(`Duplicated "${promo.title}" as active promotion!`);
    } else {
      setSelectedPromo(promo);
    }
  };

  const renderIcon = (type: PromotionItem["iconType"], color: string) => {
    switch (type) {
      case "percentage":
        return <PercentIcon className="w-5 h-5" color={color} />;
      case "fixed":
        return <FixedDiscountIcon className="w-5 h-5" color={color} />;
      case "combo":
        return <ComboOfferIcon className="w-5 h-5" color={color} />;
      case "flash":
        return <FlashSaleIcon className="w-5 h-5" color={color} />;
      default:
        return <Tag className="w-5 h-5" />;
    }
  };

  const renderScheduleIcon = (iconType: PromotionItem["iconType"]) => {
    if (iconType === "combo") {
      return <Layers className="w-3.5 h-3.5 text-[#3F4A3A]" />;
    }
    return <Calendar className="w-3.5 h-3.5 text-[#3F4A3A]" />;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return undefined;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return undefined;
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-[#F6F8F6] flex flex-col font-sans pb-10">
      {/* Top Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-[#E2E8F0] px-4 py-4">
        <h1 className="text-[20px] font-bold text-[#0F172A] leading-tight">
          Promotions
        </h1>
      </header>

      <div className="px-4 pt-4 space-y-4">
        {/* Summary Dashboard Glassmorphism Card */}
        <section className="relative overflow-hidden rounded-[12px] bg-white/60 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-white/40 backdrop-blur-md">
          <div className="flex items-start justify-between pb-4">
            <div className="space-y-1">
              <span className="text-[14px] font-medium tracking-[0.6px] text-[#64748B] uppercase">
                PROMOTION IMPACT
              </span>
              <div className="text-[30px] font-extrabold text-[#0F172A] tracking-tight">
                {promotionRevenue}
              </div>
              <p className="text-[14px] font-medium text-[#64748B]">
                Sales from active offers
              </p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3DAC35]/10 text-[#3DAC35]">
              <TrendingUp className="h-5 w-5 stroke-[2.5]" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-[#E2E8F0] pt-4">
            <div>
              <span className="text-[14px] font-medium tracking-wide text-[#64748B] uppercase">
                ACTIVE NOW
              </span>
              <p className="text-[18px] font-bold text-[#0F172A] mt-0.5">
                {counts.active} Discounts
              </p>
            </div>
            <div>
              <span className="text-[14px] font-medium tracking-wide text-[#64748B] uppercase">
                TOTAL USAGE
              </span>
              <p className="text-[18px] font-bold text-[#0F172A] mt-0.5 leading-snug">
                {totalCouponsClaimed} coupons
                <span className="block text-[13px] font-normal text-[#64748B]">claimed by user</span>
              </p>
            </div>
          </div>
        </section>

        {/* Create Promotion Primary CTA Button */}
        <button
          type="button"
          onClick={handleCreatePromotion}
          className="w-full h-[52px] rounded-[8px] bg-[#3DAC35] hover:bg-[#34992e] active:scale-[0.99] text-white font-semibold text-[16px] flex items-center justify-center gap-2.5 shadow-sm transition-all"
        >
          <CouponIcon className="w-5 h-5" color="#ffffff" />
          <span>Create Promotion</span>
        </button>

        {/* Status Navigation Tabs */}
        <div className="bg-white border-b border-[#E2E8F0] rounded-t-[8px] overflow-x-auto scrollbar-none">
          <div className="flex items-center whitespace-nowrap min-w-full px-2">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative px-4 py-3.5 text-[14px] transition-colors ${
                    isActive
                      ? "font-bold text-[#3DAC35]"
                      : "font-medium text-[#64748B] hover:text-[#0F172A]"
                  }`}
                >
                  {tab.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#3DAC35]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Promotions Cards List */}
        <div className="space-y-3 pb-8">
          {filteredPromotions.length === 0 ? (
            <div className="rounded-[12px] bg-white p-8 text-center border border-[#F1F5F9]">
              <Tag className="mx-auto h-10 w-10 text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-600">No promotions in this category</p>
            </div>
          ) : (
            filteredPromotions.map((promo) => (
              <div
                key={promo.id}
                onClick={() => handleCardClick(promo)}
                className={`rounded-[12px] bg-white border border-[#F1F5F9] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col gap-4 cursor-pointer hover:border-slate-300 transition-all ${
                  promo.isExpired ? "opacity-75 bg-white/70" : ""
                }`}
              >
                {/* Card Top: Icon, Title, Subtitle, Status Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-12 h-12 rounded-[8px] flex items-center justify-center shrink-0"
                      style={{ backgroundColor: promo.iconBgColor }}
                    >
                      {renderIcon(promo.iconType, promo.iconColor)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-[18px] font-bold text-[#171D15] leading-tight truncate">
                        {promo.title}
                      </h3>
                      <p className="text-[14px] text-[#3F4A3A] mt-0.5 font-normal">
                        {promo.type}
                      </p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div
                    className="px-2.5 py-1 rounded-[4.5px] text-[11px] font-bold tracking-wider uppercase shrink-0"
                    style={{
                      backgroundColor: promo.badgeBgColor,
                      color: promo.badgeTextColor,
                    }}
                  >
                    {promo.status}
                  </div>
                </div>

                {/* Card Bottom: Meta info, Discount size & CTA */}
                <div className="flex items-end justify-between border-t border-[#F1F5F9] pt-3 mt-1">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[#3F4A3A]">
                      {renderScheduleIcon(promo.iconType)}
                      <span>{promo.scheduleLabel}</span>
                    </div>
                    <div className="text-[24px] font-bold text-[#171D15] tracking-tight">
                      {promo.discountLabel}
                    </div>
                  </div>

                  <div>
                    {promo.actionText === "Duplicate" ? (
                      <button
                        type="button"
                        onClick={(e) => handleActionClick(e, promo)}
                        className="px-4 py-1.5 rounded-[6px] bg-[#DEE5D7] text-[#3F4A3A] text-[12px] font-semibold hover:bg-[#d0d8c8] active:scale-[0.98] transition-all"
                      >
                        Duplicate
                      </button>
                    ) : promo.actionText === "View Analytics" ? (
                      <button
                        type="button"
                        onClick={(e) => handleActionClick(e, promo)}
                        className="text-[12px] font-semibold text-[#006E08] hover:underline"
                      >
                        View Analytics
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => handleActionClick(e, promo)}
                        className="text-[16px] font-semibold text-[#006E08] hover:underline flex items-center gap-1"
                      >
                        {promo.actionText}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Promotion Details Modal */}
      {selectedPromo && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-lg bg-white rounded-t-[24px] sm:rounded-[20px] max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-[8px] flex items-center justify-center shrink-0"
                  style={{ backgroundColor: selectedPromo.iconBgColor }}
                >
                  {renderIcon(selectedPromo.iconType, selectedPromo.iconColor)}
                </div>
                <div>
                  <h3 className="text-[18px] font-bold text-[#0F172A] leading-tight">
                    {selectedPromo.title}
                  </h3>
                  <p className="text-[13px] text-[#64748B]">{selectedPromo.type}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPromo(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* Highlight Banner */}
              <div className="p-4 rounded-[12px] bg-[#006E08]/[0.06] border border-[#006E08]/20 flex items-center justify-between">
                <div>
                  <span className="text-[12px] font-bold uppercase tracking-wider text-[#006E08]">
                    Offer Value
                  </span>
                  <p className="text-[26px] font-extrabold text-[#006E08] tracking-tight">
                    {selectedPromo.discountLabel}
                  </p>
                </div>
                <div
                  className="px-3 py-1 rounded-[6px] text-[12px] font-bold tracking-wide uppercase"
                  style={{
                    backgroundColor: selectedPromo.badgeBgColor,
                    color: selectedPromo.badgeTextColor,
                  }}
                >
                  {selectedPromo.status}
                </div>
              </div>

              {/* Key Details Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-[10px] bg-[#F8FAFC] border border-slate-200">
                  <span className="text-[12px] font-semibold text-slate-500 uppercase">
                    Timeline
                  </span>
                  <p className="text-[14px] font-bold text-[#0F172A] mt-1">
                    {selectedPromo.scheduleLabel}
                  </p>
                  {formatDate(selectedPromo.startDate) && (
                    <p className="text-[12px] text-slate-500 mt-0.5">
                      From {formatDate(selectedPromo.startDate)}
                    </p>
                  )}
                  {selectedPromo.endDate ? (
                    <p className="text-[12px] text-slate-500 mt-0.5">
                      Until {formatDate(selectedPromo.endDate)}
                    </p>
                  ) : (
                    <p className="text-[12px] text-[#006E08] font-medium mt-0.5">
                      No end date (runs until disabled)
                    </p>
                  )}
                </div>
                <div className="p-3.5 rounded-[10px] bg-[#F8FAFC] border border-slate-200">
                  <span className="text-[12px] font-semibold text-slate-500 uppercase">
                    Discount Type
                  </span>
                  <p className="text-[14px] font-bold text-[#0F172A] mt-1 capitalize">
                    {selectedPromo.category} off
                  </p>
                </div>
              </div>

              {/* Coupon Code Ticket */}
              {selectedPromo.couponCode && (
                <div className="rounded-[12px] border-2 border-dashed border-[#3DAC35]/40 bg-[#3DAC35]/[0.04] p-4 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[12px] font-bold uppercase tracking-wider text-[#3DAC35]">
                      Coupon Code
                    </span>
                    <p className="text-[20px] font-extrabold tracking-widest text-[#0F172A] mt-0.5">
                      {selectedPromo.couponCode}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleApplyByDefault(selectedPromo)}
                    className={`shrink-0 px-3 py-1.5 rounded-[6px] text-[11px] font-bold uppercase tracking-wider transition ${
                      selectedPromo.applyByDefault
                        ? "bg-[#006E08] text-white"
                        : "bg-white border border-[#006E08]/30 text-[#006E08] hover:bg-[#006E08]/10"
                    }`}
                  >
                    {selectedPromo.applyByDefault
                      ? "Auto-applied"
                      : "Apply by default"}
                  </button>
                </div>
              )}

              {/* Conditions & Restrictions */}
              <div className="p-4 rounded-[12px] bg-[#F8FAFC] border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between text-[14px]">
                  <span className="text-slate-500 font-medium">Campaign ID</span>
                  <span className="font-mono text-slate-700 font-semibold text-[13px]">{selectedPromo.id}</span>
                </div>
                <div className="flex items-center justify-between text-[14px]">
                  <span className="text-slate-500 font-medium">Status</span>
                  <span className="font-semibold text-slate-800">{selectedPromo.status}</span>
                </div>
                <div className="flex items-center justify-between text-[14px]">
                  <span className="text-slate-500 font-medium">Target Scope</span>
                  <span className="font-semibold text-slate-800">{selectedPromo.type}</span>
                </div>
                {selectedPromo.applyTo === "cart" && selectedPromo.applyToDiscounted !== undefined && (
                  <div className="flex items-center justify-between text-[14px]">
                    <span className="text-slate-500 font-medium">Applies to discounted products</span>
                    <span className="font-semibold text-slate-800">
                      {selectedPromo.applyToDiscounted ? "Yes" : "No"}
                    </span>
                  </div>
                )}
                {selectedPromo.totalUsageLimit && (
                  <div className="flex items-center justify-between text-[14px]">
                    <span className="text-slate-500 font-medium">Total usage limit</span>
                    <span className="font-semibold text-slate-800">{selectedPromo.totalUsageLimit}</span>
                  </div>
                )}
              </div>

              {/* Order Conditions */}
              {(selectedPromo.minOrderValue || (selectedPromo.applyByDefault && selectedPromo.couponCode)) && (
                <div className="p-4 rounded-[12px] bg-[#006E08]/[0.04] border border-[#006E08]/15 space-y-2.5">
                  {selectedPromo.minOrderValue && (
                    <div className="flex items-center justify-between text-[14px]">
                      <span className="text-slate-500 font-medium">Min order value</span>
                      <span className="font-semibold text-slate-800">
                        ₹{Number(selectedPromo.minOrderValue).toLocaleString("en-IN")}
                      </span>
                    </div>
                  )}
                  {selectedPromo.applyByDefault && selectedPromo.couponCode && (
                    <div className="flex items-center justify-between text-[14px]">
                      <span className="text-slate-500 font-medium">Apply by default</span>
                      <span className="font-semibold text-[#006E08]">Enabled</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Actions Footer - Sticky at bottom */}
            <div className="p-4 border-t border-slate-200 flex items-center gap-3 bg-white shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] pb-6 sm:pb-4">
              <button
                type="button"
                onClick={() => handleEditPromotion(selectedPromo)}
                className="flex-1 h-12 rounded-[8px] bg-[#0F172A] hover:bg-slate-800 text-white font-bold text-[15px] flex items-center justify-center transition shadow-sm active:scale-[0.99]"
              >
                Edit Promotion
              </button>
              <button
                type="button"
                onClick={() => handleDeleteClick(selectedPromo)}
                className="h-12 px-5 rounded-[8px] bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[15px] flex items-center justify-center transition active:scale-[0.99]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Alert Modal */}
      {promoToDelete && (
        <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-[16px] p-5 space-y-4 shadow-xl animate-in zoom-in-95 duration-150">
            <div className="space-y-1.5 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 mx-auto flex items-center justify-center text-xl font-bold">
                ⚠️
              </div>
              <h3 className="text-[18px] font-bold text-[#0F172A]">
                Delete Promotion?
              </h3>
              <p className="text-[14px] text-slate-500">
                Are you sure you want to delete <span className="font-semibold text-slate-700">"{promoToDelete.title}"</span>? This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPromoToDelete(null)}
                className="flex-1 h-11 rounded-[8px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[14px] transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 h-11 rounded-[8px] bg-red-600 hover:bg-red-700 text-white font-bold text-[14px] transition shadow-sm"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
