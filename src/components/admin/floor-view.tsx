"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toDateKey, formatDateLong, pad2 } from "@/lib/format";
import { FloorMap, FloorLegend, type FloorTable, type TableStatus } from "@/components/floor/floor-map";
import { ReservationDetail, type AdminReservation } from "@/components/admin/reservation-detail";
import { StatusBadge } from "@/components/admin/status-badge";

const TIMES: string[] = [];
for (let m = 12 * 60; m <= 22 * 60; m += 30) TIMES.push(`${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`);

export function FloorView({
  tables,
  reservations,
  turnMinutes,
}: {
  tables: FloorTable[];
  reservations: AdminReservation[];
  turnMinutes: number;
}) {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const defaultTime = TIMES.find((t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m >= nowMin;
  }) ?? "20:00";

  const [date, setDate] = useState(toDateKey(now));
  const [time, setTime] = useState(defaultTime);
  const [selected, setSelected] = useState<AdminReservation | null>(null);
  const [open, setOpen] = useState(false);

  const [th, tm] = time.split(":").map(Number);
  const slotMin = th * 60 + tm;

  // Reservations on the selected date (active only)
  const dayReservations = useMemo(
    () =>
      reservations
        .filter((r) => toDateKey(new Date(r.start)) === date && r.status !== "Cancelled" && r.status !== "NoShow")
        .sort((a, b) => a.start.localeCompare(b.start)),
    [reservations, date],
  );

  // Which reservation occupies each table at the selected time
  const occupancy = useMemo(() => {
    const map: Record<string, AdminReservation> = {};
    for (const r of dayReservations) {
      const s = new Date(r.start);
      const startMin = s.getHours() * 60 + s.getMinutes();
      const endMin = startMin + turnMinutes;
      if (slotMin >= startMin && slotMin < endMin) map[r.tableId] = r;
    }
    return map;
  }, [dayReservations, slotMin, turnMinutes]);

  const statuses: Record<string, TableStatus> = {};
  for (const t of tables) statuses[t.id] = occupancy[t.id] ? "occupied" : "free";

  const occupied = Object.keys(occupancy).length;
  const free = tables.length - occupied;

  function onSelect(t: FloorTable) {
    const res = occupancy[t.id];
    if (res) {
      setSelected(res);
      setOpen(true);
    }
  }

  function shiftDay(dir: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + dir);
    setDate(toDateKey(d));
  }

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon-sm" onClick={() => shiftDay(-1)}><ChevronLeft className="size-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setDate(toDateKey(new Date()))}>Today</Button>
          <Button variant="outline" size="icon-sm" onClick={() => shiftDay(1)}><ChevronRight className="size-4" /></Button>
          <h2 className="ml-2 font-heading text-lg font-semibold">{formatDateLong(new Date(date))}</h2>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-emerald-500" /> {free} free</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-rose-400" /> {occupied} seated</span>
        </div>
      </div>

      {/* Time selector */}
      <div className="scrollbar-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {TIMES.map((t) => (
          <button
            key={t}
            onClick={() => setTime(t)}
            className={cn(
              "shrink-0 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
              t === time ? "border-brand bg-brand/15 text-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <FloorLegend />
            <span className="text-sm text-muted-foreground">at {time}</span>
          </div>
          <FloorMap tables={tables} statuses={statuses} clickable="all" onSelect={onSelect} />
          <p className="mt-3 text-center text-xs text-muted-foreground">Tap a seated (red) table to view or manage its reservation.</p>
        </div>

        {/* Day list */}
        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h3 className="font-semibold">Bookings this day</h3>
            <p className="text-xs text-muted-foreground">{dayReservations.length} reservations</p>
          </div>
          <ul className="max-h-[520px] divide-y divide-border overflow-y-auto">
            {dayReservations.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">No reservations.</li>}
            {dayReservations.map((r) => (
              <li key={r.id}>
                <button onClick={() => { setSelected(r); setOpen(true); }} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50">
                  <span className="w-12 shrink-0 font-mono text-sm text-muted-foreground">{new Date(r.start).getHours().toString().padStart(2, "0")}:{new Date(r.start).getMinutes().toString().padStart(2, "0")}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.customerName}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.partySize}p · {r.tableName}</p>
                  </div>
                  <StatusBadge status={r.status} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ReservationDetail reservation={selected} tables={tables.map((t) => ({ id: t.id, name: t.name, seats: t.seats, section: t.section }))} open={open} onOpenChange={setOpen} />
    </div>
  );
}
