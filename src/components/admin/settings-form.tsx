"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Plus, Trash2, Check, CalendarOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DAY_NAMES } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import {
  updateSettings, addOpeningHour, deleteOpeningHour, addClosure, deleteClosure,
} from "@/server/actions";

interface Settings {
  name: string; tagline: string | null; phone: string | null; whatsapp: string | null;
  address: string | null; email: string | null; currency: string;
  turnDurationMinutes: number; bookingInterval: number; seatingBuffer: number; maxPartySize: number;
}
interface OpeningHour { id: string; dayOfWeek: number; startTime: string; endTime: string }
interface Closure { id: string; startDate: string; endDate: string; reason: string | null }

export function SettingsForm({
  settings, openingHours, closures,
}: {
  settings: Settings;
  openingHours: OpeningHour[];
  closures: Closure[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: settings.name, tagline: settings.tagline ?? "", phone: settings.phone ?? "",
    whatsapp: settings.whatsapp ?? "", address: settings.address ?? "", email: settings.email ?? "",
    currency: settings.currency, turnDurationMinutes: settings.turnDurationMinutes,
    bookingInterval: settings.bookingInterval, seatingBuffer: settings.seatingBuffer, maxPartySize: settings.maxPartySize,
  });

  function save() {
    if (!form.name.trim()) return toast.error("Name is required");
    startTransition(async () => {
      const res = await updateSettings(form);
      if (res.ok) { toast.success("Settings saved"); router.refresh(); } else toast.error(res.error);
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Section title="Restaurant details" description="Shown across the public site and booking pages.">
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldFull label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></FieldFull>
          <FieldFull label="Tagline"><Input value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} /></FieldFull>
          <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="WhatsApp"><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></Field>
          <Field label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Currency">
            <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="EUR">EUR (€)</SelectItem>
                <SelectItem value="USD">USD ($)</SelectItem>
                <SelectItem value="GBP">GBP (£)</SelectItem>
                <SelectItem value="ALL">ALL (L)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <FieldFull label="Address"><Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} /></FieldFull>
        </div>
      </Section>

      <Section title="Booking rules" description="How reservations are scheduled.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Seating duration (min)"><Input type="number" value={form.turnDurationMinutes} onChange={(e) => setForm({ ...form, turnDurationMinutes: Number(e.target.value) })} /></Field>
          <Field label="Booking interval (min)"><Input type="number" value={form.bookingInterval} onChange={(e) => setForm({ ...form, bookingInterval: Number(e.target.value) })} /></Field>
          <Field label="Buffer between bookings (min)"><Input type="number" value={form.seatingBuffer} onChange={(e) => setForm({ ...form, seatingBuffer: Number(e.target.value) })} /></Field>
          <Field label="Max party size (online)"><Input type="number" value={form.maxPartySize} onChange={(e) => setForm({ ...form, maxPartySize: Number(e.target.value) })} /></Field>
        </div>
        <div className="mt-6 flex justify-end">
          <Button onClick={save} disabled={pending}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save settings</Button>
        </div>
      </Section>

      <OpeningHoursEditor openingHours={openingHours} />
      <ClosuresEditor closures={closures} />
    </div>
  );
}

function OpeningHoursEditor({ openingHours }: { openingHours: OpeningHour[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [addingDay, setAddingDay] = useState<number | null>(null);
  const [start, setStart] = useState("12:00");
  const [end, setEnd] = useState("15:00");
  const order = [1, 2, 3, 4, 5, 6, 0];

  function add(day: number) {
    startTransition(async () => {
      const res = await addOpeningHour({ dayOfWeek: day, startTime: start, endTime: end });
      if (res.ok) { toast.success("Shift added"); setAddingDay(null); router.refresh(); } else toast.error(res.error);
    });
  }
  function remove(id: string) {
    startTransition(async () => { await deleteOpeningHour(id); router.refresh(); });
  }

  return (
    <Section title="Opening hours" description="Multiple shifts per day are supported (lunch & dinner).">
      <div className="divide-y divide-border">
        {order.map((day) => {
          const periods = openingHours.filter((h) => h.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
          return (
            <div key={day} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
              <div className="w-28 shrink-0 font-medium">{DAY_NAMES[day]}</div>
              <div className="flex flex-1 flex-wrap items-center gap-2">
                {periods.length === 0 && <span className="text-sm text-muted-foreground">Closed</span>}
                {periods.map((p) => (
                  <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 py-1 pl-3 pr-1.5 text-sm">
                    {p.startTime}–{p.endTime}
                    <button onClick={() => remove(p.id)} className="grid size-5 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="size-3" /></button>
                  </span>
                ))}
                {addingDay === day ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="h-8 w-28" />
                    <span className="text-muted-foreground">–</span>
                    <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="h-8 w-28" />
                    <Button size="icon-sm" onClick={() => add(day)} disabled={pending}><Check className="size-4" /></Button>
                    <Button size="icon-sm" variant="ghost" onClick={() => setAddingDay(null)}>✕</Button>
                  </span>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setAddingDay(day)}><Plus className="size-3.5" /> Add shift</Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function ClosuresEditor({ closures }: { closures: Closure[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  function add() {
    if (!startDate || !endDate) return toast.error("Pick both dates");
    startTransition(async () => {
      const res = await addClosure({ startDate, endDate, reason });
      if (res.ok) { toast.success("Closure added"); setStartDate(""); setEndDate(""); setReason(""); router.refresh(); } else toast.error(res.error);
    });
  }
  function remove(id: string) {
    startTransition(async () => { await deleteClosure(id); router.refresh(); });
  }

  return (
    <Section title="Closures" description="Dates when the restaurant is closed (holidays, private events).">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="space-y-1.5"><Label>From</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="sm:w-44" /></div>
        <div className="space-y-1.5"><Label>To</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="sm:w-44" /></div>
        <div className="flex-1 space-y-1.5"><Label>Reason (optional)</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Public holiday" /></div>
        <Button onClick={add} disabled={pending}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Add</Button>
      </div>
      <div className="mt-6 space-y-2">
        {closures.length === 0 && <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">No closures scheduled.</p>}
        {closures.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div className="flex items-center gap-3">
              <CalendarOff className="size-4 text-muted-foreground" />
              <div>
                <p className="font-medium">{formatDate(c.startDate)}{formatDate(c.startDate) !== formatDate(c.endDate) ? ` → ${formatDate(c.endDate)}` : ""}</p>
                {c.reason && <p className="text-xs text-muted-foreground">{c.reason}</p>}
              </div>
            </div>
            <Button size="icon-sm" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="size-4" /></Button>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="mb-5">
        <h2 className="font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
function FieldFull({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5 sm:col-span-2"><Label>{label}</Label>{children}</div>;
}
