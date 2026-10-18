# Storefront Templates + Selfcare / Health Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `selfcare / Health` onboarding category whose products behave exactly like handicrafts, and give the super admin a Templates view that assigns a storefront skin to any business (admin-only).

**Architecture:** A component-free template metadata registry (`src/lib/storefrontTemplates.ts`) drives a client template host + gate that replaces the hardcoded `NilavTemplate` in `App.tsx`. `selfcare` is added as a first-class `BusinessType` and aliased into handicraft behavior via one shared predicate. The super admin assigns `businesses.customTemplateId` through a new `superAdmin:setBusinessTemplate` operation.

**Tech Stack:** Next.js 16 App Router shell, React 19, react-router-dom 7, Firebase (Firestore + Admin), Tailwind, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-18-storefront-templates-selfcare-design.md`

## Global Constraints

- No new dependencies.
- `selfcare` behaves exactly like `handicrafts` everywhere the code branches on a business type.
- The nilav skin is **never auto-assigned**. Only a super admin explicitly setting `customTemplateId` makes a business wear it.
- Any template may be assigned to any business; the template's category is a label/hint only.
- Template selection is admin-only. Store owners must not see or edit it.
- Firestore is schemaless: a business with no/empty/unknown `customTemplateId` renders the standard storefront (`fallback`), never an error.
- Server code must not import React components (`storefrontTemplates.ts` stays component-free).
- Commits use Conventional Commits (`feat:`, `fix:`, `test:`, `refactor:`).
- Verify with `npm run typecheck` and `npm test` (integration tests auto-skip without emulators).

## Review Focus

Most likely to bite a user of this software, first:

1. A business whose stored `customTemplateId` is an old free-text value not in the registry → must render the standard storefront and must not be silently rewritten by the admin UI.
2. A legacy `businessType` (`food`, `clothing`, `accessories`) or the new `health` alias reaching a `BUSINESS_TYPE_CONFIG[businessType]` lookup → must be normalized first, or the config read crashes.
3. A business with `businessType` missing entirely reaching a `Record<BusinessType, …>` lookup → must not crash the product form/storefront.
4. `customTemplateId` being `null`, `""`, or `undefined` → treated as "standard", no crash, no template.
5. A non-super-admin or an unknown template id calling `superAdmin:setBusinessTemplate` → rejected (403 / 400).

Each line's test is pinned in the task that owns the code (Tasks 2-5).

---

### Task 1: `selfcare` business type + `isHandicraftFamily`

**Files:**
- Modify: `src/types/product.ts`
- Modify: `src/lib/firebase/private-business.ts:10`
- Modify: `src/components/products/businessTypeConfig.ts`
- Modify: `src/components/BusinessSetup.tsx` (imports, `BUSINESS_TYPES` at 50-54, state union at 127-129)
- Test: `src/lib/__tests__/selfcare-business-type.test.ts` (create)

**Interfaces:**
- Consumes: existing `BUSINESS_TYPES`, `normalizeBusinessType`, `BUSINESS_TYPE_CONFIG`.
- Produces:
  - `BUSINESS_TYPES` includes `"selfcare"`.
  - `normalizeBusinessType("health") === "selfcare"` (add `"health"` to `LEGACY_BUSINESS_TYPES`).
  - `isHandicraftFamily(value: StoredBusinessType | null | undefined): boolean` — true for `handicrafts`, `selfcare`, and legacy values normalizing to either; false otherwise.
  - `BUSINESS_TYPE_CONFIG.selfcare`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/__tests__/selfcare-business-type.test.ts
import { describe, expect, it } from "vitest";
import {
  BUSINESS_TYPES,
  isHandicraftFamily,
  normalizeBusinessType,
} from "../product";
import { BUSINESS_TYPE_CONFIG } from "../../components/products/businessTypeConfig";

describe("selfcare business type", () => {
  it("is a first-class business type", () => {
    expect(BUSINESS_TYPES).toContain("selfcare");
  });

  it("normalizes the health alias to selfcare", () => {
    expect(normalizeBusinessType("health")).toBe("selfcare");
  });

  it("treats selfcare and handicrafts as the same family", () => {
    expect(isHandicraftFamily("handicrafts")).toBe(true);
    expect(isHandicraftFamily("selfcare")).toBe(true);
    expect(isHandicraftFamily("health")).toBe(true);
    expect(isHandicraftFamily("garments")).toBe(false);
    expect(isHandicraftFamily(undefined)).toBe(false);
    expect(isHandicraftFamily(null)).toBe(false);
  });

  it("has a product config entry", () => {
    expect(BUSINESS_TYPE_CONFIG.selfcare.categorySuggestions.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/selfcare-business-type.test.ts`
