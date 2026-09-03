import Link from "next/link";
import { BrandMark } from "@/components/site/brand-mark";
import { ReserveStepper } from "@/components/reserve/reserve-stepper";
import { EmbedResizer } from "@/components/reserve/embed-resizer";
import { getRestaurant } from "@/lib/settings";

export default async function ReserveLayout({ children }: { children: React.ReactNode }) {
  const s = await getRestaurant();
  return (
    <div className="min-h-screen bg-muted/30">
      <EmbedResizer />
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-center px-4 sm:px-6">
          <Link href="/reserve"><BrandMark name={s.name} /></Link>
        </div>
      </header>
      <div className="border-b border-border bg-background/60 py-6">
        <div className="px-4 sm:px-6"><ReserveStepper /></div>
      </div>
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 md:py-14">{children}</main>
    </div>
  );
}
