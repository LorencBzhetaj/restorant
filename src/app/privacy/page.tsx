import Link from "next/link";
import { BrandMark } from "@/components/site/brand-mark";
import { getRestaurant } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Privacy Policy" };

export default async function PrivacyPage() {
  const s = await getRestaurant();
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-4 sm:px-6">
          <Link href="/reserve"><BrandMark name={s.name} /></Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <article className="prose-sm space-y-4 text-sm leading-relaxed text-foreground">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Privacy Policy</h1>
          <p className="text-muted-foreground">How {s.name} handles the details you provide when booking a table.</p>

          <h2 className="pt-2 font-heading text-lg font-semibold">What we collect</h2>
          <p>When you make a reservation we collect your name, phone number, email address and any notes you add (e.g. dietary requirements). We also record the date, time and size of your reservation.</p>

          <h2 className="pt-2 font-heading text-lg font-semibold">Why we use it</h2>
          <p>Your details are used only to manage your reservation — to confirm it, send you a confirmation and any changes/cancellations by email, prepare your table, and contact you if needed. We do not sell your data or use it for advertising.</p>

          <h2 className="pt-2 font-heading text-lg font-semibold">Email</h2>
          <p>A confirmation email is sent to you and to the restaurant. It includes a one-click link that lets you cancel your reservation at any time.</p>

          <h2 className="pt-2 font-heading text-lg font-semibold">Retention</h2>
          <p>Reservation records are kept to manage bookings and returning-guest history. You can ask us to delete your data at any time.</p>

          <h2 className="pt-2 font-heading text-lg font-semibold">Your rights</h2>
          <p>You may request access to, correction of, or deletion of your personal data. Contact us{ s.email ? <> at <a className="underline" href={`mailto:${s.email}`}>{s.email}</a></> : null }{ s.phone ? <> or {s.phone}</> : null }.</p>

          <p className="pt-4 text-muted-foreground">{ s.address }</p>
          <p className="pt-6">
            <Link href="/reserve" className="font-medium text-brand underline underline-offset-2">← Back to booking</Link>
          </p>
        </article>
      </main>
    </div>
  );
}
