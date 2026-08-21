# WhatsCart migration — resume here

Checkpoint date: **2026-08-15 (Asia/Kolkata)**  
Target: `/home/positron/Documents/Projects/migration-whatscart`  
Untouched source: `/home/positron/Documents/Projects/whatsCartNew`

## Latest status check

Checked immediately before the original handoff; see the deployment update
below for newer external state.

- `rtk npm run typecheck`: pass, zero errors.
- `rtk npm run build`: pass with Next.js TypeScript validation enabled.
- `rtk npm run contract:verify-ui`: pass, 2,491/2,491 selectors and unchanged
  captured assets.
- `rtk npm run cloudflare:check`: pass with Wrangler 4.123.0, 1.29 KiB upload,
  no bindings.
- Vercel CLI 59.1.3: authenticated scope `whatscart`, project count **0**.
- Firebase CLI 15.4.0: authenticated account project count **0**.
- Worktree contains the migration edits and new handoff/tooling files shown by
  `rtk git status`; no deployment or production data write was performed.

The workspace is safe to pause here. Resume at “Remaining launch work” below;
the first external decision is the permanent Firebase project ID and Vercel
project name.

## Current completion estimate

**Overall production migration: 80% complete.**

The application/runtime migration is effectively complete locally. The final
20% is deliberately reserved for work that cannot be proven by local code
alone: creating/configuring the real Firebase project, rehearsing and running
the production data migration, Vercel preview/production deployment, domain and
Cloudflare validation, browser/visual checks, and resolving the inherited
Android app-identity conflict.

| Workstream | Complete | State |
|---|---:|---|
| Architecture/source audit and fidelity contract | 100% | Recorded in `contracts/` and `docs/migration-audit.md`. |
| Next.js 16/Vercel application migration | 100% local | Strict production build passes. No Vercel project/deploy exists yet. |
| Firebase Auth/Firestore/Storage implementation | 98% local | Runtime and rules are complete; a real Firebase project does not exist in the logged-in account. |
| Clerk/Convex runtime removal | 100% | Packages, providers, generated API layer, env vars, and target `convex/` backend removed. |
| Tenant SEO and fresh-deployment/cache behavior | 95% | SSR metadata, JSON-LD, robots, sitemap, live listeners, SW updates, and Cloudflare gateway implemented; production headers still need live validation. |
| Production data/Storage migration | 45% | Idempotent validated importer and account claim exist; real export/rehearsal/cutover have not run. |
| Tests, types, fidelity gates | 90% | Strict types/build, 29 emulator tests, and 2,491 selectors pass. The same inherited 22 source-baseline tests still fail. |
| Vercel/Cloudflare/DNS release | 45% | Vercel project is linked and deployed; domains, DNS switch, and Worker deploy remain. |
| PWA/Bubblewrap/TWA | 65% | Android source/manual Java copied and host retargeted; release identity must be confirmed before build/publish. |

This percentage is a production-readiness estimate, not a time estimate.

## Non-negotiable requirements preserved

- Next.js on Vercel, operated with Vercel CLI.
- Firebase Authentication, Firestore, and Storage only in the final runtime.
- No visible UI drift: IDs, class strings, assets, breakpoints, states, and
  routes remain source-compatible.
- `whatscart.in`, `app.whatscart.in`, `admin.whatscart.in`, and wildcard
  `<business-id>.whatscart.in` behavior remain intact.
- Tenant pages render indexable server HTML with canonical metadata, JSON-LD,
  robots, and sitemaps.
- Firestore changes reach open pages through `onSnapshot`; deployments activate
  through a versioned service worker and automatic controller reload. Users do
  not need to perform a hard refresh.
- Bubblewrap/manual Java source is preserved.

## What is complete

### Framework, routing, SEO, and cache behavior

- Migrated the React/Vite UI into Next.js 16 App Router while preserving the
  captured selector and asset contract.
