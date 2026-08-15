import { Check, ChevronDown } from "lucide-react";
import {
  RETURN_ACCEPTED_CONDITIONS,
  type ProductReturnPolicy,
  type ReturnAcceptedCondition,
} from "../../types/product";

interface ProductReturnPolicySectionProps {
  value: ProductReturnPolicy;
  onChange: (value: ProductReturnPolicy) => void;
}

const CONDITION_LABELS: Record<ReturnAcceptedCondition, string> = {
  unused: "Unused",
  original_packaging: "Original packaging",
  damaged: "Damaged",
  wrong_item: "Wrong item",
  other: "Other",
};

const RETURN_WINDOWS = [3, 7, 14, 30];

export function ProductReturnPolicySection({
  value,
  onChange,
}: ProductReturnPolicySectionProps) {
  const setReturnable = (returnable: boolean) => {
    onChange({
      ...value,
      returnable,
      returnWindowDays: returnable ? value.returnWindowDays ?? 7 : undefined,
      acceptedConditions: returnable
        ? value.acceptedConditions.length > 0
          ? value.acceptedConditions
          : ["unused"]
        : [],
    });
  };

  const toggleCondition = (condition: ReturnAcceptedCondition) => {
    const selected = value.acceptedConditions.includes(condition);
    onChange({
      ...value,
      acceptedConditions: selected
        ? value.acceptedConditions.filter((item) => item !== condition)
        : [...value.acceptedConditions, condition],
    });
  };

  return (
    <section id="product-return-policy-section">
      <h3 className="text-lg font-bold leading-7 text-slate-900">Return policy</h3>
      <div className="mt-4 space-y-5 rounded-xl border border-[#3dac350d] bg-white p-5 shadow-sm">
        <fieldset>
          <legend className="mb-3 pl-1 text-base font-semibold text-slate-700">
            Is this product returnable
          </legend>
          <div className="space-y-2">
            {[true, false].map((option) => (
              <label key={String(option)} className="flex cursor-pointer items-center gap-2 text-base">
                <input
                  type="radio"
                  name="product-returnable"
                  value={String(option)}
                  checked={value.returnable === option}
                  onChange={() => setReturnable(option)}
                  className="peer sr-only"
                />
                <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${value.returnable === option ? "border-[#3dac35]" : "border-slate-300"}`}>
                  <span className={`h-2.5 w-2.5 rounded-full bg-[#3dac35] ${value.returnable === option ? "opacity-100" : "opacity-0"}`} />
                </span>
                <span className={value.returnable === option ? "text-black" : "text-gray-500"}>
                  {option ? "Yes" : "No"}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {value.returnable && (
          <>
            <label className="block">
              <span className="mb-1.5 block pl-1 text-base font-semibold text-slate-700">
                Return Window
              </span>
              <span className="relative block">
                <select
                  aria-label="Return Window"
                  value={value.returnWindowDays ?? 7}
                  onChange={(event) =>
                    onChange({ ...value, returnWindowDays: Number(event.target.value) })
                  }
                  className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-4 text-base text-gray-500 outline-none focus:border-[#85cf82] focus:ring-2 focus:ring-[#85cf82]/20"
                >
                  {RETURN_WINDOWS.map((days) => (
                    <option key={days} value={days}>{days} days</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </span>
            </label>

            <fieldset>
              <legend className="mb-3 pl-1 text-base font-semibold text-slate-700">
                Return Accepted if
              </legend>
              <div className="space-y-3">
                {RETURN_ACCEPTED_CONDITIONS.map((condition) => {
                  const selected = value.acceptedConditions.includes(condition);
                  return (
                    <label key={condition} className="flex cursor-pointer items-center gap-2 text-base text-gray-500">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleCondition(condition)}
                        className="peer sr-only"
                      />
                      <span className={`flex h-5 w-5 items-center justify-center rounded border ${selected ? "border-[#3dac35] bg-[#3dac35]" : "border-slate-300 bg-white"}`}>
                        {selected && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                      </span>
                      {CONDITION_LABELS[condition]}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </>
        )}
      </div>
    </section>
  );
}
