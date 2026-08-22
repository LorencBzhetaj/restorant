export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Phone, MessageCircle, Mail, MapPin, Users, CalendarCheck } from "lucide-react";
import { getCustomerDetail, getRestaurant } from "@/server/data";
import { formatMoney, formatDate, formatTime } from "@/lib/format";
import { StatusBadge } from "@/components/admin/status-badge";
import { CustomerNotes } from "@/components/admin/customer-notes";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Guest" };

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [customer, settings] = await Promise.all([getCustomerDetail(id), getRestaurant()]);
  if (!customer) notFound();
  const cur = settings.currency;
  const s = customer.stats;

  return (
    <div className="space-y-6">
      <Link href="/dashboard/customers" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to guests
      </Link>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-4">
              <div className="grid size-14 place-items-center rounded-full bg-brand/10 font-heading text-xl font-semibold text-brand">
                {customer.firstName[0]}{customer.lastName[0]}
              </div>
              <div>
                <h1 className="font-heading text-xl font-semibold">{customer.firstName} {customer.lastName}</h1>
                <p className="text-sm text-muted-foreground">Guest since {formatDate(customer.createdAt)}</p>
              </div>
            </div>
            <div className="mt-5 space-y-3 text-sm">
              <Contact icon={Phone} value={customer.phone} href={`tel:${customer.phone}`} />
              {customer.whatsappNumber && <Contact icon={MessageCircle} value={customer.whatsappNumber} />}
              {customer.email && <Contact icon={Mail} value={customer.email} href={`mailto:${customer.email}`} />}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-3 font-semibold">Notes</h2>
            <CustomerNotes id={customer.id} notes={customer.notes ?? ""} />
          </div>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MiniStat label="Total visits" value={s.total} />
            <MiniStat label="Completed" value={s.completed} />
            <MiniStat label="Cancelled" value={s.cancelled} />
            <MiniStat label="No-shows" value={s.noShows} />
            <MiniStat label="Total guests" value={s.covers} icon={Users} />
            <MiniStat label="Est. spend" value={formatMoney(s.totalSpent, cur)} />
            <MiniStat label="Avg party" value={s.avgPartySize || "—"} />
            <MiniStat label="Favourite area" value={s.favoriteSection ?? "—"} icon={MapPin} />
          </div>

          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border px-5 py-4">
              <CalendarCheck className="size-4 text-muted-foreground" />
              <h2 className="font-semibold">Reservation history</h2>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Party</TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customer.reservations.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{formatDate(r.startDateTime)}</div>
                      <div className="text-xs text-muted-foreground">{formatTime(r.startDateTime)}</div>
                    </TableCell>
                    <TableCell>{r.partySize} guests</TableCell>
                    <TableCell className="text-muted-foreground">{r.table.name} · {r.table.section}</TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                  </TableRow>
                ))}
                {customer.reservations.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">No reservations yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Contact({ icon: Icon, value, href }: { icon: React.ElementType; value: string; href?: string }) {
  const content = <span className="inline-flex items-center gap-2.5 text-foreground"><Icon className="size-4 text-muted-foreground" /> {value}</span>;
  return href ? <a href={href} className="block hover:underline">{content}</a> : <div>{content}</div>;
}

function MiniStat({ label, value, icon: Icon }: { label: string; value: string | number; icon?: React.ElementType }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">{Icon && <Icon className="size-3.5" />} {label}</div>
      <div className="mt-1 truncate font-heading text-lg font-semibold">{value}</div>
    </div>
  );
}
