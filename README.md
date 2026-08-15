# WhatsCart migration

This workspace is the target of the WhatsCart platform migration. The current
production source remains in the sibling `../whatsCartNew` repository and is
treated as read-only migration input.

The migration has an explicit zero-visual-drift constraint: existing element
IDs, class names, assets, routes, and responsive behavior must remain stable.
The source contract in [`contracts/source-contract.json`](contracts/source-contract.json)
captures those invariants before framework or backend code is changed.

## Current state

- Source architecture and baseline health have been audited.
- The production source builds successfully.
- The source test baseline is recorded in
  [`contracts/source-baseline.json`](contracts/source-baseline.json).
- The original React UI has been imported byte-for-byte into a Next.js 16
  transition shell.
- Tenant request routing, request-time metadata, JSON-LD, robots, and sitemaps
  are implemented for the Firebase-backed target model.
- Vercel is the confirmed web host; Firebase provides the target auth, data,
  storage, rules, and local emulators.
- The Next.js production build passes and Vercel CLI authentication is available
  for the target team.
- Firebase Auth, Firestore, and Storage emulators start successfully. The new
  Firebase ID-token to HTTP-only session-cookie exchange also passes an
  end-to-end emulator test.
- Firebase private onboarding now includes verified user bootstrap, immutable
  server-assigned roles, owned-business lookup, protected slug checks,
  owner-scoped business-asset uploads, transactional business creation, and
  protected settings updates. Categories, catalogs, variation options, and
  product CRUD also have owner-authorized Firebase repositories. Business
  uploads allow images and verified PDF FSSAI certificates, while anonymous
  customer upload capabilities remain image-only. The visible login remains on
  the temporary bridge until every dependent dashboard screen has a Firebase
  repository, avoiding a broken dual-auth cutover.
- Public businesses, products, categories, catalogs, variants, related
  products, reviews, analytics, and customer image uploads now use Firebase.
  Tenant storefront and product pages render real Firestore data in their
  initial indexable HTML and continue with live Firestore subscriptions.
- Public checkout, saved carts, order-success lookup, and mobile order history
  now use validated Firebase APIs. Prices and totals are recomputed from
  Firestore, order sequences are transactional, and private order/cart data is
  protected by high-entropy customer/order capabilities rather than guessable
  order IDs or mobile numbers.
- Private order management now uses owner-scoped live Firestore reads and
  authenticated server mutations. Manual orders validate products and totals,
  allocate the same transactional order sequence, and keep billing exclusions,
  notes, and status changes behind owner or super-admin authorization. The
  emulator proves that an open dashboard receives order changes without a
  refresh and cannot read another business's orders.
- Analytics, the review lifecycle, and super-admin business/user management now
  have Firebase repositories, protected routes, live adapters, rules, and
  emulator coverage. Their remaining transition work is the atomic removal of
  Clerk/Convex from the private UI.
- Delivery caching is deployment-safe: tenant responses bypass Vercel and
  upstream CDN storage, mutable pages and images are network-first, only
  content-hashed Next.js assets are cache-first, and a versioned service worker
  activates automatically. An emulator test proves that published Firestore
  changes reach an already-open storefront without a hard refresh.
- The UI preservation check still passes exactly: 2,491 selectors match and no
  captured asset has changed.

## Migration sequence

1. Keep the imported UI and route contract stable while replacing Clerk with
   Firebase Auth.
2. Replace the 114 Convex frontend calls with Firestore repositories and
   server-side operations, preserving authorization and loading behavior.
3. Export and import production data and Storage objects with count,
   relationship, and checksum validation.
4. Connect the Vercel project and Firebase production project, then validate
   preview domains, wildcard tenant routing, SEO output, Cloudflare proxying,
   and the response-cache contract.
5. Reconcile the Bubblewrap/TWA package and asset-link identities, run browser
   visual comparisons and the complete test suite, and only then cut DNS over.

Clerk and Convex remain a temporary transition bridge; they are not part of the
final architecture. Type checking is also temporarily excluded from
`next build` while the generated Convex types are replaced. No preview or
production deployment has been made from this workspace yet.

## Vercel workflow

```bash
npm run vercel:pull
npm run vercel:dev
npm run vercel:preview
npm run vercel:production
```

The deploy scripts pin Vercel CLI `59.1.3`. Preview and production deployment
must wait until the Firebase migration and fidelity gates pass.

## Refresh the source contract

```bash
node scripts/capture-source-contract.mjs ../whatsCartNew contracts/source-contract.json
```

Once the target UI exists, verify exact selector and asset preservation with:

```bash
npm run contract:verify-ui
```

See [`docs/migration-audit.md`](docs/migration-audit.md) for the architecture,
known baseline debt, and migration gates.

For the exact stopping point and ordered continuation plan, begin with
[`docs/RESUME-HERE.md`](docs/RESUME-HERE.md). It records completed work,
verification evidence, known risks, remaining transition imports, and the
production cutover sequence.
