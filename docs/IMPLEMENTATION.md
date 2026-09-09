# Implementation notes — Villa Gjeçaj phase

What was built in the safe code phases, and the database migrations involved.
The public site design and existing reservation/area/closure/capacity/
concurrency behavior were preserved throughout.

## Phases delivered (each its own commit, all tests green)

1. **Combined tables** — predefined multi-table combinations. New models
   `TableCombination`, `TableCombinationMember`, `ReservationTable`; the engine
   assigns one table or, when no single table fits, the smallest available
   configured combination; per-table advisory locks (sorted) make concurrent
   bookings safe; dashboard "Table Combinations" UI; all assigned tables shown in
   lists, floor, detail and emails.
2. **Real-table tooling** — idempotent importer (`npm run import:tables`) + blank
   template `config/villa-gjecaj-tables.template.json` (no invented data).
3. **Drag-and-drop floor editor** — `/dashboard/floor/edit`; pointer drag
   (mouse+touch), grid snap, size/shape/rotation, overlap warnings, save/reset;
   layout changes never affect availability.
4. **Automatic reminders** — 24h + optional 2h, idempotent, via a protected
   Vercel Cron (`/api/cron/reminders`, `CRON_SECRET`); settings toggles + custom
   text; DST-independent selection.
5. **Branding via settings** — `logoUrl`/`websiteUrl`/`brandColor`; dashboard
   logo with initial fallback; logo in all transactional emails (https only, alt
   text, no base64). No fake logo hardcoded.
6. **Quality/security** — `isAdmin` on every admin-only server action; test-DB
   isolation hardening; security review; deployment + rollback + WordPress docs.

## Database migrations (all additive)

| Migration | Change | Data |
|---|---|---|
| `…_area_closures` | `AreaClosure` table + indexes | — |
| `…_combined_tables` | `TableCombination`, `TableCombinationMember`, `ReservationTable` (+ FKs/indexes) | Backfills one `ReservationTable` per existing reservation from `Reservation.tableId` (idempotent `ON CONFLICT DO NOTHING`) |
| `…_table_rotation` | `RestaurantTable.rotation` column (default 0) | — |
| `…_reminders` | Settings `reminder24hEnabled`/`reminder2hEnabled`/`reminderText`; **partial unique index** on `Notification(reservationId, type)` for reminder types | — |
| `…_branding` | Settings `logoUrl`/`websiteUrl`/`brandColor` | — |

Notes:
- `Reservation.tableId` is retained as the primary table for backward-compatible
  reads; `ReservationTable` is the authoritative multi-table record. Removing
  `tableId` is a future, separate step once every read path uses the join.
- The reminder partial unique index is raw SQL in the migration (Prisma cannot
  express partial unique indexes); it is the hard idempotency guarantee.
- Apply with `prisma migrate deploy` against the Neon **direct** endpoint. See
  `docs/DEPLOYMENT.md`.

## Testing

All tests run only against the guarded local Docker `resto_test` database
(`npm test`; a bare `vitest run` is blocked). Suites: area-closures,
combined-tables, reminders, table-import, floor-editor, branding, auth-guard,
villa-gjecaj-bootstrap, and the test-DB safety guard.

## Not done (blocked — see handoff)

Live Vercel + WordPress acceptance, real table configuration, the official logo,
and production deployment — all require owner-supplied information/authorization.
The project is **not** production-complete until those pass live.
