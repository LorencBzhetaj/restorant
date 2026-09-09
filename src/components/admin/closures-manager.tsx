"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Loader2, Trash2, Pencil, CalendarOff, AlertTriangle, ArrowRight, CloudRain } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toDateKey, pad2, formatDate, formatTime } from "@/lib/format";
import { addAreaClosure, updateAreaClosure, deleteAreaClosure } from "@/server/actions";

interface AreaOpt { id: string; name: string; kind: string }
interface Affected { id: string; start: string; partySize: number; customerName: string; tableName: string; requestedArea: string }
interface Closure {
  id: string; areaId: string; areaName: string; areaKind: string;
  startDateTime: string; endDateTime: string; reason: string | null; affected: Affected[];
}

function isFullDay(startIso: string, endIso: string): boolean {
  const s = new Date(startIso), e = new Date(endIso);
  return s.getHours() === 0 && s.getMinutes() === 0 && e.getHours() === 0 && e.getMinutes() === 0 && e.getTime() - s.getTime() >= 23 * 3600 * 1000;
}

export function ClosuresManager({ areas, closures }: { areas: AreaOpt[]; closures: Closure[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [areaId, setAreaId] = useState(areas[0]?.id ?? "");
  const [date, setDate] = useState(toDateKey(new Date()));
  const [fullDay, setFullDay] = useState(true);
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("23:00");
  const [reason, setReason] = useState("");

  function openNew() {
    setEditId(null);
    setAreaId(areas[0]?.id ?? "");
    setDate(toDateKey(new Date()));
    setFullDay(true);
    setStartTime("18:00");
    setEndTime("23:00");
    setReason("");
    setOpen(true);
  }
  function openEdit(c: Closure) {
    setEditId(c.id);
    setAreaId(c.areaId);
    const s = new Date(c.startDateTime), e = new Date(c.endDateTime);
    setDate(toDateKey(s));
    const fd = isFullDay(c.startDateTime, c.endDateTime);
    setFullDay(fd);
    setStartTime(`${pad2(s.getHours())}:${pad2(s.getMinutes())}`);
    setEndTime(fd ? "23:00" : `${pad2(e.getHours())}:${pad2(e.getMinutes())}`);
    setReason(c.reason ?? "");
    setOpen(true);
  }

  function save() {
    const payload = { areaId, date, fullDay, startTime, endTime, reason };
    startTransition(async () => {
      const res = editId ? await updateAreaClosure(editId, payload) : await addAreaClosure(payload);
      if (res.ok) { toast.success(editId ? "Closure updated" : "Closure added"); setOpen(false); router.refresh(); }
      else toast.error(res.error);
    });
  }
  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteAreaClosure(id);
      if (res.ok) { toast.success("Closure removed — availability restored"); router.refresh(); } else toast.error(res.error);
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Temporary closures</h2>
          <p className="text-sm text-muted-foreground">Close an area for a specific date/time (weather, private event). Future dates stay open.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew}><Plus className="size-4" /> New closure</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>{editId ? "Edit closure" : "New closure"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Area</Label>
                <Select value={areaId} onValueChange={setAreaId}>
                  <SelectTrigger><SelectValue placeholder="Select area" /></SelectTrigger>
                  <SelectContent>
                    {areas.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} ({a.kind})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={date} min={toDateKey(new Date())} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={fullDay} onCheckedChange={setFullDay} />
                <Label className="cursor-default">Full day</Label>
              </div>
              {!fullDay && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>From</Label><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>To</Label><Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Reason (optional)</Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Rain / cold / private event" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} {editId ? "Save" : "Add closure"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {closures.length === 0 && (
          <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">No temporary closures scheduled.</p>
        )}
        {closures.map((c) => {
          const fd = isFullDay(c.startDateTime, c.endDateTime);
          return (
            <div key={c.id} className="rounded-lg border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <CloudRain className="mt-0.5 size-4 text-brand" />
                  <div>
                    <p className="font-medium">
                      {c.areaName} · {formatDate(c.startDateTime)}
                      <span className="text-muted-foreground"> · {fd ? "Full day" : `${formatTime(c.startDateTime)}–${formatTime(c.endDateTime)}`}</span>
                    </p>
                    {c.reason && <p className="text-xs text-muted-foreground">{c.reason}</p>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="icon-sm" variant="ghost" onClick={() => openEdit(c)}><Pencil className="size-4" /></Button>
                  <Button size="icon-sm" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="size-4" /></Button>
                </div>
              </div>

              {c.affected.length > 0 && (
                <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs dark:border-amber-900 dark:bg-amber-950/50">
                  <p className="flex items-center gap-1.5 font-medium text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="size-3.5" /> {c.affected.length} reservation{c.affected.length > 1 ? "s" : ""} affected — reschedule these guests:
                  </p>
                  <ul className="mt-2 space-y-1">
                    {c.affected.map((r) => (
                      <li key={r.id} className="flex justify-between gap-2 text-amber-900 dark:text-amber-200">
                        <span>{formatTime(r.start)} · {r.customerName}</span>
                        <span className="shrink-0 opacity-70">{r.partySize}p · {r.tableName}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/dashboard/reservations" className="mt-2 inline-flex items-center gap-1 font-medium text-amber-800 underline dark:text-amber-300">
                    Manage in Reservations <ArrowRight className="size-3" />
                  </Link>
                </div>
              )}
              {c.affected.length === 0 && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarOff className="size-3.5" /> No reservations affected.</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