Expected: FAIL — `isHandicraftFamily` is not exported / `"selfcare"` not in list.

- [ ] **Step 3: Add the type, alias, and predicate in `src/types/product.ts`**

Change line 1 and the legacy list, add the branch to `normalizeBusinessType`, and append the predicate:

```ts
export const BUSINESS_TYPES = ["garments", "home_bakery", "handicrafts", "selfcare"] as const;
// ...
export const LEGACY_BUSINESS_TYPES = ["food", "clothing", "accessories", "health"] as const;
// inside normalizeBusinessType, before the final return:
  if (value === "health") {
    return "selfcare";
  }
// ...
export function isHandicraftFamily(
  value: StoredBusinessType | null | undefined,
): boolean {
  if (!value) return false;
  const type = normalizeBusinessType(value);
  return type === "handicrafts" || type === "selfcare";
}
```

- [ ] **Step 4: Add `selfcare` to server validation and product config**

`src/lib/firebase/private-business.ts:10`:

```ts
const BUSINESS_TYPES = new Set(["garments", "home_bakery", "handicrafts", "selfcare"]);
```

`src/components/products/businessTypeConfig.ts` — append a `selfcare` entry to `BUSINESS_TYPE_CONFIG` cloned from `handicrafts`, with the label copy tuned (values below are the pinned minimum; other strings may be tuned):

```ts
  selfcare: {
    categorySuggestions: ["Home Decor", "Jewelry", "Gift Items"],
    variationOptions: [
      { variantType: "Material", values: ["Wood", "Clay", "Metal", "Resin"] },
      { variantType: "Color", values: ["Natural", "Black", "White", "Blue"] },
      { variantType: "Style", values: ["Minimal", "Rustic", "Traditional"] },
      { variantType: "Finish", values: ["Matte", "Glossy", "Polished"] },
      { variantType: "Design", values: ["Floral", "Geometric", "Abstract"] },
    ],
    audienceOptions: [
      { value: "female", label: "Female" },
      { value: "male", label: "Male" },
      { value: "unisex", label: "Unisex" },
      { value: "kid", label: "Kid" },
    ],
    customizationLabel: "Allow Selfcare Personalization",
    customizationOptions: [
      { value: "custom_engraving", label: "Custom engraving (names, dates, quotes)" },
      { value: "embroidered_text", label: "Embroidered text/designs" },
      { value: "customer_photo_upload", label: "Customer photo upload (printed/etched)" },
    ],
    storefront: {
      shippingBanner: "Selfcare essentials shipped with care",
      directConnectionTitle: "Direct Maker Connection",
      directConnectionBody:
        "Confirm personalization and dispatch timelines directly on WhatsApp.",
    },
  },
```

- [ ] **Step 5: Add the onboarding card in `src/components/BusinessSetup.tsx`**

Add `Heart` to the `lucide-react` import block (`:40-46`), extend the local `BUSINESS_TYPES` (`:50-54`), and widen the state union (`:127-129`):

```ts
const BUSINESS_TYPES = [
  { value: "garments", label: "Garments", icon: Shirt },
  { value: "home_bakery", label: "Home Bakery", icon: Sparkles },
  { value: "handicrafts", label: "Handicrafts", icon: PaintbrushVertical },
  { value: "selfcare", label: "Selfcare / Health", icon: Heart },
] as const;
// ...
const [businessType, setBusinessType] = useState<
  "garments" | "home_bakery" | "handicrafts" | "selfcare" | ""
>("");
```

- [ ] **Step 6: Run tests + typecheck**

Run: `npx vitest run src/lib/__tests__/selfcare-business-type.test.ts && npm run typecheck`
Expected: PASS, no type errors. (Adding `"selfcare"` to `BusinessType` makes the `Record<BusinessType, ProductTypeConfig>` in `businessTypeConfig.ts` demand the new entry — Step 4 supplies it.)

- [ ] **Step 7: Commit**

```bash
git add src/types/product.ts src/lib/firebase/private-business.ts src/components/products/businessTypeConfig.ts src/components/BusinessSetup.tsx src/lib/__tests__/selfcare-business-type.test.ts
git commit -m "feat: add selfcare/health business category"
```

---

### Task 2: Apply handicraft parity across behavior code

**Files:**
- Modify: `src/lib/productCustomization.ts` (77, 85, 101)
- Modify: `src/components/products/storefrontVariants.tsx` (25)
- Modify: `src/components/products/ProductForm.tsx` (212, 251, 277, 558, 1202, 1217)
- Modify: `src/components/products/ProductTypeFields.tsx` (191)
- Modify: `src/components/ProductDetail.tsx` (829, 1305)
- Modify: `src/lib/orderDetails.ts` (60)
- Modify: `src/lib/firebase/private-products.ts` (142, 155)
- Test: `src/lib/__tests__/selfcare-parity.test.ts` (create); `src/components/__tests__/product-form-business-types.test.tsx` (extend)

