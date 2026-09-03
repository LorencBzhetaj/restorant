"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CalendarX2, Sun, Moon, Users, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toDateKey, pad2 } from "@/lib/format";
import { DAY_NAMES_SHORT } from "@/lib/constants";

interface Slot {
  time: string;
  start: string;
  freeTables: number;
}

function buildDays(count: number) {
  const out: { key: string; date: Date; label: string }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : DAY_NAMES_SHORT[d.getDay()];
    out.push({ key: toDateKey(d), date: d, label });
  }
  return out;
}

export function StepDateTime({ maxParty }: { maxParty: number }) {
  const router = useRouter();
  const days = useMemo(() => buildDays(14), []);
  const [party, setParty] = useState(2);
  const [date, setDate] = useState(days[0].key);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/availability?date=${date}&party=${party}`)
      .then((r) => r.json())
      .then((d) => active && setSlots(d.slots ?? []))
      .catch(() => active && setSlots([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [date, party]);

  const groups = [
    { key: "lunch", label: "Lunch", icon: Sun, items: slots.filter((s) => Number(s.time.split(":")[0]) < 16) },
    { key: "dinner", label: "Dinner", icon: Moon, items: slots.filter((s) => Number(s.time.split(":")[0]) >= 16) },
  ].filter((g) => g.items.length > 0);

  function choose(slot: Slot) {
    // Table is assigned automatically — go straight to the details step.
    const params = new URLSearchParams({ date, party: String(party), start: slot.start, tableId: "any" });
    router.push(`/reserve/details?${params.toString()}`);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 text-center">
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Reserve a table</h1>
        <p className="mt-2 text-muted-foreground">How many guests, and when?</p>
      </div>

      {/* Party size */}
      <div className="mb-6 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 font-medium">
            <Users className="size-4 text-brand" /> Party size
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setParty((p) => Math.max(1, p - 1))}
              className="grid size-9 place-items-center rounded-lg border border-border transition-colors hover:bg-muted disabled:opacity-40"
              disabled={party <= 1}
              aria-label="Fewer guests"
            >
              <Minus className="size-4" />
            </button>
            <span className="w-10 text-center font-heading text-2xl font-semibold">{party}</span>
            <button
              onClick={() => setParty((p) => Math.min(maxParty, p + 1))}
              className="grid size-9 place-items-center rounded-lg border border-border transition-colors hover:bg-muted disabled:opacity-40"
              disabled={party >= maxParty}
              aria-label="More guests"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>
        {party >= maxParty && (
          <p className="mt-3 text-xs text-muted-foreground">
            For parties larger than {maxParty}, please call us — we&apos;ll arrange it personally.
          </p>
        )}
      </div>

      {/* Date */}
      <div className="scrollbar-thin -mx-1 mb-8 flex gap-2 overflow-x-auto px-1 pb-2">
        {days.map((d) => {
          const active = d.key === date;
          return (
            <button
              key={d.key}
              onClick={() => setDate(d.key)}
              className={cn(
                "flex min-w-16 shrink-0 flex-col items-center gap-0.5 rounded-xl border px-3 py-3 transition-colors",
                active ? "border-brand bg-brand/10" : "border-border bg-card hover:border-brand/50",
              )}
            >
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{d.label}</span>
              <span className="text-lg font-semibold">{pad2(d.date.getDate())}</span>
              <span className="text-[10px] text-muted-foreground">{DAY_NAMES_SHORT[d.date.getDay()]}</span>
            </button>
          );
        })}
      </div>

      {/* Times */}
      <div className="min-h-52">
        {loading ? (
          <div className="flex h-52 flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
            <p className="text-sm">Finding available times…</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="flex h-52 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border text-center">
            <CalendarX2 className="size-8 text-muted-foreground" />
            <div>
              <p className="font-medium">No tables available</p>
              <p className="mt-1 text-sm text-muted-foreground">Try another date or a smaller party.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((g) => (
              <div key={g.key}>
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <g.icon className="size-4" /> {g.label}
                </div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                  {g.items.map((slot) => (
                    <button
                      key={slot.start}
                      onClick={() => choose(slot)}
                      className="rounded-lg border border-border bg-card py-2.5 text-sm font-medium transition-colors hover:border-brand hover:bg-brand/10"
                    >
                      {slot.time}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
