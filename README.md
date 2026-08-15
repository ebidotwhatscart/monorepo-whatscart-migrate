# WhatsCart migration

This workspace is the Next.js/Vercel + Firebase target for WhatsCart. The old
production application remains in the sibling `../whatsCartNew` repository and
is treated as read-only migration input.

The migration has a zero-visual-drift requirement. The source contract in
[`contracts/source-contract.json`](contracts/source-contract.json) captures the
existing selector strings and asset hashes; the target currently matches all
2,491 selectors with no captured asset changes.

## Current state

- Next.js 16 production build and strict TypeScript pass normally.
- Firebase Auth, Firestore, Storage, public commerce, private dashboard,
  analytics, reviews, and super-admin repositories are implemented.
- Clerk and Convex are removed from the final runtime, dependencies, providers,
  generated types, and environment configuration.
- Existing owners can claim their migrated business automatically on first
  same-email verified Firebase sign-in.
- Wildcard storefronts are request-rendered with canonical metadata, JSON-LD,
  robots, product/catalog sitemaps, and live Firestore subscriptions.
- Deployment caching is freshness-safe: mutable HTML/RSC/APIs/assets bypass
  browser, Vercel, and Cloudflare storage; only hashed Next chunks are
  immutable. The versioned service worker activates automatically, checks for
  updates, and reloads under the new controller without requiring a user hard
  refresh.
- The production Convex export → Firebase importer validates relationships and
  Storage files, preserves IDs/relationships, performs idempotent checksum
  writes, and verifies every target after apply.
- The Cloudflare Vercel gateway passes unit tests and Wrangler dry-run.
- Bubblewrap/manual Android Java source is preserved and retargeted to
  `app.whatscart.in`; the inherited Play application-ID/signing fingerprint
  conflict still requires owner confirmation.
- No Vercel or Firebase project has yet been created in the currently logged-in
  accounts, and no target deployment or production data import has run.

Overall production readiness is currently estimated at **80%**. See
[`docs/RESUME-HERE.md`](docs/RESUME-HERE.md) for the exact evidence, remaining
work, and continuation order.

The latest local status check is green. The authenticated Vercel scope and
Firebase account currently contain no projects, so no external deployment or
production data write has been made.

## Local verification

```bash
npm run typecheck
npm run build
npm run contract:verify-ui
npm run cloudflare:check
```

Firebase emulator suites should be run serially; parallel emulator files can
trigger a known Firestore emulator framing fault.

## Deployment commands

```bash
npm run vercel:pull
npm run vercel:dev
npm run vercel:preview
npm run vercel:production
npm run cloudflare:check
npm run cloudflare:deploy
```

Preview Firebase/Vercel must pass before production domains or the Cloudflare
Worker are changed.

## Production data migration

Start with
[`docs/production-migration-runbook.md`](docs/production-migration-runbook.md).
The default importer invocation is a read-only dry run:

```bash
npm run migration:convex -- --source /secure/private/whatscart-convex-export --bucket YOUR_PREVIEW_BUCKET
```

## Important documents

- [`docs/RESUME-HERE.md`](docs/RESUME-HERE.md): completion percentage, verified
  state, blockers, and exact next steps.
- [`docs/migration-audit.md`](docs/migration-audit.md): original architecture
  and migration gates.
- [`docs/production-migration-runbook.md`](docs/production-migration-runbook.md):
  export, dry run, apply, validation, freeze, and rollback.
- [`docs/android-twa-audit.md`](docs/android-twa-audit.md): Android/TWA identity
  conflict and safe handoff.
