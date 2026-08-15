# Production Convex → Firebase migration runbook

This runbook is intentionally split into read-only export/dry-run steps and an
explicit `--apply` step. Never point the apply command at production until the
Vercel preview, Firebase rules, account claim flow, and sampled data have been
validated.

## What the migration preserves

- Convex document IDs become Firestore document IDs.
- `_creationTime`, business slugs, catalog IDs, customer order IDs, timestamps,
  product relationships, analytics events, review aggregates, and ownership
  references are retained.
- Convex Storage objects move to deterministic Firebase Storage paths. Product
  and public review assets use `businesses/<businessId>/public/migrated/...`;
  FSSAI documents remain private.
- Firebase download capabilities are generated from
  `MIGRATION_STORAGE_TOKEN_SECRET`, which must remain secret and stable across
  initial and delta imports.
- Each Firestore document receives an `_migration` source ID and checksum.
  Repeating the same import is a no-op. Changed or unrelated target documents
  stop the run unless `--overwrite-existing` is explicitly supplied.

## Existing-user ownership claim

Migrated user records are stored under the old Convex user ID with
`migrationPendingLink: true`. On the first Firebase sign-in using the same
verified email, `/api/auth/bootstrap` atomically:

1. copies the legacy profile and role to the Firebase UID;
2. changes the business `ownerId` to that Firebase UID;
3. removes the temporary legacy user record;
4. refreshes the super-admin custom claim if applicable.

The current UI signs in with Google, so the email is verified by Firebase.
Any production Clerk account that cannot use Google with the same email needs
a manual identity mapping/support process before DNS cutover.

## 1. Create the source snapshot (read-only)

Run from the untouched source repository and choose a private location outside
Git. Convex documents the export directory as
`<table>/documents.jsonl`, with Storage metadata and objects under `_storage/`.

```bash
rtk proxy npx convex export --prod --include-file-storage --path /secure/private/whatscart-convex-export
```

Do not edit the snapshot. Retain a second immutable copy for rollback/audit.

## 2. Validate and transform without writing Firebase

```bash
rtk npm run migration:convex -- --source /secure/private/whatscart-convex-export --bucket YOUR_PROJECT.appspot.com
```

The command verifies all cross-table and Storage references, unique business
slugs, exported object presence, target counts, and deterministic checksums. It
prints `Dry run complete. No Firebase data was changed.` when successful.

## 3. Seed a non-production Firebase project

Configure Application Default Credentials or the existing Admin environment
variables without printing secrets. Supply a unique 32+ character migration
token secret through the environment, not a CLI argument.

```bash
rtk npm run migration:convex -- --source /secure/private/whatscart-convex-export --project YOUR_PREVIEW_PROJECT --bucket YOUR_PREVIEW_BUCKET --apply
```

The importer uploads Storage first, then Firestore, and finally re-reads every
migrated document/object to verify its source checksum. Existing different
data is rejected by default.

## 4. Preview validation gate

- Compare every table/object count with the printed manifest.
- Sample at least one store of every business type.
- Verify products, variants, catalogs, featured items, order totals, order
  history capability URLs, customer uploads, review aggregates, analytics,
  and super-admin counts.
- Sign in as migrated owners and confirm the ownership claim happens once.
- Verify another account cannot claim the store.
- Compare a sample of source and destination object SHA-256 checksums.
- Keep a storefront and dashboard open while changing Firestore; both must
  update without a manual refresh.

## 5. Production freeze and delta import

1. Announce a short write freeze on the Convex application.
2. Capture a final Convex export including Storage.
3. Run the dry-run and compare counts against the earlier rehearsal.
4. Apply to an empty production Firebase project. If this is a changed snapshot
   over a rehearsal seed, inspect every checksum difference before using
   `--overwrite-existing`.
5. Run the preview validation gate again against production Firebase while DNS
   still points to the old application.
6. Deploy Vercel, attach domains, then switch DNS/Worker routing.

## 6. Rollback

- Keep the Convex deployment, Clerk configuration, Netlify deployment, Worker
  version, DNS records, and final immutable snapshot intact through the
  rollback window.
- A rollback changes Cloudflare/DNS back to the old origin; it does not delete
  Firebase data.
- If any writes were accepted after cutover, export them before rollback and
  reconcile them before a second cutover.
- Never use a destructive Firestore or Storage delete as part of first-response
  rollback.

Official references:

- [Convex CLI export](https://docs.convex.dev/cli/reference/export)
- [Convex backup export layout](https://docs.convex.dev/database/backup-restore)
- [Firebase bulk loading guidance](https://firebase.google.com/docs/firestore/enterprise/bulk-data-loading)
