import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandMark } from "@/components/site/brand-mark";
import { ReserveStepper } from "@/components/reserve/reserve-stepper";
import { getRestaurant } from "@/lib/settings";

export default async function ReserveLayout({ children }: { children: React.ReactNode }) {
  const s = await getRestaurant();
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/"><BrandMark name={s.name} /></Link>
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="size-4" /> Back to site
          </Link>
        </div>
      </header>
      <div className="border-b border-border bg-background/60 py-6">
        <div className="px-4 sm:px-6"><ReserveStepper /></div>
      </div>
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 md:py-14">{children}</main>
    </div>
  );
}
