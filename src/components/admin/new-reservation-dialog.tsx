"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, CalendarX2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { toDateKey } from "@/lib/format";
import { ANY_TABLE } from "@/lib/constants";
import { createWalkIn } from "@/server/actions";

interface TableOpt {
  id: string;
  name: string;
  seats: number;
  section: string;
}
interface Slot {
  time: string;
  start: string;
}

export function NewReservationDialog({ tables }: { tables: TableOpt[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="size-4" /> New reservation</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New reservation</DialogTitle>
          <DialogDescription>Walk-in or phone booking — uses live table availability.</DialogDescription>
        </DialogHeader>
        {/* The form lives in a child that Radix unmounts on close, so every time
            the dialog reopens it remounts with fresh state — no reset effect. */}
        {open && <NewReservationForm tables={tables} onClose={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function NewReservationForm({ tables, onClose }: { tables: TableOpt[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [party, setParty] = useState(2);
  const [date, setDate] = useState(toDateKey(new Date()));
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [tableId, setTableId] = useState<string>(ANY_TABLE);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

  // Availability tagged with the query that produced it → loading and slots are
  // derived during render instead of set synchronously inside the effect.
  const slotsKey = `${date}|${party}`;
  const [slotsData, setSlotsData] = useState<{ key: string; slots: Slot[] } | null>(null);
  const [freeData, setFreeData] = useState<{ key: string; ids: Set<string> } | null>(null);

  useEffect(() => {
    let active = true;
    const key = `${date}|${party}`;
    fetch(`/api/availability?date=${date}&party=${party}`)
      .then((r) => r.json())
      .then((d) => active && setSlotsData({ key, slots: d.slots ?? [] }))
      .catch(() => active && setSlotsData({ key, slots: [] }));
    return () => { active = false; };
  }, [date, party]);

  const loadingSlots = !slotsData || slotsData.key !== slotsKey;
  const slots = useMemo(() => (loadingSlots || !slotsData ? [] : slotsData.slots), [loadingSlots, slotsData]);
  const slot = useMemo(() => slots.find((s) => s.start === selectedStart) ?? null, [slots, selectedStart]);

  useEffect(() => {
    if (!slot) return;
    let active = true;
    const key = `${date}|${party}|${slot.time}`;
    fetch(`/api/availability?date=${date}&time=${slot.time}&party=${party}`)
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        const free = new Set<string>((d.tables ?? []).filter((t: { status: string }) => t.status === "free").map((t: { tableId: string }) => t.tableId));
        setFreeData({ key, ids: free });
      });
    return () => { active = false; };
  }, [slot, date, party]);

  const freeKey = slot ? `${date}|${party}|${slot.time}` : "";
  const freeTableIds = freeData && freeData.key === freeKey ? freeData.ids : EMPTY_IDS;

  function submit() {
    if (!slot) return toast.error("Select a time");
    if (!firstName.trim() || !phone.trim()) return toast.error("Guest name and phone are required");
    startTransition(async () => {
      const res = await createWalkIn({ tableId, start: slot!.start, partySize: party, firstName, lastName, phone });
      if (res.ok) {
        toast.success("Reservation created");
        onClose();
        router.refresh();
      } else toast.error(res.error);
    });
  }

  const freeTables = tables.filter((t) => freeTableIds.has(t.id) && t.seats >= party);

  return (
    <>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Guests</Label>
              <Input type="number" min={1} max={20} value={party} onChange={(e) => setParty(Math.max(1, Number(e.target.value)))} />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} min={toDateKey(new Date())} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Time</Label>
            {loadingSlots ? (
              <div className="flex items-center justify-center gap-2 py-5 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading…</div>
            ) : slots.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-border py-5 text-center text-sm text-muted-foreground"><CalendarX2 className="size-5" /> No availability</div>
            ) : (
              <div className="grid max-h-32 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-5">
                {slots.map((s) => (
                  <button
                    key={s.start}
                    type="button"
                    onClick={() => { setSelectedStart(s.start); setTableId(ANY_TABLE); }}
                    className={cn("rounded-md border py-1.5 text-sm font-medium transition-colors", slot?.start === s.start ? "border-brand bg-brand/15" : "border-border hover:border-brand/60")}
                  >
                    {s.time}
                  </button>
                ))}
              </div>
            )}
          </div>

          {slot && (
            <div className="space-y-1.5">
              <Label>Table</Label>
              <Select value={tableId} onValueChange={setTableId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY_TABLE}>Any available table</SelectItem>
                  {freeTables.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name} · {t.seats}p · {t.section}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
            <div className="space-y-1.5"><Label>First name *</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Andi" /></div>
            <div className="space-y-1.5"><Label>Last name</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Hysa" /></div>
          </div>
          <div className="space-y-1.5"><Label>Phone *</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+355 69 123 4567" /></div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} Create reservation</Button>
        </DialogFooter>
    </>
  );
}

const EMPTY_IDS: Set<string> = new Set();
