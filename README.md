# Terrazza — Restaurant Reservation Demo

A polished, mobile-first demo of a restaurant table-reservation product for **Terrazza**, Tirana. Guests reserve a table by **picking their spot on an interactive floor plan**; staff manage the whole service from a live admin dashboard.

> Sales/prototype demo. No real payments, WhatsApp API, or authentication. Built to be migratable to PostgreSQL + a production backend (same clean architecture as the Barber House demo).

## Highlights

- **Interactive floor map** — guests see the real dining room and tap an available table (green), booked tables shown in red, tables too small for the party greyed out. Fully responsive.
- **Capacity-aware availability engine** — a time is offered only when a table with enough seats is free for the whole seating, respecting opening shifts, buffers, closures and existing bookings. Double-booking is prevented server-side inside a transaction.
- **Live admin floor view** — see the room at any time of day; tap a seated table to manage its reservation.

## Tech stack

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui** (Radix)
- **Prisma** ORM + **SQLite** (demo; Postgres-ready)
- **React Hook Form** + **Zod**, **Recharts**, Server Actions

## Features

**Public**
- Premium homepage (hero, menu, story, gallery)
- 3-step reservation: **Date & time → Table (floor map) → Details**, "any table" option, simulated WhatsApp confirmation

**Admin** (`/dashboard`)
- KPIs + charts (revenue, reservations, covers by section, party-size mix)
- **Floor plan** — live table status by time; tap to manage
- **Reservations** — filter/search, seat / complete / no-show / cancel / **reschedule**
- **New reservation** (walk-in / phone) using the same availability engine
- **Customers** CRM (visits, covers, est. spend, favourite section, history, notes)
- **Tables** — manage seats, section, shape and floor position
- **Settings** — details, booking rules, opening shifts, closures (all persisted)

## Getting started

```bash
npm install
npx prisma migrate deploy   # or: npx prisma migrate dev
npm run db:seed             # 11 tables, 24 guests, ~120 reservations
npm run dev                 # http://localhost:3000
```

- Public site: **/**
- Reservation: **/reserve**
- Admin: **/dashboard**

Refresh demo data anytime with `npm run db:seed` (re-anchors "today").

## Going to production (Vercel + Postgres)

1. Set `provider = "postgresql"` in `prisma/schema.prisma` and regenerate the migration.
2. Create a Postgres database (Neon / Vercel Postgres) and set `DATABASE_URL` in the Vercel project.
3. Set the build command to `prisma generate && prisma migrate deploy && next build`.

## Project structure

```
prisma/schema.prisma   Models: RestaurantTable, Reservation, Customer,
                       OpeningHour, Closure, Notification, RestaurantSetting
src/lib/availability.ts  Capacity-aware availability engine
src/components/floor/    The reusable floor-map component
src/app/reserve/         Public reservation flow
src/app/dashboard/       Admin (floor, reservations, tables, customers, settings)
src/server/              Read queries + Server Actions
```
