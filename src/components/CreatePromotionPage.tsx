import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Calendar, Plus, X } from "lucide-react";
import { useFirebaseQuery as useQuery } from "../lib/firebase/hooks";
import { api, type Id } from "../lib/firebase/operations";
import {
  BackArrowIcon,
  FixedDiscountIcon,
  PercentIcon,
  InfoLockIcon,
  TrashRemoveIcon,
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

interface SelectedProductItem {
  _id: string;
  name: string;
  price: number;
  imageUrl?: string | null;
}

export function CreatePromotionPage({ business }: CreatePromotionPageProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("editId");

  // Multi-step state (Step 1 -> Step 2)
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  // Step 1: Discount Type
  const [selectedType, setSelectedType] = useState<DiscountType>("flat");

  // Step 2: Form fields
  const [promotionName, setPromotionName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [applyTo, setApplyTo] = useState<ApplyToTarget>("cart");
  const [applyToDiscounted, setApplyToDiscounted] = useState<boolean>(true);
  const [discountValue, setDiscountValue] = useState("0");
  const [couponCode, setCouponCode] = useState("");
  const [totalUsageLimit, setTotalUsageLimit] = useState("");
  const [minOrderValue, setMinOrderValue] = useState("");

  // Selected Products state
  const [selectedProducts, setSelectedProducts] = useState<SelectedProductItem[]>([
    {
      _id: "demo-saree-1",
      name: "Kanchipuram Saree",
      price: 4330,
    },
  ]);
  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);

  // Selected Categories state
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["demo-cat-clothing"]);
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);

  // Fetch real business products & categories
  const businessProducts = useQuery(api.products.getBusinessProducts, {
    businessId: business._id,
  });
  const businessCategories = useQuery(api.categories.getBusinessCategories, {
    businessId: business._id,
  });

  // Fallback demo categories if store has none yet
  const availableCategories = useMemo(() => {
    if (businessCategories && businessCategories.length > 0) {
      return businessCategories.map((c: any) => ({
        _id: c._id || c.id,
        name: c.name,
        description: c.description || "",
      }));
    }
    return [
      { _id: "demo-cat-clothing", name: "Clothing & Apparel", description: "Sarees, kurtas, suits" },
      { _id: "demo-cat-footwear", name: "Footwear & Shoes", description: "Sandals, sneakers, heels" },
      { _id: "demo-cat-accessories", name: "Accessories & Jewelry", description: "Necklaces, earrings, bags" },
    ];
  }, [businessCategories]);

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

  const handleRemoveProduct = (productId: string) => {
    setSelectedProducts((prev) => prev.filter((p) => p._id !== productId));
    toast.info("Product removed from promotion");
  };

  const handleToggleCategory = (catId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  const handleRemoveCategory = (catId: string) => {
    setSelectedCategories((prev) => prev.filter((id) => id !== catId));
    toast.info("Category removed from promotion");
  };

  const handleAddProduct = (product: { _id: string; name: string; price: number; imageUrls?: (string | null)[] }) => {
    if (selectedProducts.some((p) => p._id === product._id)) {
      toast.info("Product already selected");
      return;
    }
    setSelectedProducts((prev) => [
      ...prev,
      {
        _id: product._id,
        name: product.name,
        price: product.price,
        imageUrl: product.imageUrls?.[0] || null,
      },
    ]);
    setIsProductPickerOpen(false);
    toast.success(`Added ${product.name}`);
  };

  // Preview discounted price calculation for products
  const previewProducts = useMemo(() => {
    const numVal = parseFloat(discountValue) || 0;
    return selectedProducts.map((prod) => {
      let finalPrice = prod.price;
      if (selectedType === "percentage") {
        finalPrice = Math.max(0, Math.round(prod.price * (1 - numVal / 100)));
      } else {
        finalPrice = Math.max(0, prod.price - numVal);
      }
      return {
        ...prod,
        discountedPrice: finalPrice,
      };
    });
  }, [selectedProducts, discountValue, selectedType]);

  // Preview products belonging to selected categories
  const categoryPreviewProducts = useMemo(() => {
    const numVal = parseFloat(discountValue) || 0;
    const prods = (businessProducts || []).filter((p: any) =>
      p.categoryId && selectedCategories.includes(p.categoryId)
    );
    if (prods.length === 0) {
      // Demo preview if real category products aren't linked
      return [
        {
          _id: "demo-cat-p1",
          name: "Silk Saree (Category Item)",
          price: 3200,
          imageUrl: null,
          discountedPrice:
            selectedType === "percentage"
              ? Math.max(0, Math.round(3200 * (1 - numVal / 100)))
              : Math.max(0, 3200 - numVal),
        },
      ];
    }
    return prods.slice(0, 4).map((p: any) => ({
      _id: p._id,
      name: p.name,
      price: p.price,
      imageUrl: p.imageUrls?.[0] || null,
      discountedPrice:
        selectedType === "percentage"
          ? Math.max(0, Math.round(p.price * (1 - numVal / 100)))
          : Math.max(0, p.price - numVal),
    }));
  }, [businessProducts, selectedCategories, discountValue, selectedType]);

  // Populate fields if in edit mode
  useEffect(() => {
    if (!editId) return;
    try {
      const storageKey = `whatscart_promotions_${business._id}`;
      const existing = JSON.parse(localStorage.getItem(storageKey) || "[]");
      const found = existing.find((p: any) => p.id === editId);
      if (found) {
        setPromotionName(found.title || "");
        setSelectedType(found.category === "percentage" ? "percentage" : "flat");
        setDiscountValue(found.discountValue || "0");
        setApplyTo(found.applyTo || "cart");
        if (found.couponCode) setCouponCode(found.couponCode);
        if (found.totalUsageLimit) setTotalUsageLimit(found.totalUsageLimit);
        if (found.minOrderValue) setMinOrderValue(found.minOrderValue);
        if (found.selectedCategoryIds) setSelectedCategories(found.selectedCategoryIds);
        setCurrentStep(2); // Jump straight to edit details
      }
    } catch {
      // ignore
    }
  }, [editId, business._id]);

  const handleStep2Submit = () => {
    if (!promotionName.trim()) {
      toast.error("Please enter a promotion name");
      return;
    }
    if (!discountValue || discountValue === "0") {
      toast.error("Please specify the discount value");
      return;
    }
    if (applyTo === "products" && selectedProducts.length === 0) {
      toast.error("Please select at least one product");
      return;
    }
    if (applyTo === "categories" && selectedCategories.length === 0) {
      toast.error("Please select at least one category");
      return;
    }

    const promoPayload = {
      id: editId || `promo-${Date.now()}`,
      title: promotionName.trim(),
      type:
        applyTo === "cart"
          ? (selectedType === "percentage" ? "Percentage Off - Whole Order" : "Fixed Discount - Whole Order")
          : applyTo === "products"
          ? `${selectedProducts.length} Selected Products`
          : `${selectedCategories.length} Selected Categories`,
      category: selectedType === "percentage" ? "percentage" : "fixed",
      status: "ACTIVE",
      discountLabel: selectedType === "percentage" ? `${discountValue}% OFF` : `₹${discountValue} OFF`,
      scheduleLabel: endDate ? `Ends ${new Date(endDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}` : "Active Now",
      iconType: selectedType === "percentage" ? "percentage" : "fixed",
      iconBgColor: selectedType === "percentage" ? "rgba(0, 110, 8, 0.1)" : "rgba(218, 226, 253, 0.3)",
      iconColor: selectedType === "percentage" ? "#006E08" : "#2563EB",
      badgeBgColor: "rgba(0, 110, 8, 0.1)",
      badgeTextColor: "#006E08",
      actionText: "→ View Details",
      isExpired: false,
      applyTo,
      discountValue,
      couponCode: couponCode || undefined,
      totalUsageLimit: totalUsageLimit || undefined,
      minOrderValue: minOrderValue || undefined,
      selectedProductIds: selectedProducts.map((p) => p._id),
      selectedCategoryIds: selectedCategories,
      createdAt: Date.now(),
    };

    try {
      const storageKey = `whatscart_promotions_${business._id}`;
      const existing = JSON.parse(localStorage.getItem(storageKey) || "[]");
      let updated;
      if (editId) {
        updated = existing.map((p: any) => (p.id === editId ? { ...p, ...promoPayload } : p));
        if (!existing.some((p: any) => p.id === editId)) {
          updated = [promoPayload, ...existing];
        }
      } else {
        updated = [promoPayload, ...existing];
      }
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {
      // ignore storage errors
    }

    toast.success(editId ? `Promotion "${promotionName}" updated successfully!` : `Promotion "${promotionName}" created successfully!`);
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

      {/* STEP 2: Configure Discount Details (Supports Cart Discount & Selected Product) */}
      {currentStep === 2 && (
        <main className="flex-1 p-4 flex flex-col justify-between max-w-full space-y-6">
          <div className="space-y-6">
            {/* 1. General Information Section */}
            <section className="space-y-2.5">
              <h2 className="text-[18px] font-bold text-[#0F172A] leading-tight">
                General Information
              </h2>
              <div className="rounded-[12px] bg-white border border-[#E2E8F0] p-4 shadow-sm space-y-4">
                <div className="space-y-1.5">
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

                {/* Optional Date Range Grid */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <label className="block text-[14px] font-semibold text-[#334155]">
                      Start Date
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full h-12 px-3 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0] text-[14px] text-[#0F172A] focus:outline-none focus:border-[#3DAC35]"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[14px] font-semibold text-[#334155]">
                      End Date
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full h-12 px-3 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0] text-[14px] text-[#0F172A] focus:outline-none focus:border-[#3DAC35]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* 2. Apply To Section (Asymmetric Radio Group) */}
            <section className="space-y-2.5">
              <h2 className="text-[18px] font-bold text-[#0F172A] leading-tight">
                Apply to
              </h2>

              <div className="space-y-2.5">
                {/* Option 1: Cart discount / Whole order */}
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
                        Whole order
                      </h3>
                      <p className="text-[13px] text-[#3F4A3A]">
                        Discount applies to entire subtotal
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

            {/* 3A. Selected Products Section (Frame 1130:1583) */}
            {applyTo === "products" && (
              <section className="space-y-2.5">
                <h2 className="text-[18px] font-bold text-[#0F172A] leading-tight">
                  Products
                </h2>
                <div className="rounded-[12px] bg-white border border-[#3DAC35] p-4 shadow-sm space-y-3">
                  {selectedProducts.map((product) => (
                    <div
                      key={product._id}
                      className="flex items-center justify-between p-3 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-[7.25px] bg-[#D9D9D9] overflow-hidden flex items-center justify-center shrink-0">
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] text-slate-500 font-bold">ITEM</span>
                          )}
                        </div>
                        <div>
                          <p className="text-[15px] font-medium text-[#171D15]">
                            {product.name}
                          </p>
                          <p className="text-[14px] font-semibold text-[#6B7280]">
                            ₹{product.price.toLocaleString("en-IN")}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveProduct(product._id)}
                        className="p-2 text-[#FF7D7D] hover:bg-red-50 rounded-full transition"
                        aria-label="Remove product"
                      >
                        <TrashRemoveIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => setIsProductPickerOpen(true)}
                    className="w-full h-11 rounded-[8px] bg-[#F1F5F9] hover:bg-[#e2e8f0] active:scale-[0.99] text-[#64748B] font-medium text-[15px] flex items-center justify-center gap-2 border border-[#E2E8F0] transition"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Products</span>
                  </button>
                </div>
              </section>
            )}

            {/* 3B. Selected Categories Section */}
            {applyTo === "categories" && (
              <section className="space-y-2.5">
                <h2 className="text-[18px] font-bold text-[#0F172A] leading-tight">
                  Categories
                </h2>
                <div className="rounded-[12px] bg-white border border-[#3DAC35] p-4 shadow-sm space-y-3">
                  {selectedCategories.length === 0 ? (
                    <div className="text-center py-4 text-slate-500 text-sm">
                      No categories selected yet. Tap below to choose categories.
                    </div>
                  ) : (
                    availableCategories
                      .filter((cat) => selectedCategories.includes(cat._id))
                      .map((cat) => (
                        <div
                          key={cat._id}
                          className="flex items-center justify-between p-3 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0]"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-[7.25px] bg-[#3DAC35]/10 flex items-center justify-center shrink-0">
                              <span className="text-[14px] font-bold text-[#3DAC35]">🏷️</span>
                            </div>
                            <div>
                              <p className="text-[15px] font-semibold text-[#171D15]">
                                {cat.name}
                              </p>
                              {cat.description && (
                                <p className="text-[12px] text-[#6B7280]">
                                  {cat.description}
                                </p>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveCategory(cat._id)}
                            className="p-2 text-[#FF7D7D] hover:bg-red-50 rounded-full transition"
                            aria-label="Remove category"
                          >
                            <TrashRemoveIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                  )}

                  <button
                    type="button"
                    onClick={() => setIsCategoryPickerOpen(true)}
                    className="w-full h-11 rounded-[8px] bg-[#F1F5F9] hover:bg-[#e2e8f0] active:scale-[0.99] text-[#64748B] font-medium text-[15px] flex items-center justify-center gap-2 border border-[#E2E8F0] transition"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Select Categories</span>
                  </button>
                </div>
              </section>
            )}

            {/* 3C. Cart discount conditional question */}
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

            {/* 5A. Preview Section for Selected Products (Frame 1130:1705) */}
            {applyTo === "products" && previewProducts.length > 0 && (
              <section className="space-y-2.5">
                <h2 className="text-[18px] font-bold text-[#0F172A] leading-tight">
                  Preview
                </h2>
                <div className="rounded-[12px] bg-white border border-[#3DAC35] p-4 shadow-sm space-y-3">
                  {previewProducts.map((product) => (
                    <div
                      key={`preview-${product._id}`}
                      className="flex items-center gap-3 p-3 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0]"
                    >
                      <div className="w-10 h-10 rounded-[7.25px] bg-[#D9D9D9] overflow-hidden flex items-center justify-center shrink-0">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[10px] text-slate-500 font-bold">ITEM</span>
                        )}
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[15px] font-medium text-[#171D15]">
                          {product.name}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-[16px] font-bold text-[#006E08]">
                            ₹{product.discountedPrice.toLocaleString("en-IN")}
                          </span>
                          <span className="text-[14px] text-[#94A3B8] line-through font-normal">
                            ₹{product.price.toLocaleString("en-IN")}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 5B. Preview Section for Selected Categories */}
            {applyTo === "categories" && categoryPreviewProducts.length > 0 && (
              <section className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h2 className="text-[18px] font-bold text-[#0F172A] leading-tight">
                    Preview Sample
                  </h2>
                  <span className="text-[13px] text-[#64748B] font-medium">
                    Applied to items in selected categories
                  </span>
                </div>
                <div className="rounded-[12px] bg-white border border-[#3DAC35] p-4 shadow-sm space-y-3">
                  {categoryPreviewProducts.map((product) => (
                    <div
                      key={`cat-preview-${product._id}`}
                      className="flex items-center gap-3 p-3 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0]"
                    >
                      <div className="w-10 h-10 rounded-[7.25px] bg-[#D9D9D9] overflow-hidden flex items-center justify-center shrink-0">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[10px] text-slate-500 font-bold">ITEM</span>
                        )}
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[15px] font-medium text-[#171D15]">
                          {product.name}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-[16px] font-bold text-[#006E08]">
                            ₹{product.discountedPrice.toLocaleString("en-IN")}
                          </span>
                          <span className="text-[14px] text-[#94A3B8] line-through font-normal">
                            ₹{product.price.toLocaleString("en-IN")}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 5C. Coupon Code Ticket Card with Notches (For Cart Discount) */}
            {applyTo === "cart" && (
              <section className="space-y-2.5">
                <h2 className="text-[18px] font-bold text-[#0F172A] leading-tight">
                  Coupon code
                </h2>
                
                <div className="relative overflow-hidden rounded-[12px] bg-white border border-[#BECAB6] p-5 shadow-sm">
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
            )}

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
                {applyTo === "cart" && (
                  <div className="space-y-1.5">
                    <label className="block text-[14px] font-semibold text-[#334155]">
                      Min order value (Optional)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={minOrderValue}
                      onChange={(e) => setMinOrderValue(e.target.value)}
                      placeholder="0"
                      className="w-full h-12 px-3.5 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0] text-[16px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#3DAC35] focus:ring-1 focus:ring-[#3DAC35]"
                    />
                  </div>
                )}
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

      {/* Product Selection Modal */}
      {isProductPickerOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-lg bg-white rounded-t-[20px] sm:rounded-[16px] max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-[17px] font-bold text-[#0F172A]">Select Product</h3>
              <button
                type="button"
                onClick={() => setIsProductPickerOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2 flex-1 divide-y divide-slate-100">
              {businessProducts && businessProducts.length > 0 ? (
                businessProducts.map((prod) => (
                  <div
                    key={prod._id}
                    onClick={() => handleAddProduct(prod)}
                    className="pt-2 first:pt-0 flex items-center justify-between py-2.5 px-2 hover:bg-slate-50 rounded-lg cursor-pointer transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-[6px] bg-slate-100 overflow-hidden flex items-center justify-center">
                        {prod.imageUrls?.[0] ? (
                          <img src={prod.imageUrls[0]} alt={prod.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[10px] text-slate-400 font-bold">ITEM</span>
                        )}
                      </div>
                      <div>
                        <p className="text-[14px] font-semibold text-slate-800">{prod.name}</p>
                        <p className="text-[13px] text-slate-500">₹{prod.price.toLocaleString("en-IN")}</p>
                      </div>
                    </div>
                    <span className="text-[13px] font-semibold text-[#3DAC35]">Select</span>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-slate-500 text-sm">
                  No other products found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Category Selection Modal */}
      {isCategoryPickerOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-lg bg-white rounded-t-[20px] sm:rounded-[16px] max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-[17px] font-bold text-[#0F172A]">Select Categories</h3>
                <p className="text-[13px] text-slate-500">Choose categories to include in this promotion</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCategoryPickerOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2 flex-1 divide-y divide-slate-100">
              {availableCategories.map((cat) => {
                const isSelected = selectedCategories.includes(cat._id);
                return (
                  <div
                    key={cat._id}
                    onClick={() => handleToggleCategory(cat._id)}
                    className="pt-2 first:pt-0 flex items-center justify-between py-3 px-2 hover:bg-slate-50 rounded-lg cursor-pointer transition"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
                          isSelected ? "bg-[#3DAC35] border-[#3DAC35] text-white" : "border-slate-300 bg-white"
                        }`}
                      >
                        {isSelected && (
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <p className="text-[14px] font-semibold text-slate-800">{cat.name}</p>
                        {cat.description && (
                          <p className="text-[12px] text-slate-500">{cat.description}</p>
                        )}
                      </div>
                    </div>
                    <span
                      className={`text-[13px] font-semibold ${
                        isSelected ? "text-[#3DAC35]" : "text-slate-400"
                      }`}
                    >
                      {isSelected ? "Selected" : "Add"}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="p-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsCategoryPickerOpen(false)}
                className="w-full h-11 rounded-[8px] bg-[#0F172A] hover:bg-slate-800 text-white font-semibold text-[15px] transition"
              >
                Done ({selectedCategories.length} selected)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
