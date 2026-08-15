# WhatsCart migration — resume checkpoint

Checkpoint date: **2026-08-15**  
Target workspace: `/home/positron/Documents/Projects/migration-whatscart`  
Read-only source: `/home/positron/Documents/Projects/whatsCartNew`

## Completion estimate

**Overall migration-to-production completion: 65%.**

The Firebase backend implementation itself is about **90% complete**. The
lower overall number is intentional: the remaining frontend runtime cutover,
production data migration, Vercel/Cloudflare domain validation, full visual
and browser testing, and Android TWA reconciliation are launch-critical.

| Workstream | Status | Notes |
|---|---:|---|
| Source audit and fidelity contract | 100% | Baseline, inventories, 2,491-selector UI contract, and asset hashes captured. |
| Next.js/Vercel shell, tenant SEO, cache design | 85% | Implemented locally; staging/proxy behavior is not yet validated. |
| Firebase Auth, Firestore, Storage, rules, repositories | 90% | Domain backend is implemented; private UI still uses the transition provider. |
| Public storefront and commerce cutover | 95% | Live reads, checkout, carts, history, uploads, and reviews are Firebase-backed. |
| Private/admin frontend runtime cutover | 35% | Adapters exist, but 19 files still import Clerk or Convex. |
| Type/test/visual release gates | 55% | Focused emulator suites are green; clean types, full suite, screenshots remain. |
| Production data and Storage migration | 0% | No production export/import has been performed. |
| Vercel, Cloudflare, DNS, PWA/TWA release | 10% | CLI/config groundwork exists; no target deploy has been made. |

This is a progress estimate, not a time estimate. The next safe milestone is
“transition bridge removed and every local gate green.”

## Non-negotiable requirements

- Host Next.js on Vercel and operate it with Vercel CLI.
- Use Firebase Auth, Firestore, and Storage. Clerk and Convex must not remain in
  the final runtime.
- Preserve the UI one-to-one: existing IDs, classes, assets, breakpoints,
  states, and routes cannot drift.
- Preserve `whatscart.in`, `app.whatscart.in`, `admin.whatscart.in`, and
  `<business-id>.whatscart.in` behavior.
- Tenant pages must be indexable server HTML, not an empty SPA with edge-only
  metadata injection.
- Firestore publications and new deployments must reach an already-open
  browser without a hard refresh.
- Preserve and validate the PWA/Bubblewrap path and manual Java changes.

## Repository rules

- Read `AGENTS.md` first. It includes `/home/positron/.codex/RTK.md`.
- Prefix every shell command with `rtk`.
- Treat `../whatsCartNew` as read-only migration input.
- Use `apply_patch` for hand-written edits.
- Read relevant Next.js 16 docs under `node_modules/next/dist/docs` before
  changing framework behavior.
- The target is currently entirely untracked in Git. Do not use destructive Git
  cleanup/reset operations or assume any untracked file is disposable.
- Run `npm run contract:verify-ui` after UI/provider changes.

## Completed work

### Audit, contracts, and target scaffold

- Audited React/Vite, Convex, Clerk, Netlify Edge, Cloudflare, service-worker,
  and Bubblewrap/TWA topology.
- Captured callable/schema and source health baselines in `contracts/`.
- Imported the UI into a Next.js 16 transition shell without intentional
  visible changes.
- Captured all relevant selector initializers and asset hashes. The last UI
  contract run passed all **2,491 selectors**.
- Added Vercel configuration/scripts. CLI 59.1.3 is authenticated to
  `team-1917`; the project is not yet linked or deployed.

### Tenant routing, SEO, and cache/update behavior

- Implemented host-aware apex, dashboard, super-admin, and wildcard tenant
  routing.
- Implemented request-rendered tenant storefront/product pages, metadata,
  JSON-LD, tenant robots, and sitemaps.
- Mutable HTML/RSC responses use no-store semantics at browser, Vercel CDN, and
  upstream CDN layers.
- Firestore queries keep `onSnapshot` subscriptions after server hydration, so
  open pages receive business, product, category, catalog, variant, review,
  order, and analytics changes.
- The service worker is deployment-versioned, network-first for navigation and
  mutable images, cache-first only for content-hashed `/_next/static/` files,
  activates immediately, claims clients, clears legacy app caches, and checks
  every 30 seconds plus focus/visibility.
