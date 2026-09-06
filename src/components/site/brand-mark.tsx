import { cn } from "@/lib/utils";

export function BrandMark({
  className,
  light = false,
  name = "Gjeçaj Alpine Restaurant Cuisine",
}: {
  className?: string;
  light?: boolean;
  name?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "grid size-9 place-items-center rounded-md border font-heading text-base font-semibold",
          light ? "border-white/20 bg-white/5 text-brand" : "border-brand/30 bg-brand/10 text-brand",
        )}
        aria-hidden
      >
        {name.trim().charAt(0).toUpperCase() || "G"}
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-heading text-lg font-semibold tracking-tight",
            light ? "text-white" : "text-foreground",
          )}
        >
          {name}
        </span>
        <span
          className={cn(
            "text-[10px] font-medium uppercase tracking-[0.2em]",
            light ? "text-white/50" : "text-muted-foreground",
          )}
        >
          Alpine Cuisine
        </span>
      </span>
    </span>
  );
}
