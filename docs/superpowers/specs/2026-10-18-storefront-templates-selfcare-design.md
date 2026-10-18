# Storefront Templates + Selfcare / Health Category — Design Spec

Date: 2026-10-18
Status: Draft
Related: `NilavTemplate.tsx`, `SuperAdminPortal.tsx`, `businessTypeConfig.ts`

## Goal

Give the super admin a place to see storefront templates and assign one to any
business. Each template is tied to a business category. Add a new onboarding
category **Selfcare / Health**; the existing `nilav` skin becomes that
category's template. Template choice is **admin-only** — store owners never see
it.

## Decisions (from brainstorming)

- "Template" = a full storefront skin, like `NilavTemplate` (layout + colours +
  fonts), not just a colour theme.
- Templates are tagged with a business category (`garments`, `home_bakery`,
  `handicrafts`, `selfcare`).
- `nilav` belongs to **selfcare**.
- `selfcare / Health` becomes a real, selectable onboarding category.
- **`selfcare` behaves exactly like `handicrafts`** across the whole app —
  product form fields, variation logic, customization options, server
  validation, order labels. Not just the storefront config.
- The nilav skin is **not** auto-applied to selfcare businesses. Only a
  business the super admin explicitly assigns `nilav` to wears it. Onboarding a
  selfcare store still shows the standard storefront until then.
- Template category is a **label/hint only**: the super admin may assign any
  template to any business. No migration of existing stores.
- The custom-template field is removed from the store owner settings UI.
- Scope option **A**: only `nilav` exists as a skin right now; other categories
  keep the standard storefront. The registry must support adding more skins
  later without touching every route.

## Non-goals

- No new skins beyond `nilav`.
- No automatic template assignment on business creation — super admin assigns.
- No per-category default skins for garments / home_bakery / handicrafts.
- No visual redesign of the super admin portal.

## Anti-goals

- Do not expose a template picker to store owners.
- Do not break existing businesses whose `customTemplateId === "nilav"`.
- Do not import React components into server code (template validation on the
  server must stay component-free).

## Current state

- Only one skin exists: `src/components/NilavTemplate.tsx`. It self-gates:
  `if (!business || business.customTemplateId !== "nilav") return fallback`
  (`NilavTemplate.tsx:60`).
- Every storefront route in `App.tsx:88-135` hardcodes
  `<NilavTemplate fallback={...} />`.
- `businesses.customTemplateId: string | null` (`private-business.ts:331`,
  `documents.ts:54-57`). Owner can edit it in `StoreSettings.tsx:636-651`.
- Business categories: `garments | home_bakery | handicrafts`
  (`types/product.ts:1`, `BusinessSetup.tsx:50-54`,
  `private-business.ts:10`). `food` is a legacy alias for `home_bakery`.
- Super admin: `SuperAdminPortal.tsx` + `super-admin-query.ts` +
  `super-admin.ts` + `api/private/super-admin/route.ts`,
  dispatched from `mutations.ts:158`.

## Design

### 1. Template registry (component-free metadata)

New file `src/lib/storefrontTemplates.ts` — plain data, no React import, safe
for server and client:

```ts
import type { BusinessType } from "../types/product";

export type StorefrontTemplateMeta = {
  id: string;              // stored in businesses.customTemplateId
  name: string;            // shown in super admin
  businessType: BusinessType; // category tie
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
  STOREFRONT_TEMPLATES.map((t) => t.id),
);

export function getTemplateMeta(id?: string | null) {
  return id ? STOREFRONT_TEMPLATES.find((t) => t.id === id) ?? null : null;
}
```

New file `src/components/storefrontTemplateHost.tsx` — maps id → component
(client-only):

```ts
const TEMPLATE_COMPONENTS: Record<string, FC<{ fallback: ReactNode }>> = {
  nilav: NilavTemplate,
};
```

### 2. Template host replaces hardcoded skin in `App.tsx`

New client component `src/components/StorefrontTemplateGate.tsx`:

1. Resolves `slug` exactly like `NilavTemplate.tsx:30-33`
   (`params.slug ?? searchParams.get("slug") ?? getTenantSlug(hostname)`).