- `/sw.js`, APIs, shared files, and Next infrastructure bypass tenant rewrites;
  `/sw.js` has browser/CDN/Vercel no-store headers.
- Cloudflare staging validation is still required to ensure the Worker forwards
  RSC signals and bypasses HTML/RSC/API/service-worker caching.

### Firebase foundation and authentication backend

- Added browser/Admin SDK setup, emulator wiring, Firestore rules/indexes,
  Storage rules, and Firebase configuration.
- Implemented Firebase ID-token to HTTP-only five-day session-cookie exchange
  and logout clearing.
- Implemented authenticated user bootstrap and server-controlled roles and
  super-admin claims.
- Firestore permits self-read of the user record but blocks client role/profile
  writes.
- Added a Firebase auth context with Google popup sign-in and token refresh.
- The visible private auth/provider cutover is not complete; Clerk still wraps
  the transition UI.

### Private onboarding, inventory, and business settings

- Owner-authorized business lookup, slug availability, transactional creation,
  and settings updates.
- Owner-authorized categories, catalogs, products, and custom variation option
  CRUD, including product/featured-product validation.
- Short-lived HMAC-scoped business uploads for images and magic-byte-verified
  FSSAI PDFs, plus Storage URL resolution.
- Emulator coverage includes session/bootstrap, immutable roles, slug and
  ownership boundaries, upload scoping, products, settings, and PDFs.

### Public storefront and commerce

- Firestore adapters for public businesses, products, categories, catalogs,
  variants, search/featured/related products, and approved reviews.
- Request-time Firebase hydration for SEO followed by live client listeners.
- Checkout validates products, permitted prices, quantities, and recomputes
  totals server-side; business order numbers are allocated transactionally.
- Saved carts, order success, and mobile history use high-entropy customer/order
  capabilities whose stored values are hashed.
- Private cart/order data is denied outside its capability or owner server path.
- Customer reference uploads use short-lived purpose-scoped HMAC tokens, image
  validation, an 8 MB limit, Storage persistence, and server resolution.

### Private orders

- Owner-scoped live lists, details, and statistics.
- Server-only manual creation, recomputed totals, product ownership, billing
  exclusions, notes, and status updates with owner/super-admin authorization.
- Direct client writes are denied; live and cross-business denial tests pass.
- Important: owner orders deliberately sort client-side. The emulator produced
  `Failed to frame message` when a range/order index was combined with the live
  query. Do not restore `orderBy` without an emulator regression test.

### Analytics

- Live owner adapters for revenue/orders/visitors/page views, top products and
  customers, sales trends, traffic, conversion, and product performance.
- UTC boundaries match Convex behavior. Direct client writes are denied.
- Emulator coverage validates calculations, live updates, roles, and isolation.

### Reviews

- Authenticated review requests, public token form, scoped JPEG/PNG/WebP review
  uploads (5 MB), and exactly-once complete-order submission validation.
- Storage URL resolution, owner/super-admin moderation, and transactional
  product-review aggregates.
- Live private state adapters and public approved reviews. The public review
  route is Firebase-only.
- Emulator coverage proves upload, submission, moderation, and public display.

### Super-admin

- Live business/user/product/order aggregation, business details, and business
  enable/disable.
- Confirmed deletion removes the exact owner graph from Auth, Firestore, and
  safe Storage paths; it requires a custom claim and blocks self-deletion or
  deletion of another super-admin.
- Emulator coverage proves ordinary-user denial and complete disposable-owner
  deletion.

## Verification state

The newest changes must be rerun together after resuming.

- Combined emulator run: **27/27 passed** across public query, commerce,
  uploads, onboarding, and the then-current private-order file.
- Expanded private domain test: **6/6 passed** in isolation, including analytics,
  reviews, and super-admin.
- Expected `PERMISSION_DENIED` logs come from negative authorization tests and
  do not indicate a failing process.
- Last `next build` passed before the newest analytics/review/super-admin code;
  rerun immediately.
- Last UI contract passed **2,491/2,491** before the newest import-only Review
  Form/tenant changes; rerun immediately.
- Recent Firebase repository/route diagnostics were clean individually.
- Explicit TypeScript is not green. `next.config.ts` temporarily uses
  `typescript.ignoreBuildErrors: true`; remove it before release.
- Known transition debt includes missing `src/assets/*`, business/ProductForm
  type mismatches, and a ShareSheet prop mismatch.
