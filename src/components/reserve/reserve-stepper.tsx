"use client";

import { usePathname } from "next/navigation";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "datetime", label: "Date & time", match: (p: string) => p === "/reserve" },
  { key: "table", label: "Table", match: (p: string) => p.includes("/reserve/table") },
  { key: "details", label: "Details", match: (p: string) => p.includes("/reserve/details") },
];

export function ReserveStepper() {
  const pathname = usePathname();
  const activeIndex = Math.max(0, STEPS.findIndex((s) => s.match(pathname)));

  return (
    <div className="mx-auto flex max-w-md items-center justify-between">
      {STEPS.map((step, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        return (
          <div key={step.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  "grid size-9 place-items-center rounded-full border text-sm font-semibold transition-colors",
                  done && "border-brand bg-brand text-brand-foreground",
                  active && "border-brand bg-brand/10 text-brand",
                  !done && !active && "border-border bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="size-4" /> : i + 1}
              </div>
              <span className={cn("text-xs font-medium", active ? "text-foreground" : "text-muted-foreground")}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn("mx-2 h-px flex-1 transition-colors", done ? "bg-brand" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}
