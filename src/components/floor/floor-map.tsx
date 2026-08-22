"use client";

import { cn } from "@/lib/utils";
import { FLOOR_COLS, FLOOR_ROWS } from "@/lib/constants";

export type TableStatus = "free" | "occupied" | "tooSmall" | "inactive";

export interface FloorTable {
  id: string;
  name: string;
  seats: number;
  section: string;
  shape: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const STATUS_STYLE: Record<TableStatus, string> = {
  free: "border-emerald-400 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-700",
  occupied: "border-rose-300 bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800",
  tooSmall: "border-border bg-muted text-muted-foreground",
  inactive: "border-dashed border-border bg-transparent text-muted-foreground/50",
};

export function FloorMap({
  tables,
  statuses,
  selectedId,
  onSelect,
  clickable = "free",
}: {
  tables: FloorTable[];
  statuses: Record<string, TableStatus>;
  selectedId?: string | null;
  onSelect?: (table: FloorTable) => void;
  /** which tables respond to taps: only free ones (booking) or all (admin) */
  clickable?: "free" | "all" | "none";
}) {
  return (
    <div className="w-full">
      <div
        className="relative w-full rounded-xl border border-border bg-[repeating-linear-gradient(45deg,transparent,transparent_12px,color-mix(in_oklab,var(--muted)_60%,transparent)_12px,color-mix(in_oklab,var(--muted)_60%,transparent)_13px)] p-1"
        style={{ aspectRatio: `${FLOOR_COLS} / ${FLOOR_ROWS}` }}
      >
        {tables.map((t) => {
          const status = statuses[t.id] ?? "free";
          const isSelected = selectedId === t.id;
          const canClick =
            clickable === "all" ? true : clickable === "free" ? status === "free" : false;
          const isRound = t.shape === "round";

          return (
            <button
              key={t.id}
              type="button"
              disabled={!canClick}
              onClick={() => canClick && onSelect?.(t)}
              aria-label={`Table ${t.name}, ${t.seats} seats, ${status}`}
              className={cn(
                "absolute flex flex-col items-center justify-center border-2 p-0.5 text-center transition-all",
                isRound ? "rounded-full" : "rounded-lg",
                STATUS_STYLE[status],
                canClick && "cursor-pointer hover:scale-[1.04] hover:shadow-md",
                !canClick && "cursor-default",
                isSelected && "scale-[1.04] ring-2 ring-brand ring-offset-1 ring-offset-background",
              )}
              style={{
                left: `${(t.x / FLOOR_COLS) * 100}%`,
                top: `${(t.y / FLOOR_ROWS) * 100}%`,
                width: `${(t.w / FLOOR_COLS) * 100}%`,
                height: `${(t.h / FLOOR_ROWS) * 100}%`,
              }}
            >
              <span className="text-[10px] font-semibold leading-none sm:text-xs">{t.name}</span>
              <span className="mt-0.5 text-[9px] leading-none opacity-80 sm:text-[11px]">
                {t.seats}p
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function FloorLegend() {
  const items: { label: string; cls: string }[] = [
    { label: "Available", cls: "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/50" },
    { label: "Booked", cls: "border-rose-300 bg-rose-50 dark:bg-rose-950/50" },
    { label: "Too small", cls: "border-border bg-muted" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className={cn("size-3 rounded border-2", i.cls)} /> {i.label}
        </span>
      ))}
    </div>
  );
}
