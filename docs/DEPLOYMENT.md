# Production release checklist & rollback plan — Villa Gjeçaj

This is the runbook for deploying the booking app to Neon + Vercel and embedding
it in WordPress. **Do not perform any production mutation without explicit
authorization.** Every DB migration is additive; rollback is by application
version, never by dropping production tables.

---

## A. Preconditions (before touching production)

- [ ] All commits pushed to `main` and CI-green locally: `npm test`, `npm run lint`,
      `npx tsc --noEmit`, `npm run build`, `git diff --check`.
- [ ] Real table data filled into a copy of
      `config/villa-gjecaj-tables.template.json` (9 Indoor + confirmed Outdoor),
      and valid combinations defined. Verified with `--dry-run` locally.
- [ ] Official logo hosted at a public **https** URL.
- [ ] **Neon backup/branch created** from current `main` (see §B) — mandatory.
- [ ] Production environment variables ready (see §D).

## B. Neon backup/branch (mandatory, first)

In the Neon console: create a **branch** of the production database (or confirm
point-in-time history covers the deployment window). This is the restore point.
Record the branch name/timestamp. Do not proceed without it.

## C. Deployment order

1. **Backup/branch Neon** (§B) — done first.
2. **Apply migrations** against the Neon **direct** (non-pooled) endpoint:
   ```bash
   DATABASE_URL="<neon-direct>" DIRECT_URL="<neon-direct>" npx prisma migrate deploy
   ```
   Applies (all additive): area_closures → combined_tables (backfills
   ReservationTable from existing tableId) → table_rotation → reminders (adds the
   partial unique index) → branding.
3. **Bootstrap once** (idempotent, ensures Indoor/Outdoor areas + the 18:00 cap):
   ```bash
   npm run bootstrap:villa-gjecaj -- --confirm
   ```
4. **Import the real tables** (idempotent; dry-run first):
   ```bash
   npm run import:tables -- <your-config.json> --dry-run
   npm run import:tables -- <your-config.json> --confirm
   ```
   Confirm the printed verification: Indoor = 9, Outdoor = confirmed count, no
   duplicate names, combinations created.
5. **Deploy/redeploy Vercel** (push to `main` or redeploy without build cache so
   `prisma generate` reruns). **Do not delete the previous working deployment** —
   it is the rollback target.
6. **Production smoke tests** (§E).

## D. Vercel environment variables

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Neon **direct** (non-pooler) endpoint, `sslmode=require`. Required for `pg_advisory_xact_lock`. |
| `DIRECT_URL` | Same direct endpoint (migrations). |
| `AUTH_SECRET` | Long random string — signs the `gj_session` admin JWT. |
| `ADMIN_PASSWORD` | Dashboard login password. |
| `TZ` | `Europe/Tirane`. |
| `NEXT_PUBLIC_APP_URL` | The real booking origin, e.g. `https://booking.gjecaj.al`. **Not** the WordPress domain unless the app is actually served there. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Real SMTP; without these, email runs in demo mode. |
| `CRON_SECRET` | Strong secret; Vercel Cron sends it as `Authorization: Bearer`. Endpoint fails closed if unset. |
| `ALLOWED_ORIGINS` | Comma-separated real WordPress origin(s). Overrides the `*` demo default. |

Cron is scheduled in `vercel.json` (`/api/cron/reminders`, every 15 min).

## E. Production smoke tests (after deploy)

- [ ] `/dashboard` requires login; wrong password rejected.
- [ ] Tables page shows 9 Indoor + confirmed Outdoor; combinations listed.
- [ ] Public `/reserve` on desktop and mobile: Indoor shows only Indoor tables,
      Outdoor only Outdoor, No-preference follows area priority.
- [ ] Make a test booking → guest **and** owner emails arrive with the logo,
      assigned table(s) and special requests; cancel link works and frees the
      table(s).
- [ ] Create a today-only Outdoor closure → Outdoor unavailable today, available
      tomorrow, Indoor unaffected; remove it → availability returns.
- [ ] Combined-table booking works for a large party; two simultaneous requests
      cannot share a table.
- [ ] 18:00 cap = 4 enforced; changing it in the dashboard takes effect.
- [ ] Floor editor: drag/resize/rotate a table, Save, reload → persists; the
      operational floor plan is unchanged by shape overlaps.
- [ ] Reminder cron: `curl -H "Authorization: Bearer $CRON_SECRET"
      https://<app>/api/cron/reminders` returns counts; without the header → 401.
- [ ] Logs contain no secrets or guest PII.

## F. Rollback plan

**Preferred: application rollback (non-destructive).** All migrations are
additive, so an older app version runs against the newer schema.

1. In Vercel → Deployments, **Promote** the previous known-good deployment to
   Production. This is the primary rollback and needs no DB change.
2. If an environment variable caused the issue, correct it and redeploy.

**Do NOT drop production tables as a normal rollback.** The additive schema is
forward/backward compatible with the recent app versions.

**Data rollback (only if data was corrupted):** restore from the Neon
branch/point-in-time created in §B — branch from the pre-deploy timestamp,
verify, then repoint or copy rows. Never `migrate reset` or `DROP TABLE` on
production.

**If a migration fails mid-deploy:** migrations are additive and transactional
per file; re-run `prisma migrate deploy` after fixing connectivity. The
combined-tables backfill is idempotent (`ON CONFLICT DO NOTHING`).

## G. Not done here / requires the owner

See the consolidated "what I must supply" list in the handoff: official logo URL,
real table data, valid combinations, floor positions, booking domain, WordPress
access, Vercel env values, SMTP config, and explicit deploy authorization.
