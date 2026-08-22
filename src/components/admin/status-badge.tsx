import { cn } from "@/lib/utils";
import { STATUS_BADGE, STATUS_LABEL, type ReservationStatus } from "@/lib/constants";

export function StatusBadge({ status }: { status: string }) {
  const s = status as ReservationStatus;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        STATUS_BADGE[s] ?? "bg-muted text-muted-foreground border-border",
      )}
    >
      {STATUS_LABEL[s] ?? status}
    </span>
  );
}
