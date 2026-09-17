# Order Notifications — Remaining Work (follow-up prompt)

Branch: `feature/notification` (worktree: `~/.worktree`, project `migration-whatscart`)

All 6 feature commits are in (`ee39659`..`578355c`), tree is clean. Everything below is **already verified complete** — do NOT re-litigate or re-do it: typecheck passes; notifications unit tests 5/5; notifications integration tests 3/3 against the running emulators (firestore `127.0.0.1:8081`, auth `127.0.0.1:9099`, config `firebase.emulator.local.json`); `useOptionalFirebaseAuth` was intentionally added because BusinessLayout renders bell/hook without a provider in some tests.

Your job: check, verify, and fix the remaining loose ends.

## 1. Fix the 18 pre-existing test failures (highest priority)

Classified as pre-existing by full-tree reset to `578355c` (memory `order-notifications`), but they still fail on this branch and should be fixed. Do NOT attribute them to the notifications feature; investigate root cause per file:

- `store-settings-brand-palette.test.tsx` (4)
- `catalog-editor.test.tsx` (2)
- `business-setup-brand-palette.test.tsx` (1)
- `storefront-redesign.test.tsx` (3)
- `product-form-business-types.test.tsx` (2)
- `dashboard-product-routes.test.tsx` (6 — all `renderProducts`-based; the 2 BusinessLayout provider tests already pass)

Run each in isolation under `npm test`, capture the actual assertion errors, find whether they are stale fixtures, mock drift, emulator-state flakes, or genuine regressions, and fix code (not by deleting/weakening assertions). After fixing: `npm test` must show **only** the notifications integration test as skipped (it needs emulator env) OR green — and you must show a diff of failures-before (18) vs after (0) with per-file names. If any turn out to be unfixable flake, keep them `describe.skip` with a comment and document why.

## 2. Resolve emulator port drift

- `firebase.json`: firestore `8080`; `firebase.emulator.local.json` (the committed one, used for tests): firestore `8081`.
- `src/lib/firebase/client.ts:43` hardcodes `connectFirestoreEmulator(client.firestore, host, 8080)`; auth uses 9099 in both.
- Pick ONE canonical config pair and make it consistent: either update `client.ts` to read the port from env/config, or align the two JSON files, or switch the integration-test host to `8080` and drop one config. State the choice clearly, update rules/UI-port accordingly, and prove `npm test` integration tests still pass (start emulators yourself if needed via `npm run firebase:emulators` or the local config; they may already be running on 8081/9099).

## 3. Update the plan doc state

`docs/superpowers/plans/2026-09-16-order-notifications.md` — 36 unchecked `[ ]` boxes remain. Tick every box for steps that are complete, document the two known deviations (single-SW FCM merge instead of separate `firebase-messaging-sw.js`; `useOptionalFirebaseAuth`), and mark the known env dependency note as acknowledged. Do not rewrite task content.

## 4. Env + real-Firebase verification (manual, document only)

`NEXT_PUBLIC_FIREBASE_VAPID_KEY` exists in `.env.example` but not `.env.local`, and there is no real project config. Do NOT invent credentials. Instead: read `.env.local` and `src/lib/firebase/client.ts`; write up exactly which env vars a developer must fill, and whether the client gracefully no-ops when they are absent (it should). If it does not no-op (e.g. crashes loading `firebase/messaging`), fix with a guard.

## 5. Finish the branch

After 1–4 pass, use the `finishing-a-development-branch` workflow to decide: merge into the main branch, open a PR, or clean up. Only take destructive/merge steps if the current branch state supports it — check `git log main..feature/notification` first and confirm no other work depends on it.

## Exit criteria (prove all)

1. `npm run typecheck` — clean.
2. `npm test` — 18 pre-existing failures reduced to 0 (with before/after list), notifications tests green or explicitly env-skipped.
3. Emulator port drift resolved with one canonical config; integration tests rerun green.
4. Plan doc checkboxes ticked, deviations noted.
5. Branch merged/PR'd/cleanup done with verified commands, or a clear reason NOT to.

Report the final commit SHAs for each change. Stop and ask if any step contradicts reality (e.g. a "pre-existing" failure turns out to be caused by the notifications code — investigate before claiming).

## Completion record

- Pre-existing failures: 18 → 0. Full suite: 133 passed; 32 env-gated integration tests skipped without emulator variables.
- Emulator canonical config: Firestore `8081`, Auth `9099`, Storage `9199`; `firebase.json`, `firebase.emulator.local.json`, and client connection agree.
- Notification integration: 3 passed with `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099` and `FIRESTORE_EMULATOR_HOST=127.0.0.1:8081`.
- `.env.local` is absent. Developer must provide the client Firebase variables and Admin variables listed in `.env.example`; client returns `null` when API key or project ID is absent.
- Plan checkboxes and known deviations are recorded in `docs/superpowers/plans/2026-09-16-order-notifications.md`.
- Branch finish decision: keep `feature/notification` unmerged and unpushed; `git log main..feature/notification` shows only this feature plus cleanup, and no merge/PR authority was provided.