- Added host-aware apex, dashboard, super-admin, and wildcard tenant routing.
- Added request-time Firestore storefront/product hydration, metadata,
  canonical URLs, Open Graph/Twitter data, escaped JSON-LD, tenant robots, and
  product/catalog sitemaps.
- Replaced the old Netlify share-meta test/helper with Next.js SEO helpers and
  tests.
- Tenant HTML/RSC, APIs, service worker, manifests, and mutable assets use
  browser/Vercel/Cloudflare no-store semantics. Only content-hashed
  `/_next/static/` files are treated as immutable.
- The deployment-versioned service worker uses network-first navigation and
  mutable images, immediately activates/claims clients, removes old
  Clerk/Convex caches, checks every 30 seconds and on focus/visibility, and
  automatically reloads when a new deployment controls the page.
- The target Cloudflare Worker preserves the original Host and all Next.js RSC,
  prefetch, cookie, and authorization headers. Wrangler dry-run passes.

### Firebase runtime

- Firebase browser/Admin configuration, emulator wiring, Firestore rules and
  indexes, Storage rules, and upload capabilities are implemented.
- Google sign-in, Firebase auth context/UI, ID-token exchange, five-day
  HTTP-only session cookies, logout, user bootstrap, immutable roles, and
  server-controlled super-admin claims are implemented.
- Existing migrated owners are claimed atomically on first same-email verified
  Firebase sign-in, moving business ownership from the old Convex ID to the new
  Firebase UID.
- Public storefront queries, search, featured/related products, variants,
  catalogs, carts, checkout, order success/history, customer uploads,
  analytics, and reviews are Firebase-backed and live.
- Private onboarding, settings, categories, catalogs, variations, product CRUD,
  manual orders, order status/notes/billing, analytics, review moderation, and
  super-admin deletion/enablement are Firebase-backed and owner-authorized.
- Customer/order access uses hashed high-entropy capabilities. Server paths
  recompute product prices/totals and enforce ownership.
- Clerk/Convex providers, hooks, generated API/types, packages, env vars, and
  target backend directory are gone. The only remaining strings are legacy SW
  cache names and migration/audit tooling.

### Production migration tooling

- `scripts/migration/migrate-convex-export.mjs` consumes the documented Convex
  directory export (`<table>/documents.jsonl` plus `_storage/`).
- Dry-run validation rejects broken references, duplicate slugs/IDs, or missing
  Storage objects before any Firebase write.
- IDs, timestamps, slugs, order numbers, relationships, analytics, reviews, and
  ownership are retained. Storage IDs/URLs are transformed to Firebase-safe
  deterministic business paths.
- Writes are checksum-marked and idempotent. Different existing data stops the
  run unless `--overwrite-existing` is explicit.
- Apply mode re-reads every Firestore document and Storage object after import
  and fails if the migration metadata/checksum does not match.
- Freeze, rehearsal, validation, and rollback instructions are in
  `docs/production-migration-runbook.md`.

### Android/PWA

- Copied the Bubblewrap/Gradle project and all manual Java sources without
  generated caches, local SDK config, APKs, or signing keys.
- Retargeted the TWA host, web manifest, scope, icon URL, and Android web asset
  statement from Netlify to `https://app.whatscart.in`.
- Added signing/build artifacts to `.gitignore`; the removed keystore remains
  recoverable from the untouched source.
- Recorded the inherited application-ID/fingerprint conflict in
  `docs/android-twa-audit.md`.

## Latest verified gates

All of these results are from this checkpoint:

- `rtk npm run typecheck`: **pass, zero errors**.
- `rtk npm run build`: **pass**, including Next.js TypeScript validation.
  `typescript.ignoreBuildErrors` has been removed.
- `rtk npm run contract:verify-ui`: **2,491/2,491 selectors**, no missing or
  unexpected selectors, no changed captured assets.
- Firebase emulators, serialized to avoid the Firestore emulator framing bug:
  **5 files / 29 tests passed**.
  - private onboarding: 10
  - private orders/analytics/reviews/super-admin: 6
  - public commerce: 6
  - public live query: 5
  - uploads: 2
