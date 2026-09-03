export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Clock, Users, Armchair, CheckCircle2, XCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getRestaurant } from "@/lib/settings";
import { formatDateLong, formatTime } from "@/lib/format";
import { BrandMark } from "@/components/site/brand-mark";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/admin/status-badge";
import { CancelButton } from "@/components/reserve/cancel-button";

export const metadata = { title: "Your reservation" };

export default async function ManageReservationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [reservation, settings] = await Promise.all([
    prisma.reservation.findUnique({
      where: { cancelToken: token },
      include: { table: true, customer: true },
    }),
    getRestaurant(),
  ]);
  if (!reservation) notFound();

  const start = new Date(reservation.startDateTime);
  const active = reservation.status === "Confirmed" || reservation.status === "Seated";
  const cancelled = reservation.status === "Cancelled";

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-2xl items-center px-4 sm:px-6">
          <Link href="/reserve"><BrandMark name={settings.name} /></Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-12 sm:px-6">
        <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">Your reservation</h1>
            <StatusBadge status={reservation.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {reservation.customer.firstName} {reservation.customer.lastName}
          </p>

          <dl className="mt-6 space-y-3 text-sm">
            <Row icon={Users} label="Party" value={`${reservation.partySize} ${reservation.partySize === 1 ? "guest" : "guests"}`} />
            <Row icon={CalendarDays} label="Date" value={formatDateLong(start)} />
            <Row icon={Clock} label="Time" value={formatTime(start)} />
            <Row icon={Armchair} label="Table" value={`${reservation.table.name} · ${reservation.table.section}`} />
          </dl>

          <div className="mt-8">
            {cancelled ? (
              <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                <XCircle className="size-4" /> This reservation has been cancelled.
              </div>
            ) : active ? (
              <CancelButton token={token} />
            ) : (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCircle2 className="size-4" /> This reservation is {reservation.status.toLowerCase()}.
              </div>
            )}
          </div>

          <div className="mt-6 text-center">
            <Button asChild variant="ghost" size="sm">
              <Link href="/reserve">Make a new reservation</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="inline-flex items-center gap-2 text-muted-foreground"><Icon className="size-4" /> {label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