- Source baseline: 90 passing / 22 failing tests. An earlier broad target run:
  76 passing / 40 failing / 7 skipped, mostly stale bridge/source assertions.
  The focused Firebase emulator suites are currently the reliable signal.

## Exact stopping point

Work stopped immediately before the **atomic private frontend adapter and auth
cutover**.

There are **19 non-test source files** importing Clerk and/or Convex:

```text
src/App.tsx
src/app/legacy-app-shell.tsx
src/components/AdminProfilePage.tsx
src/components/AnalyticsPage.tsx
src/components/BusinessSetup.tsx
src/components/CatalogsPage.tsx
src/components/CategorySelect.tsx
src/components/CreateManualOrderModal.tsx
src/components/DashboardHome.tsx
src/components/DashboardProductDetailView.tsx
src/components/LandingPage.tsx
src/components/OrderDetailPage.tsx
src/components/OrderManagement.tsx
src/components/ProductManager.tsx
src/components/ProductsPage.tsx
src/components/ProfilePage.tsx
src/components/StoreSettings.tsx
src/components/SuperAdminPortal.tsx
src/components/products/ProductForm.tsx
src/main.tsx
```

All major backend operation families used by these screens have Firebase
implementations. Before changing imports, compare every `api.*.*` reference in
those files against the adapters in:

- `src/lib/firebase/public-query.ts`
- `src/lib/firebase/mutations.ts`
- `src/lib/firebase/analytics-query.ts`
- `src/lib/firebase/review-query.ts`
- `src/lib/firebase/super-admin-query.ts`

Pay special attention to `ProductForm`, business upload URL operations,
super-admin `useAction`, and auth bootstrap calls. Do not switch visible login
until this audit finds no unmapped private operation.

## Resume in this exact order

### Phase A — re-establish a green checkpoint

1. Read `AGENTS.md`, this file, and `docs/migration-audit.md`.
2. Run the combined emulators, including the expanded private domain test:

   ```bash
   rtk npm run firebase:emulators:exec -- --only auth,firestore,storage \
     "npx vitest run src/lib/firebase/__tests__/private-onboarding.integration.test.ts src/lib/firebase/__tests__/private-orders.integration.test.ts src/lib/firebase/__tests__/public-commerce.integration.test.ts src/lib/firebase/__tests__/public-query.integration.test.ts src/lib/firebase/__tests__/uploads.integration.test.ts"
   ```

3. Run `rtk npm run build` and `rtk npm run contract:verify-ui`.
4. Fix any regression before changing providers.

### Phase B — atomic Firebase frontend/auth cutover

1. Enumerate Clerk/Convex files and all `api.*.*` references with `rtk rg`.
2. Confirm every call maps to `useFirebaseQuery`, `useFirebaseMutation`, or
   `useFirebaseAction`. Add missing adapters and focused emulator coverage first.
3. Add a Firebase auth UI compatibility layer:
   - sign-in should clone the existing child and invoke Firebase Google sign-in
     without changing its markup/classes;
   - user control should provide avatar/account/sign-out behavior without
     changing captured selector strings.
4. Rewrite `src/app/legacy-app-shell.tsx` to use only
   `FirebaseAuthProvider`, Firebase query hydration, and the existing app.
5. Rewrite obsolete Vite entry `src/main.tsx` so even unused source no longer
   imports Clerk/Convex.
6. Switch private hook imports to Firebase adapters. Adapt Profile/AdminProfile
   to the Firebase user shape and switch Landing/SuperAdmin/App auth controls.
7. Preserve existing component markup and selector strings.
8. Run emulators, build, UI contract, and component tests before removing deps.

### Phase C — remove bridge and type debt

1. Replace `convex/_generated/api` and `convex/_generated/dataModel` imports
   with local Firebase operation descriptors/types, or refactor to typed
   Firebase constants.
2. Ensure query-key/function-name helpers do not depend on Convex references.
3. Confirm no source/runtime import remains for Clerk, `convex/react`, or
   Convex generated code.
4. Remove providers, env variables, packages, generated directory, stale bridge
   tests, and transition flags.
5. Fix all TypeScript errors, remove `typescript.ignoreBuildErrors`, and make
   both `rtk npm run typecheck` and `rtk npm run build` pass normally.
6. Rewrite/remove stale source tests and get the target suite green.

### Phase D — production data migration

