import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { Id } from "../lib/firebase/operations";
import {
  BackArrowIcon,
  FixedDiscountIcon,
  PercentIcon,
  InfoLockIcon,
} from "./promotions/PromotionIcons";

interface Business {
  _id: Id<"businesses">;
  name: string;
  slug: string;
  themeColor: string;
}

interface CreatePromotionPageProps {
  business: Business;
}

export type DiscountType = "flat" | "percentage";
export type ApplyToTarget = "cart" | "products" | "categories";

export function CreatePromotionPage({ business }: CreatePromotionPageProps) {
  const navigate = useNavigate();
  
  // Multi-step state (Step 1 -> Step 2)
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  // Step 1: Discount Type
  const [selectedType, setSelectedType] = useState<DiscountType>("flat");

  // Step 2: Form fields
  const [promotionName, setPromotionName] = useState("");
  const [applyTo, setApplyTo] = useState<ApplyToTarget>("cart");
  const [applyToDiscounted, setApplyToDiscounted] = useState<boolean>(true);
  const [discountValue, setDiscountValue] = useState("0");
  const [couponCode, setCouponCode] = useState("");
  const [totalUsageLimit, setTotalUsageLimit] = useState("");
  const [minOrderValue, setMinOrderValue] = useState("");

  const handleBack = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
    } else {
      navigate("/dashboard/promotions");
    }
  };

  const handleStep1Next = () => {
    setCurrentStep(2);
  };

  const handleStep2Submit = () => {
    if (!promotionName.trim()) {
      toast.error("Please enter a promotion name");
      return;
    }
    if (!discountValue || discountValue === "0") {
      toast.error("Please specify the discount value");
      return;
    }
    toast.success(`Promotion "${promotionName}" created successfully!`);
    navigate("/dashboard/promotions");
  };

  return (
    <div className="min-h-screen bg-[#F6F8F6] flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="sticky top-0 z-20 bg-white border-b border-[#F1F5F9] px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-slate-100 active:scale-95 transition-all text-[#0F172A]"
            aria-label="Go back"
          >
            <BackArrowIcon className="w-4 h-4" color="#0F172A" />
          </button>
          <h1 className="text-[18px] font-bold text-[#0F172A] leading-none">
            Create Promotion
          </h1>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-1.5 text-[#0F172A]">
          <span className="text-[14px] font-bold">Step</span>
          <span className="text-[18px] font-bold">{currentStep} / 2</span>
        </div>
      </header>

      {/* STEP 1: Select Discount Type */}
      {currentStep === 1 && (
        <main className="flex-1 p-4 flex flex-col justify-between max-w-full">
          <div className="space-y-4">
            {/* Section Heading */}
            <div className="pt-1">
              <h2 className="text-[18px] font-bold text-[#0F172A] leading-tight">
                Select discount type
              </h2>
            </div>

            {/* Discount Options List */}
            <div className="space-y-3">
              {/* Flat Amount Option Card */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setSelectedType("flat")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setSelectedType("flat");
                }}
                className={`w-full rounded-[12px] bg-white p-5 border cursor-pointer transition-all flex items-center justify-between gap-4 ${
                  selectedType === "flat"
                    ? "border-[#3DAC35] shadow-[0_2px_8px_rgba(61,172,53,0.12)]"
                    : "border-[#F1F5F9] hover:border-slate-300 shadow-sm"
                }`}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-12 h-12 rounded-[8px] bg-[#DAE2FD]/30 flex items-center justify-center shrink-0">
                    <FixedDiscountIcon className="w-5 h-5" color="#2563EB" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[18px] font-bold text-[#171D15] leading-tight truncate">
                      Flat amount off
                    </h3>
                    <p className="text-[14px] text-[#3F4A3A] mt-1 font-normal">
                      Fixed ₹ discount on total bill
                    </p>
                  </div>
                </div>

                {/* Radio Indicator */}
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                    selectedType === "flat"
                      ? "border-[#3DAC35]"
                      : "border-[#BECAB6]"
                  }`}
                >
                  {selectedType === "flat" && (
                    <div className="w-2.5 h-2.5 rounded-full bg-[#3DAC35]" />
                  )}
                </div>
              </div>

              {/* Percentage Off Option Card */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setSelectedType("percentage")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setSelectedType("percentage");
                }}
                className={`w-full rounded-[12px] bg-white p-5 border cursor-pointer transition-all flex items-center justify-between gap-4 ${
                  selectedType === "percentage"
                    ? "border-[#3DAC35] shadow-[0_2px_8px_rgba(61,172,53,0.12)]"
                    : "border-[#F1F5F9] hover:border-slate-300 shadow-sm"
                }`}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-12 h-12 rounded-[8px] bg-[#006E08]/10 flex items-center justify-center shrink-0">
                    <PercentIcon className="w-5 h-5" color="#006E08" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[18px] font-bold text-[#171D15] leading-tight truncate">
                      Percentage off
                    </h3>
                    <p className="text-[14px] text-[#3F4A3A] mt-1 font-normal">
                      Deduct % from product price
                    </p>
                  </div>
                </div>

                {/* Radio Indicator */}
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                    selectedType === "percentage"
                      ? "border-[#3DAC35]"
                      : "border-[#BECAB6]"
                  }`}
                >
                  {selectedType === "percentage" && (
                    <div className="w-2.5 h-2.5 rounded-full bg-[#3DAC35]" />
                  )}
                </div>
              </div>
            </div>

            {/* Descriptive Information Card */}
            <div className="rounded-[12px] bg-[#006E08]/[0.05] border border-[#006E08]/20 p-5 flex items-start gap-3">
              <InfoLockIcon className="w-4 h-4 mt-0.5 shrink-0" color="#006E08" />
              <p className="text-[14px] leading-relaxed text-[#3F4A3A]">
                Choosing a discount type will lock the rules for this specific campaign. You can edit values later.
              </p>
            </div>
          </div>

          {/* Sticky Footer Actions */}
          <div className="pt-8 pb-4 space-y-2">
            <button
              type="button"
              onClick={handleStep1Next}
              className="w-full h-[52px] rounded-[8px] bg-[#0F172A] hover:bg-slate-800 active:scale-[0.99] text-white font-bold text-[16px] flex items-center justify-center shadow-sm transition-all"
            >
              Next
            </button>
            <button
              type="button"
              onClick={() => navigate("/dashboard/promotions")}
              className="w-full h-[52px] rounded-[8px] bg-[#F1F5F9] hover:bg-slate-200 active:scale-[0.99] text-[#3F4A3A] font-medium text-[16px] flex items-center justify-center border border-[#E2E8F0] transition-all"
            >
              Cancel
            </button>
          </div>
        </main>
      )}

      {/* STEP 2: Configure Discount Details & Cart Discount Rules (Frame 1130:711) */}
      {currentStep === 2 && (
        <main className="flex-1 p-4 flex flex-col justify-between max-w-full space-y-6">
          <div className="space-y-6">
            {/* 1. General Information Section */}
            <section className="space-y-2.5">
              <h2 className="text-[18px] font-bold text-[#0F172A] leading-tight">
                General Information
              </h2>
              <div className="rounded-[12px] bg-white border border-[#E2E8F0] p-4 shadow-sm space-y-2">
                <label className="block text-[14px] font-semibold text-[#334155]">
                  Promotion name
                </label>
                <input
                  type="text"
                  value={promotionName}
                  onChange={(e) => setPromotionName(e.target.value)}
                  placeholder="e.g. Diwali sale"
                  className="w-full h-12 px-3.5 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0] text-[16px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#3DAC35] focus:ring-1 focus:ring-[#3DAC35]"
                />
              </div>
            </section>

            {/* 2. Apply To Section (Asymmetric Radio Group) */}
            <section className="space-y-2.5">
              <h2 className="text-[18px] font-bold text-[#0F172A] leading-tight">
                Apply to
              </h2>

              <div className="space-y-2.5">
                {/* Option 1: Cart discount */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setApplyTo("cart")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setApplyTo("cart");
                  }}
                  className={`w-full rounded-[12px] p-4 border cursor-pointer transition-all flex items-center justify-between ${
                    applyTo === "cart"
                      ? "bg-[#3DAC35]/[0.06] border-[#3DAC35]"
                      : "bg-white border-[#E2E8F0] hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                        applyTo === "cart" ? "border-[#3DAC35]" : "border-[#BECAB6]"
                      }`}
                    >
                      {applyTo === "cart" && (
                        <div className="w-2.5 h-2.5 rounded-full bg-[#3DAC35]" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-[16px] font-bold text-[#171D15]">
                        Cart discount
                      </h3>
                      <p className="text-[13px] text-[#3F4A3A]">
                        Discount applies to cart
                      </p>
                    </div>
                  </div>
                </div>

                {/* Option 2: Selected products */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setApplyTo("products")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setApplyTo("products");
                  }}
                  className={`w-full rounded-[12px] p-4 border cursor-pointer transition-all flex items-center justify-between ${
                    applyTo === "products"
                      ? "bg-[#3DAC35]/[0.06] border-[#3DAC35]"
                      : "bg-white border-[#E2E8F0] hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                        applyTo === "products" ? "border-[#3DAC35]" : "border-[#BECAB6]"
                      }`}
                    >
                      {applyTo === "products" && (
                        <div className="w-2.5 h-2.5 rounded-full bg-[#3DAC35]" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-[16px] font-bold text-[#171D15]">
                        Selected products
                      </h3>
                      <p className="text-[13px] text-[#3F4A3A]">
                        Choose specific items
                      </p>
                    </div>
                  </div>
                </div>

                {/* Option 3: Selected categories */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setApplyTo("categories")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setApplyTo("categories");
                  }}
                  className={`w-full rounded-[12px] p-4 border cursor-pointer transition-all flex items-center justify-between ${
                    applyTo === "categories"
                      ? "bg-[#3DAC35]/[0.06] border-[#3DAC35]"
                      : "bg-white border-[#E2E8F0] hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                        applyTo === "categories" ? "border-[#3DAC35]" : "border-[#BECAB6]"
                      }`}
                    >
                      {applyTo === "categories" && (
                        <div className="w-2.5 h-2.5 rounded-full bg-[#3DAC35]" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-[16px] font-bold text-[#171D15]">
                        Selected categories
                      </h3>
                      <p className="text-[13px] text-[#3F4A3A]">
                        Apply to entire product lines
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* 3. Discounted products conditional question */}
            {applyTo === "cart" && (
              <section className="rounded-[12px] bg-white border border-[#E2E8F0] p-4 shadow-sm space-y-3">
                <p className="text-[15px] font-semibold text-[#0F172A] leading-snug">
                  Will cart discount apply to discounted products ?
                </p>
                <div className="space-y-2.5">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="applyToDiscounted"
                      checked={applyToDiscounted === true}
                      onChange={() => setApplyToDiscounted(true)}
                      className="w-4 h-4 text-[#3DAC35] focus:ring-[#3DAC35] accent-[#3DAC35]"
                    />
                    <span className="text-[15px] text-[#171D15] font-medium">Yes</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="applyToDiscounted"
                      checked={applyToDiscounted === false}
                      onChange={() => setApplyToDiscounted(false)}
                      className="w-4 h-4 text-[#3DAC35] focus:ring-[#3DAC35] accent-[#3DAC35]"
                    />
                    <span className="text-[15px] text-[#64748B] font-medium">No</span>
                  </label>
                </div>
              </section>
            )}

            {/* 4. Information about offer (Percentage / Fixed Value) */}
            <section className="space-y-2.5">
              <h2 className="text-[18px] font-bold text-[#0F172A] leading-tight">
                Information about offer
              </h2>
              <div className="rounded-[12px] bg-white border border-[#3DAC35] p-4 shadow-sm space-y-2">
                <label className="block text-[14px] font-semibold text-[#334155]">
                  {selectedType === "flat" ? "Discount Amount" : "Percentage"}
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="0"
                      max={selectedType === "percentage" ? "100" : undefined}
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      placeholder="0"
                      className="w-full h-12 px-3.5 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0] text-[18px] font-bold text-[#0F172A] focus:outline-none focus:border-[#3DAC35] focus:ring-1 focus:ring-[#3DAC35]"
                    />
                  </div>
                  <span className="text-[18px] font-bold text-[#3F4A3A] px-2">
                    {selectedType === "flat" ? "₹" : "%"}
                  </span>
                </div>
              </div>
            </section>

            {/* 5. Coupon Code Ticket Card with Notches */}
            <section className="space-y-2.5">
              <h2 className="text-[18px] font-bold text-[#0F172A] leading-tight">
                Coupon code
              </h2>
              
              <div className="relative overflow-hidden rounded-[12px] bg-white border border-[#BECAB6] p-5 shadow-sm">
                {/* Left and Right Notches matching Figma */}
                <div className="absolute left-[-12px] top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#F6F8F6] border border-[#BECAB6]" />
                <div className="absolute right-[-12px] top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#F6F8F6] border border-[#BECAB6]" />

                <div className="space-y-2 px-2">
                  <span className="block text-[12px] font-bold tracking-wider text-[#3F4A3A] uppercase">
                    COUPON CODE
                  </span>
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="ex SAVE 20"
                    className="w-full h-12 px-3.5 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0] text-[18px] font-bold tracking-wider text-[#0F172A] placeholder:text-[#94A3B8] placeholder:font-light focus:outline-none focus:border-[#3DAC35] focus:ring-1 focus:ring-[#3DAC35]"
                  />
                </div>
              </div>
            </section>

            {/* 6. Usage Restrictions Section */}
            <section className="space-y-2.5">
              <h2 className="text-[18px] font-bold text-[#0F172A] leading-tight">
                Usage Restrictions
              </h2>
              <div className="rounded-[12px] bg-white border border-[#3DAC35] p-4 shadow-sm space-y-4">
                {/* Total usage limit */}
                <div className="space-y-1.5">
                  <label className="block text-[14px] font-semibold text-[#334155]">
                    Total usage limit (Optional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={totalUsageLimit}
                    onChange={(e) => setTotalUsageLimit(e.target.value)}
                    placeholder="0"
                    className="w-full h-12 px-3.5 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0] text-[16px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#3DAC35] focus:ring-1 focus:ring-[#3DAC35]"
                  />
                </div>

                {/* Min order value */}
                <div className="space-y-1.5">
                  <label className="block text-[14px] font-semibold text-[#334155]">
                    Min order value (Optional)
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      min="0"
                      value={minOrderValue}
                      onChange={(e) => setMinOrderValue(e.target.value)}
                      placeholder="0"
                      className="w-full h-12 px-3.5 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0] text-[16px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#3DAC35] focus:ring-1 focus:ring-[#3DAC35]"
                    />
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Sticky Footer Actions */}
          <div className="pt-6 pb-4 space-y-2">
            <button
              type="button"
              onClick={handleStep2Submit}
              className="w-full h-[52px] rounded-[8px] bg-[#0F172A] hover:bg-slate-800 active:scale-[0.99] text-white font-bold text-[16px] flex items-center justify-center shadow-sm transition-all"
            >
              Create Offer
            </button>
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="w-full h-[52px] rounded-[8px] bg-[#F1F5F9] hover:bg-slate-200 active:scale-[0.99] text-[#3F4A3A] font-medium text-[16px] flex items-center justify-center border border-[#E2E8F0] transition-all"
            >
              Back
            </button>
          </div>
        </main>
      )}
    </div>
  );
}
