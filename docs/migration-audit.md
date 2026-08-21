# WhatsCart migration audit

> Historical source-baseline audit. It describes the untouched
> `../whatsCartNew` application at the time the migration began; it is not a
> description of the current target runtime. For current status and the
> remaining production cutover, see [RESUME-HERE.md](RESUME-HERE.md).

## Source of truth

The current production source is the clean `main` branch in
`../whatsCartNew`. The migration attachment contains only a directory listing
of that repository; it does not contain the replacement tech stack referenced
in the request.

The target web runtime is Next.js 16 on Vercel, operated through Vercel CLI.
Firebase is the target data, authentication, storage, rules, and emulator
platform. The Clerk/Convex transition work recorded below is complete in the
target; the source repository remains untouched for rollback and export.

## Source topology at audit time

| Origin | Responsibility | Current implementation |
|---|---|---|
| `whatscart.in` | Public landing and legacy store URLs | React/Vite on Netlify |
| `app.whatscart.in` | Authenticated business dashboard/PWA | Same React bundle, Clerk + Convex |
| `admin.whatscart.in` | Protected super-admin portal | Same React bundle with host routing |
| `<business-id>.whatscart.in` | Canonical tenant storefront | Cloudflare wildcard Worker to Netlify |

Netlify Edge Functions currently inject tenant metadata, serve tenant robots
and sitemaps, and map wildcard hosts into the SPA. Cloudflare terminates
wildcard HTTPS and proxies tenant requests to the Netlify apex origin. The
Android application is a Bubblewrap/TWA wrapper around `app.whatscart.in` with
manual Java customizations present in the source repository.

There are two divergent Android module generations. The root module targets
`app.whatscart.in` as package `in.whatscart.app.twa`, while the nested
`bubblewrap` module targets `whatscart.netlify.app` as package
`app.netlify.whatscart.twa`. The published `public/well-known/assetlinks.json`
instead names `in.whatscart.twa`, and the nested `bubblewrap/assetlinks.json`
names another development package. These package/origin relationships must be
resolved before a TWA release can be considered verified. The tracked Java
customization is an Android Oreo-safe portrait-orientation override; the
Application and DelegationService subclasses are otherwise empty.

## Source application surface

The frontend is React 19, React Router 7, Tailwind 3, Clerk, and Convex. One
bundle contains:

- Public tenant storefront, product, catalog, cart, checkout, order history,
  order success, reference image, and review routes.
- Business onboarding, dashboard, products, catalogs, orders, analytics,
  profile, and store settings.
- The super-admin business and user management portal.

The Convex schema contains businesses, users, categories, products, business
variation options, catalogs, carts, orders, review requests/uploads/products
and aggregate stats, page views, product views, and product shares. The exact
table names and callable frontend/backend surface are captured in
`contracts/source-contract.json`.

## Design-system contract

This is a preservation migration, not a redesign. The dominant UI system uses
Inter/system sans typography, Tailwind utilities, responsive mobile-first
layouts, 12 px container radii, a blue dashboard primary token, and
tenant-defined storefront brand palettes. Storefront components also contain
purpose-built Figma assets and exact arbitrary Tailwind values.

The contract records every runtime `className`, `id`, and `data-testid`
initializer, including dynamic expressions, plus all static class tokens and
IDs. It also hashes the assets and platform files. Migration work must not
silently normalize, rename, or replace these selectors.

## Source baseline health

- Production Vite build: passes.
- Existing Vitest suite: 90 passing, 22 failing across 7 files.
- Main production JavaScript: 1.11 MB uncompressed / 310 kB gzip, with a Vite
  chunk-size warning.
- Both root and nested Bubblewrap Android modules assemble debug APKs, with
  obsolete Java 8 target and upcoming Gradle 9 compatibility warnings.
- Android package/origin trust is not verified and the checked-in asset-links
  package names contradict both build configurations.
- The stale tests are baseline debt and cannot be counted as migration
  regressions; migrated coverage still needs an all-green target-side suite.

## Target checkpoint

- Next.js 16.3.1 production compilation passes with the Vercel-oriented route
  structure, including tenant pages, robots, sitemap, and the Firebase session
  endpoint.
- Vercel CLI 59.1.3 is authenticated to `team-1917`; the project has not been
  linked or deployed because the transition bridge is not production-ready.
- Firebase Auth, Firestore, and Storage emulator startup passes using the
  checked-in rules and indexes.
- An emulator-created Firebase ID token can be verified by the Next.js route,
  exchanged for an HTTP-only five-day session cookie, and cleared on logout.
- Firebase user bootstrap creates the server-controlled user document, assigns
  configured super-admin roles through Admin custom claims, and refreshes the
  session when claims change. Firestore rules allow users to read their own
  record but prohibit client role/profile writes.
- Private onboarding APIs now cover owned-business lookup, protected slug
  checks, short-lived owner-scoped asset uploads, transactional business
  creation, and protected settings updates. Categories, catalogs, custom
  variation options, and products have owner-authorized Firebase CRUD paths.
  Emulator coverage proves the Auth/session path, role-write denial, ownership
  uniqueness, anonymous denial, cross-user upload/update denial, product and
  featured-product ownership, and Storage URL resolution.
