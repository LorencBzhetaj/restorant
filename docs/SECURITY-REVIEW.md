# Security review — pre-production (Villa Gjeçaj)

Reviewed at commit `20104d1`. Scope: the areas listed in the Phase 6 quality gate.
Status legend: ✅ addressed · ⚠️ action required at deploy · ℹ️ note.

## 1. Authentication for every dashboard action ✅
Next.js server actions are their own POST endpoints, invokable independently of
the `proxy.ts` guard that protects `/dashboard` **pages**. Previously only the
combination, floor-layout and area-closure actions checked `isAdmin`.

Fixed: every admin-only action now begins with
`if (!(await isAdmin())) return { ok:false, error:"Unauthorized" }`
(createWalkIn, setReservationStatus, rescheduleReservation, upsertTable, addArea,
toggleAreaOpen, deleteArea, toggleTableActive, add/deleteOpeningHour,
add/deleteClosure, updateCustomerNotes, updateSettings, add/deleteSlotLimit, plus
the combination/floor/closure actions already guarded). `isAdmin` verifies the
signed `gj_session` JWT cookie. Public by design: `createReservation` (booking);
token-authed: `cancelReservationByToken`. Covered by `tests/auth-guard.test.ts`
(24 actions return Unauthorized and write nothing when unauthenticated).

## 2. Public API rate limiting ✅ / ℹ️
`POST /api/reservations` is rate-limited (`rateLimit(resv:<ip>, 8, 60_000)` — 8
per minute per IP) with `clientIp` from `x-forwarded-for`. ℹ️ The limiter is
in-memory (per serverless instance, best-effort). For strict global limits back
it with Redis/Upstash later — the interface is unchanged. Acceptable for launch
volume.

## 3. CORS allowlist ⚠️
`src/lib/cors.ts` reads `ALLOWED_ORIGINS` (comma-separated) and echoes an allowed
origin; it **defaults to `*`** for the demo. No cookies are used on the public
API, so `*` is not a credential leak, but **production must set
`ALLOWED_ORIGINS` to the real WordPress origin(s)** so only they can call the
API. Preflight (`OPTIONS`) is handled. `Vary: Origin` is set.

## 4. postMessage origin validation ✅
`public/embed.js` listens for `message` events and rejects any whose
`e.origin !== origin` (the configured booking-app origin from `data-origin`).
So the parent page only accepts height/resize messages from the exact iframe
origin. ⚠️ Ensure `data-origin` on the embed script is the real booking origin
(e.g. `https://booking.gjecaj.al`), and that the `/reserve` page posts to a
specific parent origin (not `*`) — see the WordPress integration doc.

## 5. Reservation concurrency ✅
Bookings run inside an interactive transaction holding a per-slot
`pg_advisory_xact_lock`; the authoritative table assignment happens INSIDE the
lock, and the per-slot cap is re-checked in-transaction. Requires the Neon
**direct** (non-pooled) endpoint for advisory locks. Covered by the 18:00
concurrency tests (exactly 4 of 6 succeed).

## 6. Table-combination concurrency ✅
`assignTablesTx` acquires a per-candidate-table advisory lock in ascending id
order (deterministic → deadlock-free) BEFORE reading occupancy, so two
concurrent bookings can never share a member table. Covered by
`tests/combined-tables.test.ts` (“simultaneous requests cannot share a member
table”).

## 7. Reminder idempotency ✅
A partial unique index on `Notification(reservationId, type)` for the reminder
types guarantees at most one reminder of each type per reservation. Each reminder
is claimed (insert-if-absent) before the email is sent, so overlapping cron runs
cannot double-send; Failed reminders are re-claimed and retried. Cron endpoint
requires `Authorization: Bearer <CRON_SECRET>` and fails closed if unset. Covered
by `tests/reminders.test.ts`.

## 8. Area closure behavior ✅
Temporary closures affect only their date/time window and never disable future
dates; permanent area status is independent. Applied consistently in
availability, assignment and combinations. Covered by
`tests/area-closures.test.ts` and a combined-tables closure test.

## 9. Guest privacy consent ✅ / ℹ️
The booking form requires an explicit consent checkbox (linked to `/privacy`)
before submit. ℹ️ Consent is enforced at the point of collection (frontend);
the server does not persist a consent flag. Storing proof-of-consent
(timestamp/version) is a possible future enhancement, not a launch blocker.

## 10. SMTP error handling ✅
`sendEmail` wraps the SMTP send in try/catch and returns
`{ delivered:false }` on failure — it never throws, so a mail outage cannot break
a booking. Unconfigured SMTP → demo mode (recorded, not sent). The reminder
pipeline records Failed and retries.

## Secrets ✅
No secrets are committed. `.env*` is gitignored; `CRON_SECRET`, `DATABASE_URL`,
SMTP creds etc. are read from `process.env` only. The cron endpoint accepts the
secret via header, never the URL. Logs print counts only, no guest PII.

## Summary of required deploy-time actions
- ⚠️ Set `ALLOWED_ORIGINS` to the real WordPress origin(s) (not `*`).
- ⚠️ Set `data-origin` on the embed to the real booking origin; `/reserve` posts
  to a specific parent origin.
- ⚠️ Use the Neon **direct** endpoint for `DATABASE_URL` (advisory locks).
- ⚠️ Set a strong `CRON_SECRET`.