**Interfaces:**
- Consumes: `isHandicraftFamily` (Task 1).
- Produces: no new exports — behavior of existing functions when passed `"selfcare"` matches `"handicrafts"`.

For every site, replace the literal comparison with the predicate:
`businessType === "handicrafts"` → `isHandicraftFamily(businessType)`;
`businessType !== "handicrafts"` → `!isHandicraftFamily(businessType)`.

In `private-products.ts` reuse the existing `HANDICRAFT_CUSTOMIZATION_OPTIONS` set for the `selfcare` branch (do not duplicate it):

```ts
if (isHandicraftFamily(businessType) && (dietaryClassification || sizeFormat)) {
  throw new Error("Handicraft product details are invalid.");
}
// ...
if (
  isHandicraftFamily(businessType) &&
  options.some((option) => !HANDICRAFT_CUSTOMIZATION_OPTIONS.has(option))
) {
  throw new Error("Handicraft customization options are invalid.");
}
```

Add `isHandicraftFamily` to the existing `../../types/product` import in `private-products.ts`.

- [ ] **Step 1: Write the failing unit test**

```ts
// src/lib/__tests__/selfcare-parity.test.ts
import { describe, expect, it } from "vitest";
import {
  getCustomizationTextFieldLabel,
  getCustomizationImageFieldLabel,
  requiresDirectCheckout,
} from "../productCustomization";
import { getCustomizationSectionTitle } from "../orderDetails";
import { getProductMetaChips } from "../../components/products/storefrontVariants";

describe("selfcare parity with handicrafts", () => {
  it("uses handicraft customization copy", () => {
    expect(getCustomizationTextFieldLabel("selfcare", ["custom_engraving"])).toBe(
      "Personalization details",
    );
    expect(getCustomizationImageFieldLabel("selfcare", ["customer_photo_upload"])).toBe(
      "Reference image",
    );
    expect(getCustomizationSectionTitle("selfcare")).toBe("Personalization");
  });

  it("shows the handicraft personalizable meta chip", () => {
    expect(
      getProductMetaChips("selfcare", { audience: "unisex", customizationEnabled: true }),
    ).toEqual(["Unisex", "Personalizable"]);
  });

  it("requires direct checkout like handicrafts", () => {
    expect(
      requiresDirectCheckout("selfcare", {
        customizationEnabled: true,
        customizationOptions: ["custom_engraving"],
      }),
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/__tests__/selfcare-parity.test.ts`
Expected: FAIL — selfcare currently returns the generic (non-handicraft) copy.

- [ ] **Step 3: Apply the predicate at every site listed in Files**

Import `isHandicraftFamily` where needed and swap the comparisons. Example edits:

`src/lib/productCustomization.ts`
```ts
if (isHandicraftFamily(businessType)) {
  return "Personalization details";
}
```
```ts
if (isHandicraftFamily(businessType)) {
  return "Share the name, date, quote, or stitch details you want added...";
}
```
```ts
return isHandicraftFamily(businessType) ? "Reference image" : "Upload image";
```

`src/components/products/storefrontVariants.tsx`
```ts
if (isHandicraftFamily(businessType)) {
  return [
    details?.audience ? capitalize(details.audience) : null,
    details?.customizationEnabled ? "Personalizable" : null,
  ].filter(Boolean);
}
```

`src/components/products/ProductForm.tsx` — replace at all six sites, e.g.:
```ts
if (!hasColorVariants || isHandicraftFamily(businessType)) {
```
```ts
const isSimplePrice = isHandicraftFamily(businessType);
```
```ts
if (!isHandicraftFamily(businessType) && parentSizeOptions.length > 0) {
```
```ts
const hasIncompleteSizePrice =
  !isHandicraftFamily(businessType) &&
  variant.sizes.some((row) => row.size.trim() && !row.price.trim());
```
```tsx
simplePrice={isHandicraftFamily(businessType)}
```
```tsx
{isHandicraftFamily(businessType) && (
```

`src/components/products/ProductTypeFields.tsx`
```tsx
{isHandicraftFamily(businessType) && (
  <Field label="Audience">
```

`src/components/ProductDetail.tsx`
```tsx
{isHandicraftFamily(businessType)
  ? "Personalization Add-ons"
  : "Customization Add-ons"}
```
```ts
if (isHandicraftFamily(businessType) && details.customizationEnabled) {
```

