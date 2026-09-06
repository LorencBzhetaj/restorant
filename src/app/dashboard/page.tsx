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
import { getDashboardData, getAreasOverview } from "@/server/data";
import { formatTime, formatDate } from "@/lib/format";
import { StatCard } from "@/components/admin/stat-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { RevenueChart, AppointmentsChart, HorizontalCountChart } from "@/components/admin/charts";
import { AreaControls } from "@/components/admin/area-controls";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const [d, areasOverview] = await Promise.all([getDashboardData(), getAreasOverview()]);

  return (
    <div className="space-y-6">
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
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-semibold">Today&apos;s bookings</h2>
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

        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-semibold">Upcoming reservations</h2>
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
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4">
        <h2 className="font-semibold">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
