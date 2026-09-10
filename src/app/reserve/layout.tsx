import Link from "next/link";
import { MapPin } from "lucide-react";
import { BrandMark } from "@/components/site/brand-mark";
import { ReserveStepper } from "@/components/reserve/reserve-stepper";
import { EmbedResizer } from "@/components/reserve/embed-resizer";
import { getRestaurant } from "@/lib/settings";
import { BUNDLED_LOGO_PATH } from "@/lib/branding";

export default async function ReserveLayout({ children }: { children: React.ReactNode }) {
  const s = await getRestaurant();
  const mapsHref = s.address
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(s.address)}`
    : null;
  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <EmbedResizer />
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-center px-4 sm:px-6">
          <Link href="/reserve"><BrandMark name={s.name} logoUrl={s.logoUrl ?? BUNDLED_LOGO_PATH} /></Link>
        </div>
      </header>
      <div className="border-b border-border bg-background/60 py-6">
        <div className="px-4 sm:px-6"><ReserveStepper /></div>
      </div>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 md:py-14">{children}</main>
      {s.address && (
        <footer className="border-t border-border bg-background">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-1.5 px-4 py-6 text-center text-sm text-muted-foreground sm:px-6">
            <a
              href={mapsHref!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-foreground transition-colors hover:text-brand"
            >
              <MapPin className="size-4 text-brand" /> {s.address}
            </a>
            {s.phone && <span>{s.phone}</span>}
          </div>
        </footer>
      )}
    </div>
  );
}