`src/lib/orderDetails.ts`
```ts
if (isHandicraftFamily(businessType)) {
  return "Personalization";
}
```

Leave untouched every `garments` / `home_bakery` only branch (`ProductForm.tsx:132-142,438,445,507,512,647,656,735,751,891,1179`, `ProductDetail.tsx:1266-1298`, `StoreSettings.tsx:701`, `DashboardHome.tsx:117`) — selfcare is neither, so it already shares the handicraft default path.

- [ ] **Step 4: Extend the component test with a selfcare case**

`src/components/__tests__/product-form-business-types.test.tsx` — add, mirroring the existing handicraft test at line 158:

```tsx
it("renders selfcare personalization like handicrafts", () => {
  render(
    <ProductForm
      businessId={"biz_1" as never}
      businessType={"selfcare" as never}
      onCancel={vi.fn()}
      onSuccess={vi.fn()}
    />,
  );

  expect(screen.getByText("Audience")).toBeInTheDocument();
  expect(screen.getByText("Allow Selfcare Personalization")).toBeInTheDocument();
  expect(screen.queryByText("Dietary Classification")).not.toBeInTheDocument();
});
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run src/lib/__tests__/selfcare-parity.test.ts src/components/__tests__/product-form-business-types.test.tsx && npm run typecheck`
Expected: PASS, no type errors. Existing handicraft cases still pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/productCustomization.ts src/components/products/storefrontVariants.tsx src/components/products/ProductForm.tsx src/components/products/ProductTypeFields.tsx src/components/ProductDetail.tsx src/lib/orderDetails.ts src/lib/firebase/private-products.ts src/lib/__tests__/selfcare-parity.test.ts src/components/__tests__/product-form-business-types.test.tsx
git commit -m "feat: make selfcare behave like handicrafts across product surfaces"
```

---

### Task 3: Template registry, host, and gate

**Files:**
- Create: `src/lib/storefrontTemplates.ts`
- Create: `src/components/storefrontTemplateHost.tsx`
- Create: `src/components/StorefrontTemplateGate.tsx`
- Modify: `src/components/NilavTemplate.tsx:51,60`
- Modify: `src/App.tsx:26,88-135`
- Test: `src/lib/__tests__/storefront-templates.test.ts` (create); `src/components/__tests__/storefront-template-gate.test.tsx` (create)

**Interfaces:**
- Consumes: `BusinessType` (Task 1), `api.businesses.getBusinessBySlug`, `NilavTemplate`.
- Produces:
  - `StorefrontTemplateMeta = { id: string; name: string; businessType: BusinessType; description: string }`
  - `STOREFRONT_TEMPLATES: StorefrontTemplateMeta[]`
  - `STOREFRONT_TEMPLATE_IDS: Set<string>`
  - `getTemplateMeta(id?: string | null): StorefrontTemplateMeta | null`
  - `STOREFRONT_TEMPLATE_COMPONENTS: Record<string, ComponentType<{ fallback: ReactNode }>>`
  - `<StorefrontTemplateGate fallback={ReactNode} />`

- [ ] **Step 1: Write the failing registry test**

```ts
// src/lib/__tests__/storefront-templates.test.ts
import { describe, expect, it } from "vitest";
import {
  getTemplateMeta,
  STOREFRONT_TEMPLATE_IDS,
  STOREFRONT_TEMPLATES,
} from "../storefrontTemplates";

