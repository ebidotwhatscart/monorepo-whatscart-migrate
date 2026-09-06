import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { Id } from "../lib/firebase/operations";
import backArrowUrl from "../assets/figma/promotions/back-arrow.svg";
import flatAmountIconUrl from "../assets/figma/promotions/flat-amount-icon.svg";
import percentOffIconUrl from "../assets/figma/promotions/percent-off-icon.svg";
import infoLockIconUrl from "../assets/figma/promotions/info-lock-icon.svg";

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

export function CreatePromotionPage({ business }: CreatePromotionPageProps) {
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState<DiscountType>("flat");

  const handleBack = () => {
    navigate("/dashboard/promotions");
  };

  const handleNext = () => {
    toast.success(
      `Selected ${selectedType === "flat" ? "Flat amount off" : "Percentage off"}. Proceeding to Step 2!`
    );
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
            <img src={backArrowUrl} alt="Back" className="w-4 h-4" />
          </button>
          <h1 className="text-[18px] font-bold text-[#0F172A] leading-none">
            Create Promotion
          </h1>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-1.5 text-[#0F172A]">
          <span className="text-[14px] font-bold">Step</span>
          <span className="text-[18px] font-bold">1 / 2</span>
        </div>
      </header>

      {/* Main Content Area */}
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
                {/* Blue-ish icon container as in Figma */}
                <div className="w-12 h-12 rounded-[8px] bg-[#DAE2FD]/30 flex items-center justify-center shrink-0">
                  <img src={flatAmountIconUrl} alt="Flat amount" className="w-5 h-5" />
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
                {/* Green icon container as in Figma */}
                <div className="w-12 h-12 rounded-[8px] bg-[#006E08]/10 flex items-center justify-center shrink-0">
                  <img src={percentOffIconUrl} alt="Percentage off" className="w-5 h-5" />
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
            <img src={infoLockIconUrl} alt="Info" className="w-4 h-4 mt-0.5 shrink-0" />
            <p className="text-[14px] leading-relaxed text-[#3F4A3A]">
              Choosing a discount type will lock the rules for this specific campaign. You can edit values later.
            </p>
          </div>
        </div>

        {/* Sticky Footer Actions */}
        <div className="pt-8 pb-4 space-y-2">
          <button
            type="button"
            onClick={handleNext}
            className="w-full h-[52px] rounded-[8px] bg-[#0F172A] hover:bg-slate-800 active:scale-[0.99] text-white font-bold text-[16px] flex items-center justify-center shadow-sm transition-all"
          >
            Next
          </button>
          <button
            type="button"
            onClick={handleBack}
            className="w-full h-[52px] rounded-[8px] bg-[#F1F5F9] hover:bg-slate-200 active:scale-[0.99] text-[#3F4A3A] font-medium text-[16px] flex items-center justify-center border border-[#E2E8F0] transition-all"
          >
            Cancel
          </button>
        </div>
      </main>
    </div>
  );
}