1. Confirm the Clerk-user sign-in transition. Google users can reauthenticate;
   email/password or other identity methods need an explicit migration/account
   linking plan.
2. Create repeatable, idempotent Convex-to-Firestore and object-to-Storage
   scripts. Never mutate source data in dry runs.
3. Preserve IDs, slugs, order numbers, timestamps, and ownership; transform
   only target-required fields.
4. Validate document counts, relationships, sampled totals, capabilities,
   review aggregates, object counts, sizes, and checksums.
5. Record freeze/delta-sync and rollback procedures before cutover.

### Phase E — Vercel, Cloudflare, domains, and cache gate

1. Link/create the Vercel project with CLI. Configure browser Firebase, Admin
   Firebase, upload-secret, super-admin, and domain env vars in preview first.
2. Deploy a preview with Vercel CLI; do not begin with production DNS.
3. Validate all hosts/routes, server HTML, metadata, canonical URLs, robots,
   sitemaps, auth cookies, uploads, commerce, reviews, and super-admin.
4. Configure/validate custom domains and wildcard tenants. Retain the existing
   Cloudflare proxy until Vercel wildcard behavior is proven.
5. Cloudflare must forward `rsc`, `next-router-*`, and `_rsc` signals; bypass
   cache for HTML/RSC/API/service-worker traffic; honor no-store. Only immutable
   content-hashed assets receive long-lived caching.
6. Test from an already-open browser:
   - publish a Firestore content change and observe it live;
   - make a Vercel deployment and receive the new app/service worker;
   - repeat through a Cloudflare tenant host;
   - ensure offline fallback cannot resurrect an older deployment.
7. Change DNS only after preview/staging gates pass.

### Phase F — PWA/TWA and final fidelity

1. Resolve Bubblewrap identity conflicts:
   - root: `in.whatscart.app.twa` targeting `app.whatscart.in`;
   - nested: `app.netlify.whatscart.twa` targeting Netlify;
   - published asset links currently name `in.whatscart.twa`.
2. Select the real Play Store package and signing certificate. Regenerate
   matching asset links, manifest, and TWA config while preserving the Android
   Oreo-safe portrait-orientation Java customization.
3. Assemble/install the final APK and verify Digital Asset Links, navigation,
   auth, uploads, back behavior, updates, and offline/online transitions.
4. Run screenshot comparisons at representative mobile/desktop sizes and every
   key route/state, then rerun selector and asset contracts.

## Security and behavioral invariants

- Roles, ownership, and business-enabled state remain server-controlled.
- Direct writes to orders, analytics, reviews, and protected business data stay
  denied unless an intentionally safe operation exists.
- Server routes recompute money; client prices/totals are never trusted.
- Customer capabilities stay high entropy and hashed at rest.
- Upload capabilities stay short-lived and purpose/path scoped. Customer,
  business, and review tokens are not interchangeable.
- Files remain magic-byte/type/size checked before registration.
- Super-admin deletion remains confirmed and cannot delete self/another admin;
  it removes only exact related paths/documents.
- Firestore listeners stay active after server hydration.
- Mutable HTML, RSC, API, service-worker, and media responses cannot be stored
  in stale intermediary caches.

## Useful files

- Architecture/gates: `docs/migration-audit.md`
- Contracts: `contracts/source-contract.json`, `contracts/source-baseline.json`
- Rules/indexes: `firestore.rules`, `storage.rules`, `firestore.indexes.json`
- Delivery: `next.config.ts`, `vercel.json`, active Next host-routing file, and
  service-worker files under `public/`/`src/`
- Auth: `src/lib/firebase/auth-context.tsx`, `src/app/api/auth/`
- Adapters: `src/lib/firebase/public-query.ts`,
  `src/lib/firebase/mutations.ts`
- Repositories: `src/lib/firebase/private-*.ts`,
  `src/lib/firebase/analytics-query.ts`, `src/lib/firebase/reviews.ts`,
  `src/lib/firebase/review-query.ts`, `src/lib/firebase/super-admin.ts`,
  `src/lib/firebase/super-admin-query.ts`
- Integration tests: `src/lib/firebase/__tests__/`

## Definition of done

The migration is done only when Clerk and Convex are absent from runtime,
TypeScript and target tests are green, production data/Storage are validated,
all domains run through the target, UI/assets/browser visuals pass, TWA trust
is verified, and both a Firestore publication and Vercel deployment reach an
already-open browser without a hard refresh.