describe("storefront template registry", () => {
  it("registers nilav as the selfcare template", () => {
    const meta = getTemplateMeta("nilav");
    expect(meta).not.toBeNull();
    expect(meta?.businessType).toBe("selfcare");
    expect(STOREFRONT_TEMPLATE_IDS.has("nilav")).toBe(true);
    expect(STOREFRONT_TEMPLATES.length).toBe(1);
  });

  it("returns null for missing or unknown ids", () => {
    expect(getTemplateMeta(null)).toBeNull();
    expect(getTemplateMeta(undefined)).toBeNull();
    expect(getTemplateMeta("")).toBeNull();
    expect(getTemplateMeta("does-not-exist")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/__tests__/storefront-templates.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/lib/storefrontTemplates.ts`**

```ts
import type { BusinessType } from "../types/product";

export type StorefrontTemplateMeta = {
  id: string;
  name: string;
  businessType: BusinessType;
  description: string;
};

export const STOREFRONT_TEMPLATES: StorefrontTemplateMeta[] = [
  {
    id: "nilav",
    name: "Nilav",
    businessType: "selfcare",
    description: "Nature-inspired layout for Selfcare / Health stores.",
  },
];

export const STOREFRONT_TEMPLATE_IDS = new Set(
  STOREFRONT_TEMPLATES.map((template) => template.id),
);

export function getTemplateMeta(
  id?: string | null,
): StorefrontTemplateMeta | null {
  if (!id) return null;
  return STOREFRONT_TEMPLATES.find((template) => template.id === id) ?? null;
}
```

- [ ] **Step 4: Create `src/components/storefrontTemplateHost.tsx`**

```tsx
import type { ComponentType, ReactNode } from "react";
import { NilavTemplate } from "./NilavTemplate";

export type StorefrontTemplateComponent = ComponentType<{
  fallback: ReactNode;
}>;

export const STOREFRONT_TEMPLATE_COMPONENTS: Record<
  string,
  StorefrontTemplateComponent
> = {
  nilav: NilavTemplate,
};
```

- [ ] **Step 5: Create `src/components/StorefrontTemplateGate.tsx`**

```tsx
"use client";

import type { ReactNode } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useFirebaseQuery as useQuery } from "../lib/firebase/hooks";
import { api } from "../lib/firebase/operations";
import { getTenantSlug } from "../lib/urls";
import { useRuntimeHostname } from "../context/RuntimeLocationContext";
import { getTemplateMeta } from "../lib/storefrontTemplates";
import { STOREFRONT_TEMPLATE_COMPONENTS } from "./storefrontTemplateHost";

export function StorefrontTemplateGate({ fallback }: { fallback: ReactNode }) {
  const params = useParams<{ slug?: string }>();
  const [searchParams] = useSearchParams();
  const runtimeHostname = useRuntimeHostname();
  const slug =
    params.slug ?? searchParams.get("slug") ?? getTenantSlug(runtimeHostname);
  const business = useQuery(
    api.businesses.getBusinessBySlug,
    slug ? { slug } : "skip",
  );
  const meta = getTemplateMeta(business?.customTemplateId);
  const Component = meta ? STOREFRONT_TEMPLATE_COMPONENTS[meta.id] : undefined;
  if (!Component) return <>{fallback}</>;
  return <Component fallback={fallback} />;
}
```

- [ ] **Step 6: De-gate `NilavTemplate.tsx`**

Replace line 51 effect and line 60 guard so the skin always renders when mounted:

```ts
useEffect(() => {
  if (business?._id) updateBusinessId(business._id);
}, [business?._id, updateBusinessId]);
```
```ts
if (!business) return <>{fallback}</>;
```

- [ ] **Step 7: Wire the gate into `src/App.tsx`**

Replace the import at line 26 with:

```ts
import { StorefrontTemplateGate } from "./components/StorefrontTemplateGate";
```

Then replace **all** `<NilavTemplate fallback=` occurrences with `<StorefrontTemplateGate fallback=` (routes at 88-135). `NilavTemplate` is no longer imported by `App.tsx`.

- [ ] **Step 8: Write the gate behavior test**

```tsx
// src/components/__tests__/storefront-template-gate.test.tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StorefrontTemplateGate } from "../StorefrontTemplateGate";

const mockBusiness = { current: null as any };

vi.mock("../../lib/firebase/hooks", () => ({
  useFirebaseQuery: vi.fn(() => mockBusiness.current),
}));
vi.mock("../../context/RuntimeLocationContext", () => ({
  useRuntimeHostname: () => "demo.example.com",
}));
vi.mock("../storefrontTemplateHost", () => ({
  STOREFRONT_TEMPLATE_COMPONENTS: {
    nilav: () => <div>Nilav skin</div>,
  },
}));

// Rendered on a matching route so `useParams().slug` is "demo".
function renderGate() {
  return render(
    <MemoryRouter initialEntries={["/store/demo"]}>
      <Routes>
        <Route
          path="/store/:slug"
          element={
            <StorefrontTemplateGate fallback={<div>Standard storefront</div>} />
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("StorefrontTemplateGate", () => {
  beforeEach(() => {
    mockBusiness.current = null;
  });

  it("renders the standard storefront for a business with no template", () => {
    mockBusiness.current = { _id: "b1", customTemplateId: null };
    renderGate();
    expect(screen.getByText("Standard storefront")).toBeInTheDocument();
  });

  it("renders the standard storefront for an unknown template id", () => {
    mockBusiness.current = { _id: "b1", customTemplateId: "legacy-free-text" };
    renderGate();
    expect(screen.getByText("Standard storefront")).toBeInTheDocument();
  });

  it("renders the registered skin when a template is assigned", () => {
    mockBusiness.current = { _id: "b1", customTemplateId: "nilav" };
    renderGate();
    expect(screen.getByText("Nilav skin")).toBeInTheDocument();
  });
});
```

- [ ] **Step 9: Run tests + typecheck**

Run: `npx vitest run src/lib/__tests__/storefront-templates.test.ts src/components/__tests__/storefront-template-gate.test.tsx && npm run typecheck`
Expected: PASS, no type errors.

- [ ] **Step 10: Commit**

```bash
git add src/lib/storefrontTemplates.ts src/components/storefrontTemplateHost.tsx src/components/StorefrontTemplateGate.tsx src/components/NilavTemplate.tsx src/App.tsx src/lib/__tests__/storefront-templates.test.ts src/components/__tests__/storefront-template-gate.test.tsx
git commit -m "feat: resolve storefront skin from a template registry"
```

---

### Task 4: Super-admin `setBusinessTemplate` backend

**Files:**
- Modify: `src/lib/firebase/super-admin.ts`
- Modify: `src/app/api/private/super-admin/route.ts`
- Modify: `src/lib/firebase/operations.ts:180-184`
- Modify: `src/lib/firebase/mutations.ts:158-164`
- Test: `src/lib/firebase/__tests__/private-orders.integration.test.ts` (extend, emulator)

**Interfaces:**
- Consumes: `STOREFRONT_TEMPLATE_IDS` (Task 3), `requiredString` helper in `super-admin.ts`.
- Produces:
  - `setBusinessTemplateBySuperAdmin(firestore: Firestore, rawBody: unknown): Promise<{ businessId: string; customTemplateId: string | null }>`
  - `api.superAdmin.setBusinessTemplate` mutation, dispatched as operation string `"superAdmin:setBusinessTemplate"`.

- [ ] **Step 1: Write the failing integration test**

In `src/lib/firebase/__tests__/private-orders.integration.test.ts`, inside the super-admin block (after the `enabled` assertion at line 998), add:

```ts
const setTemplate = await operation(
  superAdmin,
  "superAdmin:setBusinessTemplate",
  { businessId: "private-orders-business", customTemplateId: "nilav" },
);
expect(setTemplate.status).toBe(200);
expect(
  (await firestore.collection("businesses").doc("private-orders-business").get())
    .data()?.customTemplateId,
).toBe("nilav");

const clearTemplate = await operation(
  superAdmin,
  "superAdmin:setBusinessTemplate",
  { businessId: "private-orders-business", customTemplateId: null },
);
expect(clearTemplate.status).toBe(200);

const unknownTemplate = await operation(
  superAdmin,
  "superAdmin:setBusinessTemplate",
  { businessId: "private-orders-business", customTemplateId: "not-a-template" },
);
expect(unknownTemplate.status).toBe(400);

const forbidden = await operation(owner, "superAdmin:setBusinessTemplate", {
  businessId: "private-orders-business",
  customTemplateId: "nilav",
});
expect(forbidden.status).toBe(403);
```

- [ ] **Step 2: Run to verify it fails**

Run (with emulators if available; otherwise it skips): `npx vitest run src/lib/firebase/__tests__/private-orders.integration.test.ts`
Expected: FAIL / skipped — operation not implemented. To run for real, start emulators: `npm run firebase:emulators:exec -- "npx vitest run src/lib/firebase/__tests__/private-orders.integration.test.ts"`.

- [ ] **Step 3: Add `setBusinessTemplateBySuperAdmin` in `src/lib/firebase/super-admin.ts`**

Add the import `import { STOREFRONT_TEMPLATE_IDS } from "../storefrontTemplates";` and, below `setBusinessEnabledBySuperAdmin`:

```ts
export async function setBusinessTemplateBySuperAdmin(
  firestore: Firestore,
  rawBody: unknown,
) {
  if (!rawBody || typeof rawBody !== "object") {
    throw new Error("Business update is invalid.");
  }
  const body = rawBody as UnknownRecord;
  const businessId = requiredString(body.businessId, "businessId", 300);
  const raw = body.customTemplateId;
  let customTemplateId: string | null;
  if (raw === undefined || raw === null || raw === "") {
    customTemplateId = null;
  } else if (typeof raw === "string" && STOREFRONT_TEMPLATE_IDS.has(raw)) {
    customTemplateId = raw;
  } else {
    throw new Error("customTemplateId is invalid.");
  }
  const business = await firestore.collection("businesses").doc(businessId).get();
  if (!business.exists) throw new Error("Business not found.");
  await business.ref.update({ customTemplateId });
  return { businessId, customTemplateId };
}
```

- [ ] **Step 4: Dispatch in `src/app/api/private/super-admin/route.ts`**

Add `setBusinessTemplateBySuperAdmin` to the existing import and add a branch:

```ts
if (body.operation === "superAdmin:setBusinessEnabled") {
  result = await setBusinessEnabledBySuperAdmin(firestore, body.args);
} else if (body.operation === "superAdmin:setBusinessTemplate") {
  result = await setBusinessTemplateBySuperAdmin(firestore, body.args);
} else if (
```

- [ ] **Step 5: Register the operation reference and dispatch**

`src/lib/firebase/operations.ts:180-184`:
```ts
  superAdmin: {
    getBusinessForAdmin: Query<LooseDocument | null>;
    listBusinesses: Query<LooseDocument[]>;
    setBusinessEnabled: Mutation;
    setBusinessTemplate: Mutation;
  };
```

`src/lib/firebase/mutations.ts:158`:
```ts
        case "superAdmin:setBusinessEnabled":
        case "superAdmin:setBusinessTemplate":
        case "adminDeletion:deleteUserAndOwnedDataByEmail":
```

- [ ] **Step 6: Run tests + typecheck**

Run: `npx vitest run src/lib/firebase/__tests__/private-orders.integration.test.ts && npm run typecheck`
Expected: PASS (or skipped without emulators), no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/firebase/super-admin.ts src/app/api/private/super-admin/route.ts src/lib/firebase/operations.ts src/lib/firebase/mutations.ts src/lib/firebase/__tests__/private-orders.integration.test.ts
git commit -m "feat: super-admin operation to assign a storefront template"
```

---

### Task 5: Super-admin Templates view + assignment

**Files:**
- Modify: `src/lib/firebase/super-admin-query.ts:63-74`
- Modify: `src/components/SuperAdminPortal.tsx`
- Test: `src/components/__tests__/super-admin-portal.test.tsx` (extend)

**Interfaces:**
- Consumes: `STOREFRONT_TEMPLATES` (Task 3), `api.superAdmin.setBusinessTemplate` (Task 4), `normalizeBusinessType`.
- Produces: `BusinessSummary` gains `businessType: string` and `customTemplateId: string | null`.

- [ ] **Step 1: Extend the query payload**

`src/lib/firebase/super-admin-query.ts` — import `normalizeBusinessType` from `../../types/product` and add to the emitted row (after `businessType` and `customTemplateId` are read from the raw doc):

```ts
return {
  _id: business._id,
  createdAt: business._creationTime,
  isEnabled: business.isEnabled !== false,
  name: business.name,
  orderCount: orderCounts.get(String(business._id)) ?? 0,
  ownerEmail: owner?.email ?? "",
  ownerId,
  ownerName: business.ownerName ?? owner?.name ?? "Unknown owner",
  productCount: productCounts.get(String(business._id)) ?? 0,
  slug: business.slug,
  businessType:
    typeof business.businessType === "string"
      ? normalizeBusinessType(business.businessType)
      : "",
  customTemplateId:
    typeof business.customTemplateId === "string"
      ? business.customTemplateId
      : null,
};
```

- [ ] **Step 2: Write/adjust the failing UI test**

`src/components/__tests__/super-admin-portal.test.tsx` — add `businessType: "garments"` and `customTemplateId: null` to each `businesses` fixture, split the mutation mock per operation, and add a case:

```tsx
const mockSetBusinessTemplate = vi.fn();
// ...
vi.mock("../../lib/firebase/mutations", () => ({
  useFirebaseMutation: vi.fn((operation: { __operationName?: string }) =>
    operation?.__operationName === "superAdmin:setBusinessTemplate"
      ? mockSetBusinessTemplate
      : mockSetBusinessEnabled,
  ),
  useFirebaseAction: vi.fn(() => mockDeleteUserData),
}));
```

```tsx
it("assigns a storefront template from the business row", async () => {
  mockSetBusinessTemplate.mockResolvedValue({
    businessId: "business_123",
    customTemplateId: "nilav",
  });
  render(<SuperAdminPortal />);

  fireEvent.change(screen.getByLabelText("Storefront template"), {
    target: { value: "nilav" },
  });

  await waitFor(() =>
    expect(mockSetBusinessTemplate).toHaveBeenCalledWith({
      businessId: "business_123",
      customTemplateId: "nilav",
    }),
  );
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/components/__tests__/super-admin-portal.test.tsx`
Expected: FAIL — no "Storefront template" control.

- [ ] **Step 4: Add the Templates card**

In `SuperAdminWorkspace`, import `STOREFRONT_TEMPLATES` and render a catalogue card above "Onboarded businesses":

```tsx
<div className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
  <div className="border-b border-slate-200 px-6 py-5">
    <h2 className="font-semibold">Storefront templates</h2>
    <p className="mt-1 text-sm text-slate-500">
      Assign a skin to any business below. Owners cannot change this.
    </p>
  </div>
  <div className="divide-y divide-slate-100">
    {STOREFRONT_TEMPLATES.map((template) => (
      <div key={template.id} className="flex items-center gap-3 px-6 py-4">
        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200">
          {template.businessType}
        </span>
        <div>
          <p className="font-semibold">{template.name}</p>
          <p className="text-sm text-slate-500">{template.description}</p>
        </div>
      </div>
    ))}
  </div>
</div>
```

- [ ] **Step 5: Add the per-business picker**

Update the `BusinessSummary` type and add the control inside `BusinessRow` (next to the enable/disable button):

```tsx
type BusinessSummary = {
  // ...existing fields
  businessType: string;
  customTemplateId: string | null;
};
```

```tsx
const setBusinessTemplate = useMutation(api.superAdmin.setBusinessTemplate);
const knownTemplate = STOREFRONT_TEMPLATES.some(
  (template) => template.id === business.customTemplateId,
);
const [isUpdatingTemplate, setIsUpdatingTemplate] = useState(false);

const handleTemplateChange = async (value: string) => {
  setIsUpdatingTemplate(true);
  try {
    const next = value === "" ? null : value;
    await setBusinessTemplate({
      businessId: business._id,
      customTemplateId: next,
    });
    toast.success(
      next
        ? `${business.name} now uses the ${next} template`
        : `${business.name} now uses the standard storefront`,
    );
  } catch (error) {
    toast.error(getErrorMessage(error));
  } finally {
    setIsUpdatingTemplate(false);
  }
};
```

```tsx
<label className="flex items-center gap-2 text-sm text-slate-600">
  <span className="sr-only">Storefront template</span>
  <select
    aria-label="Storefront template"
    value={business.customTemplateId ?? ""}
    disabled={isUpdatingTemplate}
    onChange={(event) => handleTemplateChange(event.target.value)}
    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-950"
  >
    <option value="">Standard</option>
    {STOREFRONT_TEMPLATES.map((template) => (
      <option key={template.id} value={template.id}>
        {template.name}
      </option>
    ))}
    {business.customTemplateId && !knownTemplate && (
      <option value={business.customTemplateId} disabled>
        Unknown ({business.customTemplateId})
      </option>
    )}
  </select>
</label>
```

- [ ] **Step 6: Run tests + typecheck**

Run: `npx vitest run src/components/__tests__/super-admin-portal.test.tsx && npm run typecheck`
Expected: PASS — enable/disable, deletion, and new template-assignment cases all pass; no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/firebase/super-admin-query.ts src/components/SuperAdminPortal.tsx src/components/__tests__/super-admin-portal.test.tsx
git commit -m "feat: super-admin templates view with per-business assignment"
```

---

### Task 6: Remove the owner-facing template field

**Files:**
- Modify: `src/components/StoreSettings.tsx` (delete block 636-651; remove state 197; remove stateRef entry 214; remove payload field 283)

**Interfaces:**
- Consumes: nothing new.
- Produces: `StoreSettings` no longer reads or writes `customTemplateId`. Keep the `customTemplateId?: string | null` field on the local `Business` type (line 71) — the document still carries it.

- [ ] **Step 1: Confirm no owner path needs it**

Run: `npx vitest run src/components/__tests__/store-settings-brand-palette.test.tsx`
Expected: PASS (baseline before the edit).

- [ ] **Step 2: Delete the field block and its wiring**

- Remove the `const [customTemplateId, setCustomTemplateId] = useState(business.customTemplateId || "");` line (197).
- Remove the `customTemplateId,` entry from the `stateRef.current = { … }` object (214).
- Remove the `customTemplateId: s.customTemplateId || null,` line from the `updateBusiness({ … })` payload (283).
- Delete the entire "Custom template ID" `<div className="border-t border-gray-100 pt-4">…</div>` block (636-651).
- If `customTemplateId` becomes an unused local, remove it; do not remove the `Business` type field.

- [ ] **Step 3: Verify**

Run: `npx vitest run src/components/__tests__/store-settings-brand-palette.test.tsx && npm run typecheck`
Expected: PASS, no unused-variable or type errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/StoreSettings.tsx
git commit -m "refactor: remove owner-facing custom template field"
```

---

## Final verification

- [ ] `npm run typecheck` — clean.
- [ ] `npm test` — all suites pass (integration auto-skips without emulators; run with emulators for the super-admin task).
- [ ] Manual smoke: sign in at `admin.<root>`, see the Templates card, assign `nilav` to a business, open that business's storefront and confirm the Nilav skin; assign Standard and confirm the standard storefront returns; open `StoreSettings` as an owner and confirm no template field.
