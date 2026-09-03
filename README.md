# Terrazza — Restaurant Reservation

A polished, mobile-first **table-reservation widget + admin dashboard** for a restaurant (demo brand: **Terrazza**, Tirana). Guests pick a date, party size and time; a table is assigned automatically; the guest and the owner both get an **email confirmation**, and the guest can **cancel with one click** from that email.

Designed to be dropped into an existing site — embedded as an iframe/widget or driven through its API — so the marketing website is intentionally **not** part of this project. Only the booking flow and the dashboard are.

## What's included

- **Guest booking flow** (`/reserve`) — mobile-first, two steps: date + party + time → your details. A suitable free table is assigned automatically.
- **Email confirmations** — sent to the **guest** and the **restaurant owner** on every booking (and on cancellation / reschedule). Real SMTP when configured, demo mode otherwise.
- **Self-service cancel link** — every guest confirmation email contains a one-click "Cancel my reservation" button that opens a secure page (`/r/<token>`) and cancels the booking.
- **Admin dashboard** (`/dashboard`) — analytics, a live floor plan, reservations, tables, guests (CRM) and settings.
- **Capacity-aware availability engine** — never double-books; a time is only offered when a table with enough seats is free for the whole seating (see below).

## Tech stack

Next.js 16 · TypeScript · Tailwind v4 · shadcn/ui · Prisma + SQLite (Postgres-ready) · React Hook Form + Zod · Recharts · Nodemailer · Server Actions.

## Getting started

```bash
npm install
npx prisma migrate deploy   # or: npx prisma migrate dev
npm run db:seed             # 11 tables, 24 guests, ~120 reservations
npm run dev                 # http://localhost:3000  → redirects to /reserve
```

- Booking widget: **/reserve**
- Admin: **/dashboard**
- Manage/cancel a booking: **/r/&lt;token&gt;** (link is emailed to the guest)

Copy `.env.example` to `.env` and fill in SMTP to send real emails; without it the app runs in demo mode (notifications are recorded but not delivered).

## How capacity works (how many reservations per hour)

There is **no single "max per hour" number** — capacity is driven by your **tables**, which is more accurate (a 2-top and an 8-top are different capacity). At any given time, the number of reservations you can hold =

> **the number of active tables that are free at that time and big enough for the party.**

A booking holds its table for the **seating duration** plus a **buffer** before the next booking. So each physical table can host several sittings per shift.

You set the numbers in two places, all editable in the admin **Settings** and **Tables** pages:

| Value | Where | Effect |
|---|---|---|
| Number of tables & their seats | Tables page | The core cap — 11 tables = up to 11 concurrent reservations |
| Seating duration (e.g. 120 min) | Settings | How long each booking holds a table |
| Buffer between bookings (e.g. 15 min) | Settings | Gap for turning the table |
| Booking interval (e.g. 30 min) | Settings | Granularity of the offered time slots |
| Opening shifts (lunch/dinner) | Settings | Which times are bookable at all |

**Example (the seed data):** 11 tables, 120-min seating, 15-min buffer, dinner 18:00–23:00.
At 20:00, if 6 tables are already occupied by bookings overlapping 20:00, the engine offers **5** remaining tables (matched to party size). A table booked at 18:00 frees up around 20:15, so it can take a second sitting at 20:30 — that's how one table yields multiple reservations across the evening.

To simply "hold more reservations at 8pm", add more tables (or a section) on the Tables page; to change how quickly tables turn, adjust the seating duration / buffer in Settings.

## Deploying (Vercel + Postgres)

1. Set `provider = "postgresql"` in `prisma/schema.prisma` and regenerate the migration.
2. Create a Postgres database (Neon / Vercel Postgres); set `DATABASE_URL`, `NEXT_PUBLIC_APP_URL` and the SMTP vars in the Vercel project.
3. Build command: `prisma generate && prisma migrate deploy && next build`.

## Using it on a WordPress site

### Option A — drop-in embed (easiest)
Paste this where the widget should appear (Custom HTML block / theme):

```html
<script src="https://YOUR-DOMAIN/embed.js" data-origin="https://YOUR-DOMAIN"></script>
```

`embed.js` inserts a responsive iframe of `/reserve` and auto-resizes it to fit (no scrollbars) via `postMessage`.

### Option B — REST API (custom front end)
All endpoints send CORS headers (configure allowed sites with `ALLOWED_ORIGINS`).

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/availability?date=YYYY-MM-DD&party=N` | Available times for a date + party size |
| `POST` | `/api/reservations` | Create a reservation (JSON body below) |
| `GET` | `/api/reservations/{token}` | Read a reservation by its token |
| `POST` | `/api/reservations/{token}/cancel` | Cancel a reservation |

Create body:
```json
{ "start": "2026-09-05T18:00:00.000Z", "partySize": 2,
  "firstName": "Andi", "lastName": "Hysa",
  "phone": "+355 69 123 4567", "email": "andi@example.com",
  "notes": "" }
```
Response: `{ "ok": true, "reservationId": "...", "cancelToken": "...", "manageUrl": "https://YOUR-DOMAIN/r/..." }`.
Price/availability are always validated server-side; a suitable free table is assigned automatically.

## Project structure

```
prisma/schema.prisma     Models: RestaurantTable, Reservation, Customer,
                         OpeningHour, Closure, Notification, RestaurantSetting
src/lib/availability.ts  Capacity-aware availability engine
src/lib/email.ts         SMTP/demo email provider
src/lib/notifications.ts Guest + owner emails (confirm / cancel / reschedule)
src/app/reserve/         Guest booking flow
src/app/r/[token]/       Self-service manage / cancel page
src/app/dashboard/       Admin (floor, reservations, tables, guests, settings)
src/server/              Read queries + Server Actions
```