2. `business = useQuery(api.businesses.getBusinessBySlug, slug ? { slug } : "skip")`.
3. `template = getTemplateMeta(business?.customTemplateId)`.
4. If no business or no matching template → return `fallback`.
5. Else render the mapped component: `<Component fallback={fallback} />`.

Missing template id (e.g. a component not registered) degrades to `fallback`.

`App.tsx`: replace every `<NilavTemplate fallback={X} />` with
`<StorefrontTemplateGate fallback={X} />` (lines 88-135).

`NilavTemplate.tsx` becomes a pure skin:

- Remove the `business.customTemplateId !== "nilav"` guard at line 60 →
  `if (!business) return <>{fallback}</>;`.
- Drop the `customTemplateId === "nilav"` condition in the cart-wiring effect
  (line 51); effect runs whenever `business._id` is present.
- Keep its own `getBusinessBySlug` query for content.

The gate and the skin each subscribe to the same business doc. Accepted for now
(Firestore client caches the doc; both subscriptions are cheap). Noted as a
possible later optimisation to pass `business` down as a prop.

### 3. New `selfcare` business category

- `types/product.ts`: add `"selfcare"` to `BUSINESS_TYPES`; add `"health"` to
  `LEGACY_BUSINESS_TYPES` with `normalizeBusinessType` mapping `health →
  selfcare`. Add a shared predicate (see 3a).
- `private-business.ts:10`: add `"selfcare"` to the valid-type `Set`.
- `businessTypeConfig.ts`: add a `selfcare` entry to
  `BUSINESS_TYPE_CONFIG` (typed `Record<BusinessType, ...>`, so TS forces it).
  Clone the `handicrafts` config (category suggestions, variation options,
  audience options, customization options), with storefront copy tuned to
  selfcare/health.
- `BusinessSetup.tsx:50-54`: add
  `{ value: "selfcare", label: "Selfcare / Health", icon: Heart }` (import
  `Heart` from `lucide-react`); widen the `businessType` state union at line 127.

### 3a. Selfcare = handicraft behaviour

`selfcare` must behave exactly like `handicrafts` everywhere the code branches
on the literal string. Most of those branches currently let an unknown type fall
through to a garments-ish default, which is wrong for selfcare.

Add one predicate to `types/product.ts`:

```ts
export function isHandicraftFamily(
  value: StoredBusinessType | null | undefined,
): boolean {
  if (!value) return false;
  const type = normalizeBusinessType(value);
  return type === "handicrafts" || type === "selfcare";
}
```

Then replace the handicraft-specific comparisons with the predicate:

| File | Lines | Change |
|---|---|---|
| `lib/productCustomization.ts` | 77, 85, 101 | `=== "handicrafts"` → `isHandicraftFamily(...)` |
| `components/products/storefrontVariants.tsx` | 25 | same |
| `components/products/ProductForm.tsx` | 212, 251, 277, 558, 1202, 1217 | `=== "handicrafts"` / `!== "handicrafts"` → predicate |
| `components/products/ProductTypeFields.tsx` | 191 | same |
| `components/ProductDetail.tsx` | 829, 1305 | same |
| `lib/orderDetails.ts` | 60 | same |
| `lib/firebase/private-products.ts` | 142, 155 | same (server validation: dietary/sizeFormat restriction + allowed customization options) |

Branches that only special-case `garments` / `home_bakery` need **no** change:
selfcare is neither, so it already falls into the same default path handicrafts
takes (e.g. `ProductForm.tsx:132-142`, `ProductDetail.tsx:1266-1298`,
FSSAI gating at `StoreSettings.tsx:701` and `DashboardHome.tsx:117`).

### 4. Super admin: Templates view + assignment

`super-admin-query.ts` — add `businessType` and `customTemplateId` to each row
of `observeBusinessList` output (lines 63-74).

`operations.ts:180-184` — add `setBusinessTemplate: Mutation` to
`superAdmin`.

`mutations.ts:158-164` — add `"superAdmin:setBusinessTemplate"` to the case
that posts to `/api/private/super-admin`.

`super-admin.ts` — new `setBusinessTemplateBySuperAdmin(firestore, rawBody)`:

- `businessId = requiredString(body.businessId, "businessId", 300)`.
- `templateId` must be `null` or a member of `STOREFRONT_TEMPLATE_IDS`.
- Reject unknown ids; load the business; `update({ customTemplateId: templateId })`.
- Return `{ businessId, customTemplateId }`.

`api/private/super-admin/route.ts` — dispatch
`"superAdmin:setBusinessTemplate"` to the new function (same super-admin claim
guard as the rest).

`SuperAdminPortal.tsx`:

- New **Templates** card listing `STOREFRONT_TEMPLATES` (name, category tag,
  description). Read-only catalogue; assignment happens per business.
- `BusinessSummary` gains `businessType` and `customTemplateId`.
- `BusinessRow` gains a template `<select>` (options: "Standard" = `null`, plus
  each template name). Any template can be picked for any business. Changing it
  calls `setBusinessTemplate({ businessId, templateId })`, toasts, and reflects
  the stored value. Disabled while updating, mirroring `handleStatusChange`.
- Legacy free-text id: if a business's stored `customTemplateId` is not in the
  registry, show it as an extra disabled option `Unknown (id: …)` (flagged), and
  change nothing until the admin explicitly picks another value. Never
  silently rewrite it to Standard.

### 5. Remove owner-facing template field

`StoreSettings.tsx`:

- Delete the "Custom template ID" block (lines 636-651).
- Remove `customTemplateId` from the local state (line 197) and from the save
  payload (lines 214, 283).

`private-business.ts` keeps accepting `customTemplateId` on the owner update
path for backward safety, but since the owner UI no longer sends it, admin
assignment is the only writer.

### Constraints / compatibility

- Firestore is schemaless: existing businesses with no `customTemplateId` read
  as `null` (`businessValue`) → gate falls back to the standard storefront.
- Existing `nilav` stores keep working: id unchanged.
- No Firestore rules change needed — `customTemplateId` is a field on
  `businesses`, already admin-writable and owner-writable as today.

## Testing

- Unit: `getTemplateMeta` returns the meta for `"nilav"`, `null` otherwise.
- Unit: `isHandicraftFamily("selfcare")` and `isHandicraftFamily("handicrafts")`
  are true; `"health"` legacy alias resolves to selfcare and is true.
- Unit/type: `BUSINESS_TYPE_CONFIG` and `normalizeBusinessType` cover
  `selfcare` and the `health` alias.
- Regression: existing handicraft product-form / product-detail tests
  (`product-form-business-types.test.tsx`, `product-detail-content.test.tsx`)
  stay green; add a selfcare case mirroring the handicraft case.
- Integration (emulator, extends `private-orders.integration.test.ts`
  super-admin block): `superAdmin:setBusinessTemplate` sets the id, accepts
  `null`, rejects an unknown id, and is denied for non-super-admin callers.
- Existing storefront/dashboard tests stay green.

## Files touched

- `src/lib/storefrontTemplates.ts` (new)
- `src/components/StorefrontTemplateGate.tsx` (new)
- `src/components/storefrontTemplateHost.tsx` (new)
- `src/components/NilavTemplate.tsx`
- `src/App.tsx`
- `src/types/product.ts`
- `src/lib/firebase/private-business.ts`
- `src/components/products/businessTypeConfig.ts`
- `src/components/BusinessSetup.tsx`
- `src/components/StoreSettings.tsx`
- `src/lib/firebase/super-admin-query.ts`
- `src/lib/firebase/super-admin.ts`
- `src/lib/firebase/operations.ts`
- `src/lib/firebase/mutations.ts`
- `src/app/api/private/super-admin/route.ts`
- `src/components/SuperAdminPortal.tsx`

Selfcare parity (3a):

- `src/lib/productCustomization.ts`
- `src/components/products/storefrontVariants.tsx`
- `src/components/products/ProductForm.tsx`
- `src/components/products/ProductTypeFields.tsx`
- `src/components/ProductDetail.tsx`
- `src/lib/orderDetails.ts`
- `src/lib/firebase/private-products.ts`

## Left to the builder

- Exact `selfcare` category suggestions / variation values (clone handicrafts).
- `Heart` vs another lucide icon for the Selfcare category card.
- Whether to collapse the duplicate business subscription in a follow-up.
