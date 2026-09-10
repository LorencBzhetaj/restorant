import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  hint?: string;
  accent?: "brand" | "emerald" | "rose" | "amber" | "blue";
}) {
  const accentClass = {
    brand: "bg-brand/10 text-brand",
    emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
    rose: "bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400",
    amber: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
    blue: "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  }[accent ?? "brand"];

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
        <span className={cn("grid size-9 place-items-center rounded-xl", accentClass)}>
          <Icon className="size-4.5" />
        </span>
      </div>
      <div className="mt-3 font-heading text-[2rem] font-medium leading-none tracking-tight tabular-nums">{value}</div>
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
