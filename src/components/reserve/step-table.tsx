"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CalendarDays, Clock, Users, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FloorMap, FloorLegend, type FloorTable, type TableStatus } from "@/components/floor/floor-map";
import { formatDateLong } from "@/lib/format";

export function StepTable({
  tables,
  date,
  party,
  time,
  start,
}: {
  tables: FloorTable[];
  date: string;
  party: number;
  time: string;
  start: string;
}) {
  const router = useRouter();
  const [statuses, setStatuses] = useState<Record<string, TableStatus>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<FloorTable | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/availability?date=${date}&time=${time}&party=${party}`)
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        const map: Record<string, TableStatus> = {};
        for (const t of d.tables ?? []) map[t.tableId] = t.status;
        setStatuses(map);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [date, time, party]);

  const freeCount = Object.values(statuses).filter((s) => s === "free").length;

  function go(tableId: string) {
    const params = new URLSearchParams({ date, party: String(party), start, time, tableId });
    router.push(`/reserve/details?${params.toString()}`);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 text-center">
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Choose your table</h1>
        <p className="mt-2 text-muted-foreground">Tap a highlighted table on the floor plan.</p>
      </div>

      {/* Summary bar */}
      <div className="mb-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 rounded-xl border border-border bg-card px-5 py-3 text-sm">
        <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4 text-brand" /> {formatDateLong(new Date(start))}</span>
        <span className="inline-flex items-center gap-1.5"><Clock className="size-4 text-brand" /> {time}</span>
        <span className="inline-flex items-center gap-1.5"><Users className="size-4 text-brand" /> {party} {party === 1 ? "guest" : "guests"}</span>
      </div>

      {loading ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" /> <p className="text-sm">Loading floor plan…</p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between">
            <FloorLegend />
            <span className="text-sm text-muted-foreground">{freeCount} available</span>
          </div>

          <FloorMap
            tables={tables}
            statuses={statuses}
            selectedId={selected?.id}
            clickable="free"
            onSelect={(t) => setSelected(t)}
          />

          <div className="mt-4 rounded-lg bg-muted/50 px-4 py-2 text-center text-xs text-muted-foreground">
            <Sparkles className="mr-1 inline size-3.5" />
            Sections: Window (2-seaters) · Main hall (4-seaters) · Garden (large tables)
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
            <Button variant="outline" onClick={() => go("any")}>
              No preference — any available table
            </Button>
            <Button disabled={!selected} onClick={() => selected && go(selected.id)} size="lg">
              {selected ? `Continue with ${selected.name} (${selected.seats}p)` : "Select a table"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
