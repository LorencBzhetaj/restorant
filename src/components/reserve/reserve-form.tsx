"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CheckCircle2, Mail, Users, Armchair, CalendarDays, Clock, Loader2, XCircle, Trees, CloudRain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { customerDetailsSchema, type CustomerDetailsInput } from "@/lib/validations";
import { createReservation } from "@/server/actions";

interface Summary {
  tableName: string;
  areaLabel: string;
  dateLabel: string;
  timeLabel: string;
  partyLabel: string;
}

export function ReserveForm({
  tableId,
  start,
  partySize,
  requestedArea,
  outdoor,
  summary,
}: {
  tableId: string;
  start: string;
  partySize: number;
  requestedArea: "indoor" | "outdoor" | "no_preference";
  outdoor: boolean;
  summary: Summary;
}) {
  const [pending, startTransition] = useTransition();
  const [success, setSuccess] = useState<null | { email: string; cancelToken: string }>(null);
  const [agreed, setAgreed] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerDetailsInput>({
    resolver: zodResolver(customerDetailsSchema),
    defaultValues: { firstName: "", lastName: "", phone: "", email: "", notes: "" },
  });

  function onSubmit(values: CustomerDetailsInput) {
    if (!agreed) return;
    startTransition(async () => {
      const res = await createReservation({ ...values, tableId, start, partySize, requestedArea });
      if (res.ok && res.data) setSuccess({ email: res.data.email, cancelToken: res.data.cancelToken });
      else if (!res.ok) toast.error(res.error);
    });
  }

  if (success) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950">
          <CheckCircle2 className="size-9" />
        </div>
        <h1 className="mt-6 font-heading text-3xl font-semibold tracking-tight">Table reserved!</h1>
        <p className="mt-2 text-muted-foreground">We can&apos;t wait to host you.</p>
        <div className="mt-8 rounded-xl border border-border bg-card p-6 text-left">
          <SummaryRows summary={summary} />
        </div>
        <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          <Mail className="size-4" /> Confirmation email sent to {success.email}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          The restaurant has also been notified. Need to cancel? Use the button in your email, or here:
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild variant="outline">
            <Link href={`/r/${success.cancelToken}`}><XCircle className="size-4" /> Manage / cancel</Link>
          </Button>
          <Button asChild><Link href="/reserve">New reservation</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-[1fr_320px]">
      <form onSubmit={handleSubmit(onSubmit)} className="order-2 space-y-5 md:order-1">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="First name" required error={errors.firstName?.message}>
            <Input {...register("firstName")} placeholder="Andi" autoComplete="given-name" />
          </Field>
          <Field label="Last name" error={errors.lastName?.message}>
            <Input {...register("lastName")} placeholder="Hysa" autoComplete="family-name" />
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Phone" required error={errors.phone?.message}>
            <Input {...register("phone")} placeholder="+355 69 123 4567" inputMode="tel" autoComplete="tel" />
          </Field>
          <Field label="Email" required hint="We send your confirmation here" error={errors.email?.message}>
            <Input {...register("email")} placeholder="andi@example.com" type="email" autoComplete="email" />
          </Field>
        </div>
        <Field label="Special requests" hint="Optional" error={errors.notes?.message}>
          <Textarea {...register("notes")} placeholder="Allergies, celebrations, seating preferences…" rows={3} />
        </Field>
        {outdoor && (
          <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            <CloudRain className="mt-0.5 size-4 shrink-0" />
            <span>
              This is an <strong>outdoor</strong> reservation. In case of bad weather we&apos;ll contact you to confirm an indoor
              table. Your confirmation email notes this.
            </span>
          </div>
        )}
        <label className="flex items-start gap-2.5 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 size-4 accent-[var(--brand)]"
          />
          <span>
            I agree to the processing of my details for this reservation, as described in the{" "}
            <Link href="/privacy" target="_blank" className="font-medium text-foreground underline underline-offset-2">
              privacy policy
            </Link>
            .
          </span>
        </label>
        <Button type="submit" size="lg" className="w-full" disabled={pending || !agreed}>
          {pending ? <><Loader2 className="size-4 animate-spin" /> Reserving…</> : "Confirm reservation"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          We hold your table for 15 minutes past the reservation time.
        </p>
      </form>

      <aside className="order-1 md:order-2">
        <div className="rounded-xl border border-border bg-card p-6 md:sticky md:top-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Your reservation</h2>
          <div className="mt-4"><SummaryRows summary={summary} /></div>
        </div>
      </aside>
    </div>
  );
}

function SummaryRows({ summary }: { summary: Summary }) {
  return (
    <dl className="space-y-3 text-sm">
      <Row icon={Armchair} label="Table" value={summary.tableName} />
      <Row icon={Trees} label="Area" value={summary.areaLabel} />
      <Row icon={Users} label="Guests" value={summary.partyLabel} />
      <Row icon={CalendarDays} label="Date" value={summary.dateLabel} />
      <Row icon={Clock} label="Time" value={summary.timeLabel} />
    </dl>
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

function Field({ label, required, hint, error, children }: { label: string; required?: boolean; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-sm">{label} {required && <span className="text-destructive">*</span>}</Label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
