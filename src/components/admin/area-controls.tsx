"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Home, Trees, AlertTriangle, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { formatDate, formatTime } from "@/lib/format";
import { toggleAreaOpen } from "@/server/actions";

interface Area {
  id: string;
  name: string;
  kind: string;
  isOpen: boolean;
  weatherDependent: boolean;
}
interface Affected {
  areaId: string;
  id: string;
  start: string;
  partySize: number;
  customerName: string;
  tableName: string;
}

export function AreaControls({ areas, affected }: { areas: Area[]; affected: Affected[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (areas.length === 0) return null;

  function toggle(id: string, next: boolean) {
    startTransition(async () => {
      const res = await toggleAreaOpen(id, next);
      if (res.ok) {
        toast.success(next ? "Area opened" : "Area closed");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-1 font-semibold">Seating areas</h2>
      <p className="mb-4 text-sm text-muted-foreground">Close an area (e.g. bad weather) to stop new bookings there instantly.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {areas.map((a) => {
          const mine = affected.filter((x) => x.areaId === a.id);
          const Icon = a.kind === "outdoor" ? Trees : Home;
          return (
            <div
              key={a.id}
              className={cn(
                "rounded-lg border p-4",
                a.isOpen ? "border-border" : "border-rose-300 bg-rose-50/50 dark:border-rose-900 dark:bg-rose-950/30",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 font-medium">
                  <Icon className="size-4 text-brand" /> {a.name}
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", a.isOpen ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300")}>
                    {a.isOpen ? "OPEN" : "CLOSED"}
                  </span>
                </span>
                <Switch checked={a.isOpen} onCheckedChange={(v) => toggle(a.id, v)} disabled={pending} />
              </div>

              {!a.isOpen && mine.length > 0 && (
                <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs dark:border-amber-900 dark:bg-amber-950/50">
                  <p className="flex items-center gap-1.5 font-medium text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="size-3.5" /> {mine.length} upcoming reservation{mine.length > 1 ? "s" : ""} here — move or contact these guests:
                  </p>
                  <ul className="mt-2 space-y-1">
                    {mine.slice(0, 5).map((r) => (
                      <li key={r.id} className="flex justify-between gap-2 text-amber-900 dark:text-amber-200">
                        <span>{formatDate(r.start).replace(/,.*/, "")} {formatTime(r.start)} · {r.customerName}</span>
                        <span className="shrink-0 opacity-70">{r.partySize}p · {r.tableName}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/dashboard/reservations" className="mt-2 inline-flex items-center gap-1 font-medium text-amber-800 underline dark:text-amber-300">
                    Manage in Reservations <ArrowRight className="size-3" />
                  </Link>
                </div>
              )}
              {!a.isOpen && mine.length === 0 && (
                <p className="mt-2 text-xs text-muted-foreground">No upcoming reservations affected.</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
