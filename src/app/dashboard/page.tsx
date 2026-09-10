export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  CalendarDays,
  Users,
  CalendarClock,
  TrendingUp,
  CheckCircle2,
  XCircle,
  UserX,
  ArrowRight,
} from "lucide-react";
import { getDashboardData, getAreasOverview, getClosuresOverview, getAreas } from "@/server/data";
import { formatTime, formatDate } from "@/lib/format";
import { StatCard } from "@/components/admin/stat-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { RevenueChart, AppointmentsChart, HorizontalCountChart } from "@/components/admin/charts";
import { AreaControls } from "@/components/admin/area-controls";
import { ClosuresManager } from "@/components/admin/closures-manager";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const [d, areasOverview, closures, areas] = await Promise.all([
    getDashboardData(),
    getAreasOverview(),
    getClosuresOverview(),
    getAreas(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand">Overview</p>
        <h1 className="font-heading text-2xl font-medium tracking-tight">Dashboard</h1>
      </div>
      <ClosuresManager
        areas={areas.map((a) => ({ id: a.id, name: a.name, kind: a.kind }))}
        closures={closures.map((c) => ({
          id: c.id,
          areaId: c.areaId,
          areaName: c.areaName,
          areaKind: c.areaKind,
          startDateTime: c.startDateTime.toISOString(),
          endDateTime: c.endDateTime.toISOString(),
          reason: c.reason,
          affected: c.affected.map((a) => ({
            id: a.id,
            start: a.start.toISOString(),
            partySize: a.partySize,
            customerName: a.customerName,
            tableName: a.tableName,
            requestedArea: a.requestedArea,
          })),
        }))}
      />
      <AreaControls
        areas={areasOverview.areas}
        affected={areasOverview.affected.map((a) => ({ ...a, start: a.start.toISOString() }))}
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Today's reservations" value={d.cards.todayCount} icon={CalendarDays} accent="brand" />
        <StatCard label="Covers today" value={d.cards.coversToday} icon={Users} accent="blue" hint="Guests booked" />
        <StatCard label="Upcoming" value={d.cards.upcoming} icon={CalendarClock} accent="blue" hint="Confirmed & future" />
        <StatCard label="Completed today" value={d.cards.completedToday} icon={CheckCircle2} accent="emerald" />
        <StatCard label="Cancelled today" value={d.cards.cancelledToday} icon={XCircle} accent="rose" />
        <StatCard label="No-shows today" value={d.cards.noShowToday} icon={UserX} accent="amber" />
        <StatCard label="Reservations (month)" value={d.cards.reservationsMonth} icon={CalendarDays} accent="brand" />
        <StatCard label="Covers (month)" value={d.cards.coversMonth} icon={TrendingUp} accent="blue" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Covers" subtitle="Last 14 days">
          <RevenueChart data={d.days.map((x) => ({ label: x.label, revenue: x.covers, appointments: x.appointments }))} currency="" />
        </ChartCard>
        <ChartCard title="Reservations" subtitle="Last 14 days">
          <AppointmentsChart data={d.days} />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Covers by section" subtitle="Completed guests">
          <HorizontalCountChart data={d.sectionCounts} colorVar="var(--chart-1)" />
        </ChartCard>
        <ChartCard title="Party size mix" subtitle="All reservations">
          <HorizontalCountChart data={d.partyCounts} colorVar="var(--chart-2)" />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border/70 bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
            <h2 className="font-heading text-base font-medium tracking-tight">Today&apos;s bookings</h2>
            <Link href="/dashboard/floor" className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
              Floor plan <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {d.todays.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted-foreground">No reservations today.</li>}
            {d.todays.slice(0, 6).map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-5 py-3">
                <span className="w-14 shrink-0 font-mono text-sm text-muted-foreground">{formatTime(r.startDateTime)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.customer.firstName} {r.customer.lastName}</p>
                  <p className="truncate text-xs text-muted-foreground">{r.partySize} guests · {r.table.name} · {r.table.section}</p>
                </div>
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
            <h2 className="font-heading text-base font-medium tracking-tight">Upcoming reservations</h2>
            <Link href="/dashboard/reservations" className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
              All <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {d.upcomingList.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted-foreground">Nothing upcoming.</li>}
            {d.upcomingList.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-20 shrink-0">
                  <p className="text-xs font-medium">{formatDate(r.startDateTime).replace(/,.*/, "")}</p>
                  <p className="font-mono text-sm text-muted-foreground">{formatTime(r.startDateTime)}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.customer.firstName} {r.customer.lastName}</p>
                  <p className="truncate text-xs text-muted-foreground">{r.partySize} guests · {r.table.name}</p>
                </div>
                <span className="shrink-0 text-sm font-medium">{r.partySize}p</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
      <div className="mb-5">
        <h2 className="font-heading text-lg font-medium tracking-tight">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
