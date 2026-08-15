import { ChevronDown, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { BUSINESS_TYPE_CONFIG } from "./businessTypeConfig";
import type {
  BusinessType,
  DietaryClassification,
  ProductAudience,
  ProductCustomizationOption,
} from "../../types/product";

type SizeRow = {
  size: string;
  price: string;
};

interface ProductTypeFieldsProps {
  businessType: BusinessType;
  audience: ProductAudience;
  dietaryClassification?: DietaryClassification;
  customizationEnabled: boolean;
  customizationOptions: ProductCustomizationOption[];
  sizeFormat: "alpha" | "numeric";
  sizes: SizeRow[];
  priceError?: string;
  hideSizeSection?: boolean;
  onAudienceChange: (audience: ProductAudience) => void;
  onDietaryClassificationChange: (
    dietaryClassification: DietaryClassification,
  ) => void;
  onCustomizationEnabledChange: (enabled: boolean) => void;
  onCustomizationOptionsChange: (
    customizationOptions: ProductCustomizationOption[],
  ) => void;
  onSizeFormatChange: (sizeFormat: "alpha" | "numeric") => void;
  onUpdateSizeRow: (
    index: number,
    key: keyof SizeRow,
    value: string,
  ) => void;
  onAddSizeRow: () => void;
  onRemoveSizeRow: (index: number) => void;
}

const ALPHA_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const NUMERIC_SIZES = ["30", "32", "34", "36", "38", "40"];

export function ProductTypeFields({
  businessType,
  audience,
  dietaryClassification,
  customizationEnabled,
  customizationOptions,
  sizeFormat,
  sizes,
  priceError,
  hideSizeSection,
  onAudienceChange,
  onDietaryClassificationChange,
  onCustomizationEnabledChange,
  onCustomizationOptionsChange,
  onSizeFormatChange,
  onUpdateSizeRow,
  onAddSizeRow,
  onRemoveSizeRow,
}: ProductTypeFieldsProps) {
  const config = BUSINESS_TYPE_CONFIG[businessType];

  if (businessType === "garments") {
    return (
      <>
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h3 className="text-[15px] font-bold text-slate-800">
            Product Details
          </h3>

          <div className="mt-4">
            <Field label="Gender">
              <ChoiceGroup
                options={config.audienceOptions ?? []}
                selectedValue={audience}
                onSelect={(value) => onAudienceChange(value as ProductAudience)}
              />
            </Field>
          </div>
        </section>

        {!hideSizeSection && (
        <section id="product-price-section" className="rounded-2xl bg-white p-4 shadow-sm">
          <h3 className="text-[15px] font-bold text-slate-800">
            Price & Size Variations
          </h3>

          <div className="mt-4 space-y-4">
            <Field label="Select Size Format">
              <div className="space-y-3">
                <RadioRow
                  label="Alpha S/M/L/XL/XXL"
                  checked={sizeFormat === "alpha"}
                  onClick={() => onSizeFormatChange("alpha")}
                />
                <RadioRow
                  label="Numeric Inches"
                  checked={sizeFormat === "numeric"}
                  onClick={() => onSizeFormatChange("numeric")}
                />
              </div>
            </Field>

            <div className="space-y-3">
              {sizes.map((row, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="relative min-w-0 flex-1">
                    <select
                      aria-label={`Size ${index + 1}`}
                      value={row.size}
                      onChange={(event) =>
                        onUpdateSizeRow(index, "size", event.target.value)
                      }
                      className="w-full appearance-none rounded-xl border border-[#e8ebe3] bg-[#f7f8f4] px-3 py-3 text-sm text-slate-500 outline-none focus:border-[#85cf82]"
                    >
                      <option value="">Size {index + 1}</option>
                      {(sizeFormat === "alpha"
                        ? ALPHA_SIZES
                        : NUMERIC_SIZES
                      ).map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>

                  <div className="relative min-w-0 flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                      ₹
                    </span>
                    <input
                      aria-label={`Price ${index + 1}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.price}
                      onChange={(event) =>
                        onUpdateSizeRow(index, "price", event.target.value)
                      }
                      className={`w-full rounded-xl border bg-[#f7f8f4] py-3 pl-7 pr-3 text-sm text-slate-700 outline-none focus:border-[#85cf82] ${
                        priceError ? "border-red-300" : "border-[#e8ebe3]"
                      }`}
                      placeholder="237"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => onRemoveSizeRow(index)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-[#ff7f7f]"
                    aria-label={`Remove size ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            {priceError && (
              <p className="text-sm font-semibold text-red-500">{priceError}</p>
            )}

            <button
              type="button"
              onClick={onAddSizeRow}
              className="w-full rounded-xl bg-[#f0f3f8] py-3 text-sm font-semibold text-slate-400"
            >
              Add Size +
            </button>
          </div>
        </section>
        )}
      </>
    );
  }

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h3 className="text-[15px] font-bold text-slate-800">Product Details</h3>

      <div className="mt-4 space-y-4">
        {businessType === "handicrafts" && (
          <Field label="Audience">
            <ChoiceGroup
              options={config.audienceOptions ?? []}
              selectedValue={audience}
              onSelect={(value) => onAudienceChange(value as ProductAudience)}
            />
          </Field>
        )}

        {businessType === "home_bakery" && (
          <Field label="Dietary Classification">
            <ChoiceGroup
              options={config.dietaryOptions ?? []}
              selectedValue={dietaryClassification}
              onSelect={(value) =>
                onDietaryClassificationChange(value as DietaryClassification)
              }
            />
          </Field>
        )}

        {businessType === "home_bakery" && !hideSizeSection && (
          <section id="product-price-section" className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="text-[15px] font-bold text-slate-800">
              Price & Size Variations
            </h3>

            <div className="mt-4 space-y-4">
              <Field label="Select Size Format">
                <div className="space-y-3">
                  {(config.sizeFormatOptions ?? []).map((option) => (
                    <label
                      key={option.value}
                      className="flex cursor-pointer items-center gap-3"
                    >
                      <input
                        type="radio"
                        name="sizeFormat"
                        value={option.value}
                        checked={sizeFormat === option.value}
                        onChange={() =>
                          onSizeFormatChange(
                            option.value as "weight" | "quantity",
                          )
                        }
                        className="h-4 w-4 accent-[#46b038]"
                      />
                      <span className="text-sm text-slate-700">
                        {option.label}
                      </span>
                    </label>
                  ))}
                </div>
              </Field>

              <div className="space-y-3">
                {sizes.map((row, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="relative min-w-0 flex-1">
                      <label
                        htmlFor={`bakery-size-${index}`}
                        className="mb-1 block text-sm font-semibold text-slate-500"
                      >
                        {sizeFormat === "weight" ? "Weight" : "Quantity"} {index + 1}
                      </label>
                      <input
                        id={`bakery-size-${index}`}
                        type="text"
                        value={row.size}
                        onChange={(event) =>
                          onUpdateSizeRow(index, "size", event.target.value)
                        }
                        placeholder={sizeFormat === "weight" ? "500 gm" : "1"}
                        className="w-full rounded-xl border border-[#e8ebe3] bg-[#f7f8f4] px-3 py-3 text-sm text-slate-500 outline-none focus:border-[#85cf82]"
                      />
                    </div>

                    <div className="relative min-w-0 flex-1">
                      <label
                        htmlFor={`bakery-price-${index}`}
                        className="mb-1 block text-sm font-semibold text-slate-500"
                      >
                        Price {index + 1}
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                          ₹
                        </span>
                        <input
                          id={`bakery-price-${index}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.price}
                          onChange={(event) =>
                            onUpdateSizeRow(index, "price", event.target.value)
                          }
                          className="w-full rounded-xl border border-[#e8ebe3] bg-[#f7f8f4] py-3 pl-7 pr-3 text-sm text-slate-700 outline-none focus:border-[#85cf82]"
                          placeholder="237"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onRemoveSizeRow(index)}
                      disabled={sizes.length === 1}
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#e8ebe3] text-slate-400 hover:border-red-300 hover:text-red-500 disabled:opacity-30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={onAddSizeRow}
                  className="w-full rounded-xl bg-[#f0f3f8] py-3 text-sm font-semibold text-slate-400"
                >
                  Add Variant +
                </button>
              </div>
            </div>
          </section>
        )}

        <div className="space-y-3">
          <ToggleRow
            label={config.customizationLabel ?? "Customization"}
            checked={customizationEnabled}
            onClick={() => {
              const nextEnabled = !customizationEnabled;
              onCustomizationEnabledChange(nextEnabled);
              if (!nextEnabled) {
                onCustomizationOptionsChange([]);
              }
            }}
          />

          <ChoiceGroup
            options={config.customizationOptions ?? []}
            selectedValues={customizationOptions}
            onSelect={(value) => {
              const option = value as ProductCustomizationOption;
              const exists = customizationOptions.includes(option);
              const nextOptions = exists
                ? customizationOptions.filter((item) => item !== option)
                : [...customizationOptions, option];

              if (!customizationEnabled) {
                onCustomizationEnabledChange(true);
              }

              onCustomizationOptionsChange(nextOptions);
            }}
            disabled={!customizationEnabled && customizationOptions.length === 0}
          />
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}

function ChoiceGroup({
  options,
  selectedValue,
  selectedValues,
  onSelect,
  disabled = false,
}: {
  options: Array<{ value: string; label: string }>;
  selectedValue?: string;
  selectedValues?: string[];
  onSelect: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = selectedValues
          ? selectedValues.includes(option.value)
          : selectedValue === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelect(option.value)}
            disabled={disabled}
            aria-pressed={selected}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
              selected
                ? "bg-[#58bb4f] text-white"
                : "bg-[#f2f3ef] text-slate-500"
            } ${disabled ? "opacity-50" : ""}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onClick,
}: {
  label: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={checked}
      className="flex w-full items-center justify-between rounded-xl bg-[#f7f8f4] px-4 py-3 text-left"
    >
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <span
        className={`flex h-7 w-12 items-center rounded-full p-1 transition ${
          checked ? "bg-[#57bb4f]" : "bg-slate-300"
        }`}
      >
        <span
          className={`h-5 w-5 rounded-full bg-white transition ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}

function RadioRow({
  label,
  checked,
  onClick,
}: {
  label: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
        checked
          ? "border-[#58bb4f] bg-[#f7fbf5]"
          : "border-[#e8ebe3] bg-[#f7f8f4]"
      }`}
    >
      <span className="text-sm font-semibold text-slate-600">{label}</span>
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-full border ${
          checked ? "border-[#58bb4f]" : "border-slate-300"
        }`}
      >
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            checked ? "bg-[#58bb4f]" : "bg-transparent"
          }`}
        />
      </span>
    </button>
  );
}
