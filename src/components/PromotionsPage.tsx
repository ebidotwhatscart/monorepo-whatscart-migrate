import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Calendar,
  Layers,
  TrendingUp,
  Tag,
} from "lucide-react";
import type { Id } from "../lib/firebase/operations";
import couponIconUrl from "../assets/figma/promotions/coupon-icon.svg";
import percentIconUrl from "../assets/figma/promotions/percent-icon.svg";
import fixedIconUrl from "../assets/figma/promotions/fixed-icon.svg";
import comboIconUrl from "../assets/figma/promotions/combo-icon.svg";
import flashIconUrl from "../assets/figma/promotions/flash-icon.svg";

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
}

const INITIAL_PROMOTIONS: PromotionItem[] = [
  {
    id: "promo-1",
    title: "Summer Harvest Sale",
    type: "Percentage Off",
    category: "percentage",
    status: "ACTIVE",
    discountLabel: "15% OFF",
    scheduleLabel: "Ends 30 Aug 2024",
    iconType: "percentage",
    iconBgColor: "rgba(0, 110, 8, 0.1)",
    iconColor: "#006E08",
    badgeBgColor: "rgba(0, 110, 8, 0.1)",
    badgeTextColor: "#006E08",
    actionText: "→ View Details",
  },
  {
    id: "promo-2",
    title: "Festival Weekend",
    type: "Fixed Amount Discount",
    category: "fixed",
    status: "SCHEDULED",
    discountLabel: "₹500 OFF",
    scheduleLabel: "Starts 15 Sep 2024",
    iconType: "fixed",
    iconBgColor: "rgba(218, 226, 253, 0.3)",
    iconColor: "#565E74",
    badgeBgColor: "#FEF3C7",
    badgeTextColor: "#B45309",
    actionText: "→ View Details",
  },
  {
    id: "promo-3",
    title: "Organic Combo Deal",
    type: "Bundle Offer",
    category: "combo",
    status: "ACTIVE",
    discountLabel: "Save ₹200",
    scheduleLabel: "Applies to 3 items",
    iconType: "combo",
    iconBgColor: "rgba(247, 97, 158, 0.1)",
    iconColor: "#AE2665",
    badgeBgColor: "rgba(0, 110, 8, 0.1)",
    badgeTextColor: "#006E08",
    actionText: "View Analytics",
  },
  {
    id: "promo-4",
    title: "Early Monsoon Drop",
    type: "Flash Sale",
    category: "flash",
    status: "EXPIRED",
    discountLabel: "10% OFF",
    scheduleLabel: "Ended 01 Jul 2024",
    iconType: "flash",
    iconBgColor: "#D5DCCE",
    iconColor: "#3F4A3A",
    badgeBgColor: "#DEE5D7",
    badgeTextColor: "#3F4A3A",
    actionText: "Duplicate",
    isExpired: true,
  },
];

export function PromotionsPage({ business }: PromotionsPageProps) {
  const [activeTab, setActiveTab] = useState<PromotionStatus>("all");
  const [promotions, setPromotions] = useState<PromotionItem[]>(INITIAL_PROMOTIONS);

  const tabs: { id: PromotionStatus; label: string }[] = [
    { id: "all", label: "All(20)" },
    { id: "active", label: "Active(12)" },
    { id: "scheduled", label: "Scheduled(5)" },
    { id: "expired", label: "Expired(8)" },
    { id: "rejected", label: "Rejected" },
  ];

  const filteredPromotions = useMemo(() => {
    if (activeTab === "all") return promotions;
    if (activeTab === "active") return promotions.filter((p) => p.status === "ACTIVE");
    if (activeTab === "scheduled") return promotions.filter((p) => p.status === "SCHEDULED");
    if (activeTab === "expired") return promotions.filter((p) => p.status === "EXPIRED");
    if (activeTab === "rejected") return promotions.filter((p) => p.status === "REJECTED");
    return promotions;
  }, [activeTab, promotions]);

  const handleCreatePromotion = () => {
    toast.info("Promotion builder coming soon!");
  };

  const handleActionClick = (promo: PromotionItem) => {
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
      toast.success(`Duplicated "${promo.title}" as active promotion!`);
    } else {
      toast.info(`Opened details for "${promo.title}"`);
    }
  };

  const renderIcon = (type: PromotionItem["iconType"]) => {
    switch (type) {
      case "percentage":
        return <img src={percentIconUrl} alt="Percentage" className="w-5 h-5" />;
      case "fixed":
        return <img src={fixedIconUrl} alt="Fixed Discount" className="w-5 h-5" />;
      case "combo":
        return <img src={comboIconUrl} alt="Combo Offer" className="w-5 h-5" />;
      case "flash":
        return <img src={flashIconUrl} alt="Flash Sale" className="w-5 h-5" />;
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
                ₹48,250
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
                12 Discounts
              </p>
            </div>
            <div>
              <span className="text-[14px] font-medium tracking-wide text-[#64748B] uppercase">
                TOTAL USAGE
              </span>
              <p className="text-[18px] font-bold text-[#0F172A] mt-0.5 leading-snug">
                1,240 coupons
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
          <img src={couponIconUrl} alt="Coupon" className="w-5 h-5 invert brightness-0" />
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
                className={`rounded-[12px] bg-white border border-[#F1F5F9] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col gap-4 transition-all ${
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
                      {renderIcon(promo.iconType)}
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
                        onClick={() => handleActionClick(promo)}
                        className="px-4 py-1.5 rounded-[6px] bg-[#DEE5D7] text-[#3F4A3A] text-[12px] font-semibold hover:bg-[#d0d8c8] active:scale-[0.98] transition-all"
                      >
                        Duplicate
                      </button>
                    ) : promo.actionText === "View Analytics" ? (
                      <button
                        type="button"
                        onClick={() => handleActionClick(promo)}
                        className="text-[12px] font-semibold text-[#006E08] hover:underline"
                      >
                        View Analytics
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleActionClick(promo)}
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
    </div>
  );
}
