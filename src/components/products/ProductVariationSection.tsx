import { useState, type ChangeEvent } from "react";
import { Camera, Image as ImageIcon, Plus, Trash2, X, ChevronDown, Check } from "lucide-react";
import type { Id } from "../../lib/firebase/operations";

export type VariationOption = { variantType: string; values: string[] };

export type VariantFormData = {
  id: string;
  _id?: Id<"products">;
  variantType: string;
  variantValue: string;
  colorSwatch: string;
  inStock: boolean;
  images: File[];
  imagePreviews: string[];
  sizes: Array<{ size: string; price: string }>;
};

interface ProductVariationSectionProps {
  hasColorVariants: boolean;
  onHasColorVariantsChange: (v: boolean) => void;
  variants: VariantFormData[];
  onVariantsChange: (variants: VariantFormData[]) => void;
  sizeFormat: "alpha" | "numeric" | "weight" | "quantity";
  sizeOptions: Array<{ size: string; price: string }>;
  priceError?: string;
  simplePrice?: boolean;
  variationOptions: VariationOption[];
  variationOptionsLoading?: boolean;
  variationOptionsError?: string;
  onAddCustomType: (variantType: string) => Promise<string>;
  onAddCustomValue: (variantType: string, value: string) => Promise<string>;
  onEditVariant?: (variantId: string) => void;
  variantErrors?: Record<number, string[]>;
  // Read-only variants from server when editing a product that already has variants
  existingVariants?: Array<{
    _id: string;
    variantType: string | null;
    variantValue: string | null;
    colorName: string | null;
    colorSwatch: string | null;
    price: number;
    sizes: Array<{ size: string; price?: number }>;
    inStock: boolean;
    imageIds: Id<"_storage">[];
    imageUrls: string[];
  }>;
}

let variantCounter = 0;
function createVariantId(): string {
  variantCounter++;
  return `variant-${variantCounter}-${Date.now()}`;
}

export function createEmptyVariant(): VariantFormData {
  return {
    id: createVariantId(),
    variantType: "",
    variantValue: "",
    colorSwatch: "#000000",
    inStock: true,
    images: [],
    imagePreviews: [],
    sizes: [{ size: "", price: "" }],
  };
}