- Convex export transformer: **2/2 passed**.
- Next storefront SEO helper: **3/3 passed**.
- Cloudflare Vercel gateway: **2/2 passed**.
- Wrangler 4.123.0 deployment dry-run: **pass**.
- Complete non-emulator Vitest run: **106 passed / 22 failed**. The 22 failures
  are exactly the seven-file source baseline recorded before migration; no new
  target-only assertion failure remains.
- Expected `PERMISSION_DENIED` emulator logs are intentional negative
  authorization assertions.

## Deployment update (2026-08-20, Asia/Kolkata)

- Firebase project `whatscart-in` and Web app
  `1:268769378922:web:301549216e820e90f28013` were created.
- Firestore was initialized; `firestore.rules` and `firestore.indexes.json`
  are deployed and current.
- Vercel project `whatscart` is linked in team `whatscart1` and has a ready
  production deployment at `https://whatscart-chi.vercel.app`.
- Firebase Storage is initialized and `storage.rules` is deployed. Firebase
  Authentication and Firebase Admin credentials are configured for the test
  deployment. No production data import has run.
- Production-domain authorization and DNS cutover remain outstanding.

## External state discovered

- Vercel CLI is authenticated to team `whatscart1`, which contains the linked
  `whatscart` project.
- Firebase CLI is authenticated to the `whatscart-in` project.

## Remaining launch work

1. Validate Firebase Authentication, Storage uploads, and Admin session flows
   on the test domain. Configure production OAuth authorized domains and
   billing/quotas before cutover.
2. Configure a non-production Firebase project if a rehearsal environment is
   required; Firestore rules/indexes are already deployed to `whatscart-in`.
3. Export Convex production with file storage to a private location; run the
   dry-run importer, seed preview Firebase, and validate counts/checksums and
   sample business/order/review/analytics behavior.
4. Configure Firebase Admin credentials and any missing preview environment
   variables, then validate the existing Vercel deployment.
5. Validate server HTML, metadata, canonical URLs, sitemap/robots, auth cookies,
   uploads, commerce, owner claim, super-admin, and live updates on preview.
6. Attach apex, `app`, `admin`, and wildcard domains. Update Cloudflare DNS to
   Vercel, then deploy the new gateway Worker only after preview headers pass.
7. Run real-browser mobile/desktop screenshot comparisons, PWA install/update,
   offline fallback, and a two-deployment no-hard-refresh test through
   Cloudflare.
8. Confirm the actual Play Console application ID and release-key fingerprint;
   reconcile `assetlinks.json`, securely restore the correct key, build/sign,
   and test the TWA upgrade.
9. Freeze old writes, take the final Convex export, run the verified production
   import, deploy production, switch DNS, monitor, and retain the old stack for
   rollback.

## Exact next commands after owner confirmation

Read `AGENTS.md`, this file, `docs/production-migration-runbook.md`, and
`docs/android-twa-audit.md`. Prefix every shell command with `rtk`.

Create/link the selected projects with their CLIs, then configure preview—not
production—first. The migration dry-run is:

```bash
rtk npm run migration:convex -- --source /secure/private/whatscart-convex-export --bucket YOUR_PREVIEW_BUCKET
```

The local green gate is:

```bash
rtk npm run typecheck
rtk npm run build
rtk npm run contract:verify-ui
rtk npm run cloudflare:check
```

Use the serialized emulator command recorded in the production runbook/checkpoint
history; running these five emulator files in parallel can trigger a known
Firestore emulator gRPC framing failure unrelated to application behavior.

## Workspace safety

- Treat `../whatsCartNew` as read-only.
- Never run destructive Git cleanup/reset commands; preserve unrelated user
  changes.
- Migration exports contain customer data and must stay outside Git.
- Never commit `.env*`, Firebase Admin keys, Android signing keys, local SDK
  paths, APK/AAB output, or migration token secrets.
- The deleted target `convex/` backend and Android keystore remain recoverable
  from the untouched source repository.
