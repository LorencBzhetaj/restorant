"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatDate, formatTime } from "@/lib/format";
import { STATUS_LABEL, RESERVATION_STATUSES } from "@/lib/constants";
import { StatusBadge } from "@/components/admin/status-badge";
import { ReservationDetail, type AdminReservation } from "@/components/admin/reservation-detail";

const FILTERS = ["all", ...RESERVATION_STATUSES] as const;

export function ReservationsManager({
  reservations,
  tables,
}: {
  reservations: AdminReservation[];
  tables: { id: string; name: string; seats: number; section: string }[];
}) {
  const [filter, setFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<AdminReservation | null>(null);
  const [open, setOpen] = useState(false);

  const filtered = reservations.filter((r) => {
    if (filter !== "all" && r.status !== filter) return false;
    if (q) {
      const s = `${r.customerName} ${r.tableName} ${r.tableSection}`.toLowerCase();
      if (!s.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  const counts = (status: string) =>
    status === "all" ? reservations.length : reservations.filter((r) => r.status === status).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                filter === f ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {f === "all" ? "All" : STATUS_LABEL[f as keyof typeof STATUS_LABEL]}
              <span className="ml-1.5 opacity-60">{counts(f)}</span>
            </button>
          ))}
        </div>
        <div className="relative sm:w-64">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="pl-9" />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date & time</TableHead>
              <TableHead>Guest</TableHead>
              <TableHead>Party</TableHead>
              <TableHead>Table</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => { setSelected(r); setOpen(true); }}>
                <TableCell>
                  <div className="font-medium">{formatDate(r.start)}</div>
                  <div className="text-xs text-muted-foreground">{formatTime(r.start)}</div>
                </TableCell>
                <TableCell className="font-medium">{r.customerName}</TableCell>
                <TableCell className="text-muted-foreground">{r.partySize}</TableCell>
                <TableCell className="text-muted-foreground">{r.tableName} · {r.tableSection}</TableCell>
                <TableCell><StatusBadge status={r.status} /></TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">No reservations found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <ReservationDetail reservation={selected} tables={tables} open={open} onOpenChange={setOpen} />
    </div>
  );
}
