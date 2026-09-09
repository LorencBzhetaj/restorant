# Incident report — accidental deletion of Neon reservation/notification rows

**Date:** 2026-09-09
**Severity:** High (production data deleted), **Confirmed live-guest impact:** none found (see §5)
**Status:** Contained. Production writes halted pending this review.

---

## 1. Summary

While implementing Phase 1 (combined tables), a test suite was launched with a
bare `npx vitest run` instead of the `npm test` wrapper. The test process did not
have the local test database configured, and Prisma's engine fell back to the
`.env` connection string (Neon production). The test's `beforeAll` teardown ran
`deleteMany()` on `Notification` and `Reservation` **against Neon** before it hit
a missing-table error (the `combined_tables` migration is not applied to Neon)
and aborted.

Result: all `Reservation` and `Notification` rows on Neon were deleted. No schema
change occurred. All configuration (tables, areas, settings, slot limits) is
intact.

## 2. Timeline (UTC)

| Time (approx, UTC) | Event |
|---|---|
| 2026-09-09 ~13:51 | `npx vitest run tests/combined-tables.test.ts` executed; `beforeAll` deleted Notification then Reservation on Neon, then aborted on the missing `TableCombinationMember` table |
| 2026-09-09 ~13:52 | Read-only count confirmed reservations = 0, notifications = 0 |
| 2026-09-09 ~14:00 | Hard test guard added; recurrence prevented |
| 2026-09-09 (this review) | Read-only verification + safeguards + this report |

**Estimated deletion window: 2026-09-09 13:50–13:52 UTC** (15:50–15:52 Europe/Tirane, CEDT = UTC+2). Any point-in-time target **before 13:50 UTC** predates the deletion.

## 3. Read-only verification of Neon (no writes performed)

| Item | Value |
|---|---|
| Database host | `ep-billowing-pine-a5z732za.us-east-2.aws.neon.tech` |
| Database name | `neondb` |
| Reservation count | **0** |
| Notification count | **0** |
| Customer count | **0** |
| RestaurantTable count | **11** |
| Area count | **2** |
| SlotLimit count | **1** |
| AreaClosure count | **0** |
| Latest recorded migration | `20260908235009_area_closures` (finished 2026-09-08 23:50 UTC) |

Note: the `combined_tables` migration is **not** applied to Neon (test DB only).
Customer count was already 0 before the incident (the teardown deleted
Notification and Reservation, then aborted before reaching `customer.deleteMany`).

## 4. Root cause

- Prisma Client loads `.env` on its own when `DATABASE_URL` is not already in
  `process.env`. A bare `vitest run` set neither the test DB nor `DATABASE_URL`,
  so Prisma used the `.env` (Neon) URL.
- The test teardown used unconditional `deleteMany()` and assumed a disposable
  target.
- The prior guard checked `process.env.DATABASE_URL`, which was empty in that
  run, so it did not catch a Prisma-internal `.env` fallback.

## 5. Was there real guest data? Evidence and determination

**Determination: no evidence of real, live guest reservations.** Basis:

- There is **no production public booking URL** in service. `NEXT_PUBLIC_APP_URL`
  was never set to a live booking domain, and the WordPress/Divi embed has not
  been deployed. The app exists on Vercel only for pre-launch testing.
- Earlier project work had already removed demo data and only created
  **development/test** bookings (e.g. concurrency tests run directly against
  Neon, manual verification bookings).
- Counts are consistent with test-only data.

**Per policy, deleted rows are documented as non-live test/demo data. No fake
production reservations were recreated. All remaining configuration is
preserved.**

### Independent checks the user can run to confirm (recommended)

1. **Gmail "Sent" folder** of the SMTP sender account — confirmation emails
   ("Your table at … is confirmed") and owner emails ("New reservation — …") are
   the strongest evidence of whether any *real* booking was ever completed. If
   none exist for real guests, that corroborates test-only data.
2. **Vercel → Deployments → Logs / Observability** — look for `POST
   /api/reservations` (or booking server-action) requests from real user agents
   within the retention window. (Retention is limited on lower tiers; may already
   be expired.)
3. **Neon → branch-from-timestamp** (see §6) — inspect the data as it existed
   just before 13:50 UTC, non-destructively.

### Log-based row identification

- **Application logs:** the `Notification` table was the app's record of sent
  messages; it was itself deleted, so no in-DB audit remains. No separate audit
  log exists.
- **Neon:** does not expose row-level deletion audit on standard tiers; recovery
  is via history/PITR, not a deletion log.
- **Vercel / SMTP:** see checks 1–2 above.

## 6. Neon recovery options (reported; **no restore performed**)

To be verified in the Neon Console (requires the account owner):

- **Point-in-time restore / history:** Neon retains history for the project's
  retention window (commonly 7 days on paid, shorter on free). If the window
  still covers 2026-09-09 13:50 UTC, the data is recoverable.
- **Branch from timestamp (recommended first step):** create a **new branch**
  from a timestamp just before 13:50 UTC and inspect it — this is
  **non-destructive** and does not touch `main`. Compare its Reservation rows
  against expectations.
- **Existing branches / backups:** check whether any branch or restore point
  predates the deletion.

**Do not restore `main` yet.** First branch-from-timestamp to confirm what
existed; only then decide whether a restore is warranted. Given §5, a restore is
likely unnecessary — but the branch inspection is the definitive check.

## 7. If a real reservation is found (contingency)

If check 1, 2, or the Neon branch reveals a **real** guest reservation:

1. Stop — make no further production changes.
2. Affected range: **all reservations existing at/before 2026-09-09 13:50 UTC**.
3. Recovery: create a Neon branch from < 13:50 UTC, extract the affected
   `Reservation`/`Notification` rows, and re-insert them into `main` (additive,
   no destructive reset). Re-notify affected guests only if appropriate.

## 8. Corrective actions (committed separately)

- Tests are driven by `TEST_DATABASE_URL`, never `DATABASE_URL`; the runner sets
  `NODE_ENV=test` + `TEST_DATABASE_URL` only.
- `tests/setup/assert-test-db.ts` — connection-free validation: requires
  `NODE_ENV=test`, non-empty `TEST_DATABASE_URL`, host `localhost`/`127.0.0.1`,
  db name exactly `resto_test`; blocks Neon/Vercel/all remote hosts.
- `tests/setup/guard-db.ts` — runs before any Prisma import, validates, then maps
  the validated URL onto `DATABASE_URL`/`DIRECT_URL`. Both `npm test` and a bare
  `npx vitest run` are now safe.
- `tests/setup/assert-test-db.test.ts` — proves remote/empty/wrong-db URLs are
  rejected before Prisma connects.
- `prisma/guard-production.ts` + `clean.ts` — destructive scripts refuse to run
  against a non-local database without `--confirm`.

## 9. Follow-ups

- Before any Phase 7 production migration: take a Neon backup/branch first (now a
  hard prerequisite in the deployment plan).
- Consider a dedicated Neon *staging* branch for pre-production verification so
  no test/verification ever targets `main`.