export function ProductVariationSection({
  hasColorVariants,
  onHasColorVariantsChange,
  variants,
  onVariantsChange,
  sizeFormat,
  sizeOptions,
  priceError,
  simplePrice = false,
  variationOptions,
  variationOptionsLoading = false,
  variationOptionsError,
  onAddCustomType,
  onAddCustomValue,
  onEditVariant = () => undefined,
  variantErrors = {},
  existingVariants = [],
}: ProductVariationSectionProps) {
  const MAX_IMAGES = 5;
  const availableVariationOptions = variationOptions.filter(
    (option) => option.variantType.trim().toLowerCase() !== "weight",
  );
  const [customTypeIndex, setCustomTypeIndex] = useState<number | null>(null);
  const [customTypeName, setCustomTypeName] = useState("");
  const [customValueIndex, setCustomValueIndex] = useState<number | null>(null);
  const [customValueName, setCustomValueName] = useState("");
  const [optionError, setOptionError] = useState("");

  const getOptionsForVariant = (variant: VariantFormData) => {
    const currentType = availableVariationOptions.find(
      (option) => option.variantType.toLowerCase() === variant.variantType.toLowerCase(),
    );
    return currentType ?? (variant.variantType ? { variantType: variant.variantType, values: [] } : undefined);
  };

  const handleImageAdd = (variantIndex: number, event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const currentPreviewCount = variants[variantIndex].imagePreviews.length;
    const available = MAX_IMAGES - currentPreviewCount;
    const toAdd = files.slice(0, available);

    if (toAdd.length === 0) {
      event.target.value = "";
      return;
    }

    const newPreviews: string[] = [];
    toAdd.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        newPreviews.push(readerEvent.target?.result as string);
        if (newPreviews.length === toAdd.length) {
          onVariantsChange(
            variants.map((v, idx) =>
              idx === variantIndex
                ? { ...v, images: [...v.images, ...toAdd], imagePreviews: [...v.imagePreviews, ...newPreviews] }
                : v,
            ),
          );
        }
      };
      reader.readAsDataURL(file);
    });
    event.target.value = "";
  };

  const removeVariantImage = (variantIndex: number, imageIndex: number) => {
    onVariantsChange(
      variants.map((v, idx) =>
        idx === variantIndex
          ? {
              ...v,
              images: v.images.filter((_, i) => i !== imageIndex),
              imagePreviews: v.imagePreviews.filter((_, i) => i !== imageIndex),
            }
          : v,
      ),
    );
  };

  const updateVariantField = (
    variantIndex: number,
    field: keyof VariantFormData,
    value: unknown,
  ) => {
    onVariantsChange(
      variants.map((v, idx) => (idx === variantIndex ? { ...v, [field]: value } : v)),
    );
  };

  const updateVariantSize = (
    variantIndex: number,
    sizeIndex: number,
    key: "size" | "price",
    value: string,
  ) => {
    onVariantsChange(
      variants.map((v, idx) =>
        idx === variantIndex
          ? {
              ...v,
              sizes: v.sizes.map((s, si) =>
                si === sizeIndex ? { ...s, [key]: value } : s,
              ),
            }
          : v,
      ),
    );
  };

  const addVariantSize = (variantIndex: number) => {
    onVariantsChange(
      variants.map((v, idx) =>
        idx === variantIndex
          ? { ...v, sizes: [...v.sizes, { size: "", price: "" }] }
          : v,
      ),
    );
  };

  const removeVariantSize = (variantIndex: number, sizeIndex: number) => {
    onVariantsChange(
      variants.map((v, idx) =>
        idx === variantIndex
          ? {
              ...v,
              sizes:
                v.sizes.length === 1
                  ? [{ size: "", price: "" }]
                  : v.sizes.filter((_, si) => si !== sizeIndex),
            }
          : v,
      ),
    );
  };

  const addVariant = () => {
    const nextVariant = createEmptyVariant();
    const firstVariantType = variants[0]?.variantType.trim() || "";
    if (firstVariantType) {
      nextVariant.variantType = firstVariantType;
      if (firstVariantType.toLowerCase() === "color") {
        nextVariant.colorSwatch = "#000000";
      }
    }
    if (!simplePrice && sizeOptions.length > 0) {
      nextVariant.sizes = sizeOptions.map((option) => ({ ...option }));
    }
    onVariantsChange([...variants, nextVariant]);
  };

  const removeVariant = (variantIndex: number) => {
    onVariantsChange(variants.filter((_, idx) => idx !== variantIndex));
  };

  return (
    <section id="product-variation-section" className="rounded-2xl bg-white p-4 shadow-sm">
      <h3 className="text-[15px] font-bold text-slate-800">
        Product Variation
      </h3>
      <p className="mt-1 text-sm text-slate-400">
        Add variations such as color, size, flavor, or material
      </p>

      <div className="mt-4">
        <label className="mb-2 block text-sm font-semibold text-slate-500">
          Does the product have colour variants?
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onHasColorVariantsChange(true)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              hasColorVariants
                ? "bg-[#58bb4f] text-white"
                : "bg-[#f2f3ef] text-slate-500"
            }`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => onHasColorVariantsChange(false)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              !hasColorVariants
                ? "bg-[#58bb4f] text-white"
                : "bg-[#f2f3ef] text-slate-500"
            }`}
          >
            No
          </button>
        </div>
      </div>

      {!hasColorVariants && existingVariants && existingVariants.length > 0 && (
        <div className="mt-5 space-y-3 border-t border-slate-200 pt-4">
          <h4 className="text-sm font-semibold text-slate-700">
            This product has {existingVariants.length} variant(s):
          </h4>
          <div className="space-y-3">
            {existingVariants.map((variant) => (
              <div
                key={variant._id}
                role="button"
                tabIndex={0}
                onClick={() => onEditVariant(variant._id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onEditVariant(variant._id);
                  }
                }}
                className="flex cursor-pointer items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-[#85cf82] hover:bg-[#f4fbf3] focus:outline-none focus:ring-2 focus:ring-[#85cf82]/40"
              >
                {variant.colorSwatch && variant.variantType === "Color" && (
                  <span
                    className="h-5 w-5 rounded-full border border-slate-300"
                    style={{ backgroundColor: variant.colorSwatch }}
                    title={variant.variantValue || variant.colorName || undefined}
                  />
                )}
                <span className="text-sm font-medium text-slate-700">
                  {variant.variantType ? `${variant.variantType}: ` : ""}
                  {variant.variantValue || variant.colorName || "Unnamed Variant"}
                </span>
                <span className="mx-auto flex-1 text-sm text-slate-400">
                  {simplePrice
                    ? variant.price ? `₹${variant.price}` : "—"
                    : variant.sizes?.map((s) => s.size).filter(Boolean).join(", ") || "—"}
                </span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onEditVariant(variant._id);
                  }}
                  className="shrink-0 rounded-lg bg-white px-3 py-2 text-xs font-bold text-[#3dac35] shadow-sm ring-1 ring-inset ring-[#85cf82]/50 hover:bg-[#f4fbf3]"
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Select "Yes" above to add more variants. To edit a variant, go to its product page.
          </p>
        </div>
      )}

      {hasColorVariants && (
          <>
          <div className="mt-5 space-y-5">
          {variationOptionsLoading && (
            <p className="mt-4 text-sm text-slate-400">Loading variation options…</p>
          )}
          {variationOptionsError && (
            <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{variationOptionsError}</p>
          )}
          {variantErrors[-1]?.map((error) => (
            <p key={error} role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
              {error}
            </p>
          ))}
          {variants.map((variant, variantIndex) => (
            <div
              key={variant.id}
              id={`product-variation-${variantIndex}`}
              className="rounded-2xl border border-[#e8ebe3] bg-white p-5 shadow-sm"
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="h-px flex-1 border-t border-dashed border-[#3dac35]" />
                <span className="whitespace-nowrap text-sm font-semibold text-[#3dac35]">
                  Variant {variantIndex + 1}
                </span>
                <div className="h-px flex-1 border-t border-dashed border-[#3dac35]" />
                <button
                  type="button"
                  onClick={() => removeVariant(variantIndex)}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-red-400 hover:bg-red-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {variantErrors[variantIndex]?.length > 0 && (
                <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  <p className="font-semibold">Complete this variation before saving:</p>
                  <ul className="mt-1 list-inside list-disc">
                    {variantErrors[variantIndex].map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">
                  Product In Stock
                </span>
                <button
                  type="button"
                  onClick={() =>
                    updateVariantField(variantIndex, "inStock", !variant.inStock)
                  }
                  className={`flex h-7 w-12 items-center rounded-full p-1 transition ${
                    variant.inStock ? "bg-[#57bb4f]" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`h-5 w-5 rounded-full bg-white transition ${
                      variant.inStock ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="mt-5 space-y-5">
                <div>
                  <label htmlFor={`variant-type-${variantIndex}`} className="mb-2 block text-sm font-semibold text-slate-500">
                    Variant Type
                  </label>
                  <div className="relative">
                    <select
                      id={`variant-type-${variantIndex}`}
                      value={variant.variantType}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (value === "__custom__") {
                          setCustomTypeIndex(variantIndex);
                          setCustomTypeName("");
                          return;
                        }
                        updateVariantField(variantIndex, "variantType", value);
                        if (value === "Color" && !variant.colorSwatch) {
                          updateVariantField(variantIndex, "colorSwatch", "#000000");
                        }
                      }}
                      className="w-full appearance-none rounded-xl border border-[#e8ebe3] bg-[#f7f8f4] px-3 py-3 text-sm text-slate-700 outline-none focus:border-[#85cf82]"
                    >
                      <option value="">Choose type...</option>
                      {availableVariationOptions.map((option) => (
                        <option key={option.variantType} value={option.variantType}>
                          {option.variantType}
                        </option>
                      ))}
                      {variant.variantType && !availableVariationOptions.some((option) => option.variantType.toLowerCase() === variant.variantType.toLowerCase()) && (
                        <option value={variant.variantType}>
                          {variant.variantType} (saved)
                        </option>
                      )}
                      <option value="__custom__">Add custom type…</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                  {customTypeIndex === variantIndex && (
                    <div className="mt-2 flex gap-2">
                      <input autoFocus value={customTypeName} onChange={(event) => setCustomTypeName(event.target.value)} placeholder="Enter custom type" className="min-w-0 flex-1 rounded-xl border border-[#e8ebe3] bg-[#f7f8f4] px-3 py-3 text-sm text-slate-700 outline-none focus:border-[#85cf82]" />
                      <button type="button" aria-label="Save custom type" disabled={!customTypeName.trim()} onClick={async () => { try { setOptionError(""); const saved = await onAddCustomType(customTypeName); updateVariantField(variantIndex, "variantType", saved); setCustomTypeIndex(null); setCustomTypeName(""); } catch (error) { setOptionError(error instanceof Error ? error.message : "Could not save variation type"); } }} className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#58bb4f] text-white disabled:opacity-50"><Check className="h-4 w-4" /></button>
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor={`variant-value-${variantIndex}`} className="mb-2 block text-sm font-semibold text-slate-500">
                    {variant.variantType || "Variant"} Value
                  </label>
                  <div className="relative">
                    <select id={`variant-value-${variantIndex}`} value={variant.variantValue} onChange={(event) => { if (event.target.value === "__custom__") { setCustomValueIndex(variantIndex); setCustomValueName(""); return; } updateVariantField(variantIndex, "variantValue", event.target.value); }} className="w-full appearance-none rounded-xl border border-[#e8ebe3] bg-[#f7f8f4] px-3 py-3 text-sm text-slate-700 outline-none focus:border-[#85cf82]">
                      <option value="">Choose value...</option>
                      {getOptionsForVariant(variant)?.values.map((value) => <option key={value} value={value}>{value}</option>)}
                      {variant.variantValue && !getOptionsForVariant(variant)?.values.some((value) => value.toLowerCase() === variant.variantValue.toLowerCase()) && <option value={variant.variantValue}>{variant.variantValue} (saved)</option>}
                      {variant.variantType && <option value="__custom__">Add custom value…</option>}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                  {customValueIndex === variantIndex && (
                    <div className="mt-2 flex gap-2">
                      <input autoFocus value={customValueName} onChange={(event) => setCustomValueName(event.target.value)} placeholder={`Enter ${variant.variantType.toLowerCase()} value`} className="min-w-0 flex-1 rounded-xl border border-[#e8ebe3] bg-[#f7f8f4] px-3 py-3 text-sm text-slate-700 outline-none focus:border-[#85cf82]" />
                      <button type="button" aria-label="Save custom value" disabled={!customValueName.trim()} onClick={async () => { try { setOptionError(""); const saved = await onAddCustomValue(variant.variantType, customValueName); updateVariantField(variantIndex, "variantValue", saved); setCustomValueIndex(null); setCustomValueName(""); } catch (error) { setOptionError(error instanceof Error ? error.message : "Could not save variation value"); } }} className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#58bb4f] text-white disabled:opacity-50"><Check className="h-4 w-4" /></button>
                    </div>
                  )}
                  {optionError && (customTypeIndex === variantIndex || customValueIndex === variantIndex) && <p className="mt-2 text-sm text-red-500">{optionError}</p>}
                </div>

              </div>

                <div className="mt-5">
                  <label className="mb-2 block text-sm font-semibold text-slate-500">
                    Product Images
                  </label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {Array.from({ length: MAX_IMAGES }).map((_, slotIndex) => {
                      const preview = variant.imagePreviews[slotIndex];
                      const showAddButton =
                        !preview && (slotIndex === 0 || variant.imagePreviews[slotIndex - 1]);

                      return (
                        <div
                          key={slotIndex}
                          className={`relative aspect-square overflow-hidden rounded-lg ${
                            preview
                              ? "bg-[#f0f1ed]"
                              : showAddButton
                                ? "border border-dashed border-[#85cf82] bg-[#f4fbf3]"
                                : "border border-[#eceee8] bg-[#f7f8f4]"
                          }`}
                        >
                          {preview ? (
                            <>
                              <img
                                src={preview}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => removeVariantImage(variantIndex, slotIndex)}
                                className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-900/80"
                              >
                                <X className="h-2.5 w-2.5 text-white" />
                              </button>
                            </>
                          ) : showAddButton ? (
                            <label className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-0.5">
                              <Camera className="h-3 w-3 text-[#4fb64a]" />
                              <span className="text-[7px] font-semibold text-[#4fb64a]">
                                Add Photo
                              </span>
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                aria-label={`Add photos for variant ${variantIndex + 1}`}
                                onChange={(event) => void handleImageAdd(variantIndex, event)}
                                className="hidden"
                              />
                            </label>
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <ImageIcon className="h-3 w-3 text-slate-300" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {simplePrice ? (
                  <div className="mt-5">
                    <label className="mb-2 block text-sm font-semibold text-slate-500">
                      Price
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                        ₹
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={variant.sizes[0]?.price ?? ""}
                        onChange={(event) => {
                          const newVariants = [...variants];
                          newVariants[variantIndex] = {
                            ...newVariants[variantIndex],
                            sizes: [{ size: "", price: event.target.value }],
                          };
                          onVariantsChange(newVariants);
                        }}
                        className={`w-full rounded-xl border bg-[#f7f8f4] py-3 pl-7 pr-3 text-sm text-slate-700 outline-none focus:border-[#85cf82] ${
                          priceError ? "border-red-300" : "border-[#e8ebe3]"
                        }`}
                        placeholder="237"
                      />
                    </div>
                    {priceError && (
                      <p className="mt-2 text-sm font-semibold text-red-500">{priceError}</p>
                    )}
                  </div>
                ) : (
                <div className="mt-5">
                  <label className="mb-2 block text-sm font-semibold text-slate-500">
                    Pricing
                  </label>
                  <div className="space-y-3">
                    {variant.sizes.map((sizeRow, sizeIndex) => {
                      const sizeLabel =
                        sizeFormat === "weight" ? "Weight" :
                        sizeFormat === "quantity" ? "Quantity" :
                        "Size";

                      return (
                      <div key={sizeIndex} className="flex items-end gap-3">
                        <div className="relative min-w-0 flex-[2]">
                          <span className="mb-1 block text-xs font-medium text-slate-400">
                            {sizeLabel} {sizeIndex + 1}
                          </span>
                          {sizeFormat === "alpha" || sizeFormat === "numeric" ? (
                            <>
                              <select
                                aria-label={`${sizeLabel} ${sizeIndex + 1} for variant ${variantIndex + 1}`}
                                value={sizeRow.size}
                                onChange={(event) =>
                                  updateVariantSize(variantIndex, sizeIndex, "size", event.target.value)
                                }
                                className="w-full appearance-none rounded-xl border border-[#e8ebe3] bg-[#f7f8f4] px-3 py-3 text-sm text-slate-500 outline-none focus:border-[#85cf82]"
                              >
                                <option value="">Choose {sizeLabel.toLowerCase()}</option>
                                {sizeOptions.map((option) => (
                                  <option key={option.size} value={option.size}>
                                    {option.size}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            </>
                          ) : sizeOptions.length > 0 ? (
                            <select
                              aria-label={`${sizeLabel} ${sizeIndex + 1} for variant ${variantIndex + 1}`}
                              value={sizeRow.size}
                              onChange={(event) =>
                                updateVariantSize(variantIndex, sizeIndex, "size", event.target.value)
                              }
                              className="w-full appearance-none rounded-xl border border-[#e8ebe3] bg-[#f7f8f4] px-3 py-3 text-sm text-slate-500 outline-none focus:border-[#85cf82]"
                            >
                              <option value="">Choose {sizeLabel.toLowerCase()}</option>
                              {sizeOptions.map((option) => (
                                <option key={option.size} value={option.size}>
                                  {option.size}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              aria-label={`${sizeLabel} ${sizeIndex + 1} for variant ${variantIndex + 1}`}
                              type="text"
                              value={sizeRow.size}
                              onChange={(event) =>
                                updateVariantSize(variantIndex, sizeIndex, "size", event.target.value)
                              }
                              placeholder={sizeFormat === "weight" ? "500 gm" : "1"}
                              className="w-full rounded-xl border border-[#e8ebe3] bg-[#f7f8f4] px-3 py-3 text-sm text-slate-500 outline-none focus:border-[#85cf82]"
                            />
                          )}
                        </div>
                        <div className="relative min-w-0 flex-[2]">
                          <span className="mb-1 block text-xs font-medium text-slate-400">
                            Price {sizeIndex + 1}
                          </span>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                              ₹
                            </span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={sizeRow.price}
                              onChange={(event) =>
                                updateVariantSize(
                                  variantIndex,
                                  sizeIndex,
                                  "price",
                                  event.target.value,
                                )
                              }
                              className={`w-full rounded-xl border bg-[#f7f8f4] py-3 pl-7 pr-3 text-sm text-slate-700 outline-none focus:border-[#85cf82] ${
                                priceError ? "border-red-300" : "border-[#e8ebe3]"
                              }`}
                              placeholder="237"
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeVariantSize(variantIndex, sizeIndex)}
                          className="flex h-10 w-10 items-center justify-center rounded-xl text-[#ff7f7f]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );})}
                    {priceError && (
                      <p className="text-sm font-semibold text-red-500">{priceError}</p>
                    )}
                    <button
                      type="button"
                      onClick={() => addVariantSize(variantIndex)}
                      className="w-full rounded-xl bg-[#f0f3f8] py-3 text-sm font-semibold text-slate-400"
                    >
                      {sizeFormat === "weight" ? "Add Weight +" :
                       sizeFormat === "quantity" ? "Add Quantity +" :
                       "Add Size +"}
                    </button>
                  </div>
                </div>
                )}
              </div>
          ))}

          <button
            type="button"
            onClick={addVariant}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1b2340] py-4 text-sm font-bold text-white"
          >
            <Plus className="h-4 w-4" />
            Add Variant
          </button>
          </div>
          </>
        )}
    </section>
  );
}
