"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CalendarX2, Sun, Moon, Users, Minus, Plus, Home, Trees } from "lucide-react";
import { cn } from "@/lib/utils";
import { toDateKey, pad2 } from "@/lib/format";
import { DAY_NAMES_SHORT } from "@/lib/constants";

interface Slot {
  time: string;
  start: string;
  freeTables: number;
}

type Area = "no_preference" | "indoor" | "outdoor";

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

export function StepDateTime({
  maxParty,
  hasIndoor,
  hasOutdoor,
}: {
  maxParty: number;
  hasIndoor: boolean;
  hasOutdoor: boolean;
}) {
  const router = useRouter();
  const days = useMemo(() => buildDays(14), []);
  const showAreas = hasIndoor && hasOutdoor;
  const [party, setParty] = useState(2);
  const [area, setArea] = useState<Area>("no_preference");
  const [date, setDate] = useState(days[0].key);
  // Availability is tagged with the query that produced it, so `loading` and the
  // shown slots are derived during render — no synchronous setState in an effect.
  const queryKey = `${date}|${party}|${area}`;
  const [result, setResult] = useState<{ key: string; slots: Slot[] } | null>(null);

  useEffect(() => {
    let active = true;
    const key = `${date}|${party}|${area}`;
    fetch(`/api/availability?date=${date}&party=${party}&area=${area}`)
      .then((r) => r.json())
      .then((d) => active && setResult({ key, slots: d.slots ?? [] }))
      .catch(() => active && setResult({ key, slots: [] }));
    return () => {
      active = false;
    };
  }, [date, party, area]);

  const loading = !result || result.key !== queryKey;
  const slots = loading ? [] : result.slots;

  const groups = [
    { key: "lunch", label: "Lunch", icon: Sun, items: slots.filter((s) => Number(s.time.split(":")[0]) < 16) },
    { key: "dinner", label: "Dinner", icon: Moon, items: slots.filter((s) => Number(s.time.split(":")[0]) >= 16) },
  ].filter((g) => g.items.length > 0);

  function choose(slot: Slot) {
    const params = new URLSearchParams({
      date,
      party: String(party),
      start: slot.start,
      tableId: "any",
      area,
    });
    router.push(`/reserve/details?${params.toString()}`);
  }

  const AREA_OPTS: { key: Area; label: string; icon: React.ElementType }[] = [
    { key: "no_preference", label: "No preference", icon: Users },
    { key: "indoor", label: "Indoor", icon: Home },
    { key: "outdoor", label: "Outdoor", icon: Trees },
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-10 text-center">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-brand">Reservations</p>
        <h1 className="font-heading text-4xl font-medium tracking-tight sm:text-[2.75rem] sm:leading-[1.05]">Reserve your table</h1>
        <p className="mt-3 text-[15px] text-muted-foreground">A few details and your table in the Alps is set.</p>
        <span className="mx-auto mt-5 block h-px w-16 bg-gradient-to-r from-transparent via-brand/50 to-transparent" />
      </div>

      {/* Party size */}
      <section className="mb-4 rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <SectionLabel icon={Users}>Party size</SectionLabel>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setParty((p) => Math.max(1, p - 1))}
              className="grid size-10 place-items-center rounded-full border border-border text-foreground transition-colors hover:border-brand hover:text-brand disabled:opacity-30 disabled:hover:border-border disabled:hover:text-foreground"
              disabled={party <= 1}
              aria-label="Fewer guests"
            >
              <Minus className="size-4" />
            </button>
            <span className="w-12 text-center font-heading text-3xl font-medium tabular-nums">{party}</span>
            <button
              onClick={() => setParty((p) => Math.min(maxParty, p + 1))}
              className="grid size-10 place-items-center rounded-full border border-border text-foreground transition-colors hover:border-brand hover:text-brand disabled:opacity-30 disabled:hover:border-border disabled:hover:text-foreground"
              disabled={party >= maxParty}
              aria-label="More guests"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>
        {party >= maxParty && (
          <p className="mt-4 border-t border-border/60 pt-3 text-xs text-muted-foreground">
            For parties larger than {maxParty}, please call us — we&apos;ll arrange it personally.
          </p>
        )}
      </section>

      {/* Area */}
      {showAreas && (
        <section className="mb-6 rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
          <SectionLabel icon={Trees} className="mb-4">Seating area</SectionLabel>
          <div className="grid grid-cols-3 gap-2.5">
            {AREA_OPTS.map((o) => {
              const on = area === o.key;
              return (
                <button
                  key={o.key}
                  onClick={() => setArea(o.key)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border px-2 py-4 text-sm font-medium transition-all",
                    on
                      ? "border-brand bg-brand/[0.08] text-foreground shadow-sm ring-1 ring-brand/30"
                      : "border-border text-muted-foreground hover:border-brand/40 hover:text-foreground",
                  )}
                >
                  <o.icon className={cn("size-5 transition-colors", on ? "text-brand" : "text-muted-foreground")} /> {o.label}
                </button>
              );
            })}
          </div>
          {area === "outdoor" && (
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              Outdoor seating depends on the weather. If conditions change, we&apos;ll contact you to move you indoors.
            </p>
          )}
        </section>
      )}

      {/* Date */}
      <div className="mb-8">
        <SectionLabel icon={CalendarX2} className="mb-3 px-1">Choose a date</SectionLabel>
        <div className="scrollbar-thin -mx-1 flex gap-2.5 overflow-x-auto px-1 pb-2">
          {days.map((d) => {
            const active = d.key === date;
            return (
              <button
                key={d.key}
                onClick={() => setDate(d.key)}
                className={cn(
                  "flex min-w-[4.25rem] shrink-0 flex-col items-center gap-0.5 rounded-2xl border px-3 py-3.5 transition-all",
                  active
                    ? "border-brand bg-brand text-brand-foreground shadow-sm"
                    : "border-border bg-card text-foreground hover:border-brand/40",
                )}
              >
                <span className={cn("text-[10px] font-semibold uppercase tracking-wider", active ? "text-brand-foreground/80" : "text-muted-foreground")}>{d.label}</span>
                <span className="font-heading text-xl font-medium leading-none">{pad2(d.date.getDate())}</span>
                <span className={cn("text-[10px]", active ? "text-brand-foreground/80" : "text-muted-foreground")}>{DAY_NAMES_SHORT[d.date.getDay()]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Times */}
      <div className="min-h-52">
        {loading ? (
          <div className="flex h-52 flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="size-6 animate-spin text-brand" />
            <p className="text-sm">Finding available times…</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="flex h-52 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 text-center">
            <CalendarX2 className="size-8 text-muted-foreground" />
            <div>
              <p className="font-heading text-lg font-medium">No tables available</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
                {area === "outdoor" ? "Outdoor may be closed — try Indoor, another date or a smaller party." : "Try another date or a smaller party."}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-7">
            {groups.map((g) => (
              <div key={g.key}>
                <div className="mb-3.5 flex items-center gap-2.5">
                  <g.icon className="size-4 text-brand" />
                  <span className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">{g.label}</span>
                  <span className="h-px flex-1 bg-border" />
                </div>
                <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6">
                  {g.items.map((slot) => (
                    <button
                      key={slot.start}
                      onClick={() => choose(slot)}
                      className="rounded-xl border border-border bg-card py-2.5 text-sm font-medium tabular-nums transition-all hover:border-brand hover:bg-brand hover:text-brand-foreground hover:shadow-sm"
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

function SectionLabel({ icon: Icon, children, className }: { icon: React.ElementType; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground", className)}>
      <Icon className="size-4 text-brand" /> {children}
    </span>
  );
}