- Public storefront reads use Firestore adapters with request-time hydration
  for indexable tenant HTML and `onSnapshot` subscriptions after hydration.
  The emulator suite covers business/product shapes, search, featured products,
  variants, catalogs, related products, approved reviews, security-rule denial
  for carts/orders, and live document updates without a page refresh.
- Customer reference-image uploads use short-lived HMAC authorization tokens,
  Firebase Storage, an 8 MB image-only boundary, and server-side URL
  resolution. The Storage emulator verifies the complete upload/download flow
  and rejects invalid media types and tampered tokens. Authenticated business
  upload tokens use a separate signed purpose and may also store magic-byte
  checked PDF FSSAI certificates without widening the public customer boundary.
- Public checkout, saved carts, order-success lookup, and customer order
  history have moved from direct Convex calls to Firebase-backed route
  handlers. The server validates every product, permitted price, quantity, and
  computed total; allocates the business order sequence in a transaction; and
  stores only hashes of the customer and per-order capability tokens.
- Cart, order, and mobile-history reads are denied without the matching
  capability. Business status changes require a verified Firebase identity and
  matching business ownership. The Firestore emulator covers price/total
  tampering, anonymous reads, incorrect capabilities, owner denial, and the
  successful end-to-end paths.
- Private dashboard order lists, details, and statistics now use owner-scoped
  Firestore listeners, with all direct client writes denied by rules. Manual
  creation, billing exclusion, internal notes, and status changes run through
  verified server routes with product ownership, recomputed-total, owner, and
  super-admin checks. Emulator coverage proves live no-refresh updates and
  cross-business read/write denial.
- Private analytics now use live owner-scoped Firestore adapters for totals,
  trends, traffic, conversion, products, and customers. Review requests,
  purpose-scoped uploads, exactly-once submissions, moderation, and review
  aggregates are also Firebase-backed. Emulator coverage validates live updates
  and the owner, public, and super-admin boundaries.
- The Firebase super-admin path aggregates businesses, users, products, and
  orders; toggles business availability; and performs confirmed owner deletion
  across Auth, Firestore, and exact safe Storage paths. It prevents self-delete
  and deletion of another super-admin.
- The exact UI contract passes after the scaffold and auth groundwork: all
  2,491 captured selectors and all hashed source assets match.
- Next.js production compilation and strict TypeScript validation are enabled;
  the inherited source-baseline test failures are tracked separately from the
  target migration gates in `RESUME-HERE.md`.

## Cache and update contract

The target must never require a customer to hard-refresh to see a deployment or
a published storefront change:

- Tenant pages are request-time rendered and carry browser revalidation plus
  `CDN-Cache-Control: no-store` and `Vercel-CDN-Cache-Control: no-store`.
- Browser Firestore reads remain subscribed after the server-rendered result is
  hydrated, so business, product, category, catalog, variant, and review
  changes update the open page.
- The service worker uses network-first navigation and mutable images. It uses
  cache-first only for `/_next/static/`, whose filenames are content-hashed.
- Each Vercel deployment generates a different service-worker cache namespace.
  The worker skips waiting, claims existing clients, removes old WhatsCart
  caches plus legacy Workbox/Vite caches, and the registration checks every 30
  seconds and on focus/visibility. Offline fallbacks only read the current
  deployment namespace, never an older global cache entry.
- `/sw.js`, APIs, shared files, and Next.js infrastructure bypass tenant
  rewrites. `/sw.js` itself is not cached at browser, CDN, or Vercel layers.

At Cloudflare cutover, the wildcard Worker and zone cache rules must preserve
the `rsc`, `next-router-*`, and `_rsc` request signals, honor all `no-store`
headers, and bypass cache for HTML/RSC, `/api/*`, and `/sw.js`. Only immutable
fingerprinted assets may receive long-lived caching. This is a staging-domain
gate before DNS changes.

## Migration gates

1. Confirm the Firebase Authentication sign-in/migration method for existing
   Clerk users before production account cutover.
2. Preserve every domain and canonical/redirect behavior, including tenant
   roots, product pages, `robots.txt`, and `sitemap.xml`.
3. Render indexable tenant storefront HTML on the server or at build/request
   time; metadata injection into an otherwise empty SPA is not sufficient.
4. Preserve all UI selectors, assets, responsive breakpoints, interaction
   states, and Bubblewrap/TWA behavior.
5. Map every captured Convex frontend call and backend export to the target
   data/auth/storage/function layer, including authorization and super-admin
   impersonation rules.
6. Migrate production data with repeatable validation, record counts, referential
   checks, storage-object checks, and a rollback path.
7. Verify with unit/integration tests, browser screenshots at representative
   mobile and desktop widths, SEO response inspection, Firebase emulators, and
   staging-domain smoke tests before DNS cutover.
8. Verify an in-place Firestore content update and a new Vercel deployment from
   an already-open browser session; neither may require a manual hard refresh.

## Resume checkpoint

The durable status, exact stopping point, remaining transition imports,
verification evidence, risks, and ordered production plan are in
[`RESUME-HERE.md`](RESUME-HERE.md). The conservative overall completion
estimate at that checkpoint is 80%.
