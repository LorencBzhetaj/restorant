"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  CheckCircle2,
  UserX,
  XCircle,
  CalendarClock,
  MessageCircle,
  Phone,
  User,
  Armchair,
  Users,
  CalendarDays,
  Clock,
  Utensils,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatDateLong, formatTime, toDateKey } from "@/lib/format";
import { NOTIFICATION_LABEL, ANY_TABLE, type NotificationType, type ReservationStatus } from "@/lib/constants";
import { StatusBadge } from "@/components/admin/status-badge";
import { setReservationStatus, rescheduleReservation } from "@/server/actions";

export interface AdminReservation {
  id: string;
  start: string;
  status: string;
  partySize: number;
  source: string;
  notes: string | null;
  tableId: string;
  tableName: string;
  tableSection: string;
  customerName: string;
  customerPhone: string;
  notifications: { id: string; type: string; status: string }[];
}

interface Slot {
  time: string;
  start: string;
}

export function ReservationDetail({
  reservation,
  tables,
  open,
  onOpenChange,
}: {
  reservation: AdminReservation | null;
  tables: { id: string; name: string; seats: number; section: string }[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"view" | "reschedule">("view");

  const [rDate, setRDate] = useState("");
  const [rSlots, setRSlots] = useState<Slot[]>([]);
  const [rSlot, setRSlot] = useState<Slot | null>(null);
  const [rTable, setRTable] = useState<string>(ANY_TABLE);
  const [rLoading, setRLoading] = useState(false);
  const [freeIds, setFreeIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && reservation) {
      setMode("view");
      setRDate(toDateKey(new Date(reservation.start)));
      setRSlot(null);
      setRTable(ANY_TABLE);
    }
  }, [open, reservation]);

  useEffect(() => {
    if (mode !== "reschedule" || !reservation || !rDate) return;
    let active = true;
    setRLoading(true);
    setRSlot(null);
    fetch(`/api/availability?date=${rDate}&party=${reservation.partySize}&ignore=${reservation.id}`)
      .then((r) => r.json())
      .then((d) => active && setRSlots(d.slots ?? []))
      .finally(() => active && setRLoading(false));
    return () => { active = false; };
  }, [mode, rDate, reservation]);

  useEffect(() => {
    if (!rSlot || !reservation) return;
    let active = true;
    setRTable(ANY_TABLE);
    fetch(`/api/availability?date=${rDate}&time=${rSlot.time}&party=${reservation.partySize}&ignore=${reservation.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        setFreeIds(new Set<string>((d.tables ?? []).filter((t: { status: string }) => t.status === "free").map((t: { tableId: string }) => t.tableId)));
      });
    return () => { active = false; };
  }, [rSlot, rDate, reservation]);

  if (!reservation) return null;
  const start = new Date(reservation.start);

  function changeStatus(status: ReservationStatus) {
    startTransition(async () => {
      const res = await setReservationStatus(reservation!.id, status);
      if (res.ok) {
        toast.success(`Marked ${status === "NoShow" ? "no-show" : status.toLowerCase()}`);
        onOpenChange(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function doReschedule() {
    if (!rSlot) return toast.error("Select a new time");
    startTransition(async () => {
      const res = await rescheduleReservation(reservation!.id, rSlot.start, rTable === ANY_TABLE ? undefined : rTable);
      if (res.ok) {
        toast.success("Reservation rescheduled");
        onOpenChange(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  const freeTables = tables.filter((t) => freeIds.has(t.id) && t.seats >= reservation.partySize);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">Reservation <StatusBadge status={reservation.status} /></DialogTitle>
          <DialogDescription>{reservation.source} booking</DialogDescription>
        </DialogHeader>

        {mode === "view" ? (
          <div className="space-y-5">
            <dl className="space-y-3 text-sm">
              <Row icon={User} label="Guest" value={reservation.customerName} />
              <Row icon={Phone} label="Phone" value={reservation.customerPhone} />
              <Row icon={Users} label="Party" value={`${reservation.partySize} guests`} />
              <Row icon={Armchair} label="Table" value={`${reservation.tableName} · ${reservation.tableSection}`} />
              <Row icon={CalendarDays} label="Date" value={formatDateLong(start)} />
              <Row icon={Clock} label="Time" value={formatTime(start)} />
            </dl>

            {reservation.notes && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <p className="font-medium">Notes</p>
                <p className="text-muted-foreground">{reservation.notes}</p>
              </div>
            )}

            <div className="rounded-lg border border-border p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <MessageCircle className="size-4 text-emerald-600" /> Notifications
                <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Demo</span>
              </div>
              {reservation.notifications.length === 0 ? (
                <p className="text-xs text-muted-foreground">No notifications sent yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {reservation.notifications.map((n) => (
                    <li key={n.id} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{NOTIFICATION_LABEL[n.type as NotificationType] ?? n.type}</span>
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-600"><CheckCircle2 className="size-3" /> {n.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              {reservation.status === "Confirmed" && (
                <Button size="sm" onClick={() => changeStatus("Seated")} disabled={pending}>
                  <Utensils className="size-4" /> Seat
                </Button>
              )}
              {reservation.status !== "Completed" && (
                <Button size="sm" variant="outline" onClick={() => changeStatus("Completed")} disabled={pending}>
                  <CheckCircle2 className="size-4" /> Complete
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setMode("reschedule")} disabled={pending}>
                <CalendarClock className="size-4" /> Reschedule
              </Button>
              {reservation.status !== "NoShow" && (
                <Button size="sm" variant="outline" onClick={() => changeStatus("NoShow")} disabled={pending}>
                  <UserX className="size-4" /> No-show
                </Button>
              )}
              {reservation.status !== "Cancelled" && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive" disabled={pending}><XCircle className="size-4" /> Cancel</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel this reservation?</AlertDialogTitle>
                      <AlertDialogDescription>This frees the table and sends {reservation.customerName} a cancellation notice.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep it</AlertDialogCancel>
                      <AlertDialogAction onClick={() => changeStatus("Cancelled")}>Cancel reservation</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={rDate} min={toDateKey(new Date())} onChange={(e) => setRDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>New time</Label>
              {rLoading ? (
                <div className="flex items-center justify-center gap-2 py-5 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading…</div>
              ) : rSlots.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border py-5 text-center text-sm text-muted-foreground">No availability</p>
              ) : (
                <div className="grid max-h-32 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-5">
                  {rSlots.map((s) => (
                    <button key={s.start} type="button" onClick={() => setRSlot(s)} className={cn("rounded-md border py-1.5 text-sm font-medium transition-colors", rSlot?.start === s.start ? "border-brand bg-brand/15" : "border-border hover:border-brand/60")}>{s.time}</button>
                  ))}
                </div>
              )}
            </div>
            {rSlot && (
              <div className="space-y-1.5">
                <Label>Table</Label>
                <Select value={rTable} onValueChange={setRTable}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY_TABLE}>Keep / any available</SelectItem>
                    {freeTables.map((t) => (<SelectItem key={t.id} value={t.id}>{t.name} · {t.seats}p · {t.section}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="ghost" onClick={() => setMode("view")}>Back</Button>
              <Button onClick={doReschedule} disabled={pending || !rSlot}>{pending && <Loader2 className="size-4 animate-spin" />} Confirm reschedule</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="inline-flex items-center gap-2 text-muted-foreground"><Icon className="size-4" /> {label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
