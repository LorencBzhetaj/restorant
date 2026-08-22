export const dynamic = "force-dynamic";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, UtensilsCrossed, Leaf, Wine, Clock, MapPin, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getRestaurant } from "@/lib/settings";

const DISHES = [
  { img: "/images/dishes/1.jpg", name: "Garden Burrata", desc: "Heirloom tomatoes, basil oil, aged balsamic.", price: "€9" },
  { img: "/images/dishes/2.jpg", name: "Wood-fired Pizza", desc: "San Marzano, fior di latte, fresh basil.", price: "€12" },
  { img: "/images/dishes/3.jpg", name: "Chef's Tasting Plate", desc: "A rotating selection of the day's best.", price: "€24" },
];

const ABOUT = [
  { icon: Leaf, title: "Seasonal & local", body: "Ingredients sourced daily from Albanian farms and the Adriatic coast." },
  { icon: UtensilsCrossed, title: "Open kitchen", body: "Watch our chefs at work over the wood-fired grill." },
  { icon: Wine, title: "Curated cellar", body: "A hand-picked list of regional and Mediterranean wines." },
];

const GALLERY = ["/images/gallery/1.jpg", "/images/gallery/2.jpg", "/images/gallery/3.jpg", "/images/gallery/4.jpg", "/images/gallery/5.jpg", "/images/gallery/6.jpg"];

export default async function HomePage() {
  const s = await getRestaurant();

  return (
    <>
      {/* Hero */}
      <section className="relative isolate -mt-16 overflow-hidden bg-sidebar text-white">
        <Image src="/images/hero.jpg" alt={s.name} fill priority className="object-cover object-center opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-t from-sidebar via-sidebar/70 to-sidebar/50" />
        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-32 sm:px-6 md:pb-32 md:pt-44">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-brand">
              <UtensilsCrossed className="size-3.5" /> Mediterranean · Tirana
            </span>
            <h1 className="mt-6 font-heading text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
              A table waiting
              <br />
              <span className="text-brand">just for you.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/70">
              {s.tagline ?? "Modern Mediterranean dining in the heart of Tirana."} Reserve your table
              in under a minute — pick your spot on our floor plan.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 px-7 text-base">
                <Link href="/reserve">Reserve a table <ArrowRight className="size-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 border-white/20 bg-white/5 px-7 text-base text-white hover:bg-white/10 hover:text-white">
                <Link href="#menu">View the menu</Link>
              </Button>
            </div>
            <dl className="mt-14 grid max-w-md grid-cols-3 gap-6 border-t border-white/10 pt-8">
              {[{ n: "Est. 2016", l: "Family run" }, { n: "4.8", l: "Google rating" }, { n: "7 days", l: "Open weekly" }].map((x) => (
                <div key={x.l}>
                  <dt className="font-heading text-2xl font-semibold text-white">{x.n}</dt>
                  <dd className="mt-1 text-xs uppercase tracking-wider text-white/50">{x.l}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* Menu highlights */}
      <section id="menu" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6 md:py-28">
        <SectionHeading eyebrow="From the kitchen" title="Signature plates" subtitle="A taste of what's waiting. Our full menu changes with the season." />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {DISHES.map((d) => (
            <div key={d.name} className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="relative aspect-[6/5] overflow-hidden bg-muted">
                <Image src={d.img} alt={d.name} fill className="object-cover transition-transform duration-500 hover:scale-105" />
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{d.name}</h3>
                  <span className="font-heading text-lg font-semibold text-brand">{d.price}</span>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{d.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* About */}
      <section id="about" className="scroll-mt-20 bg-muted/40 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading eyebrow="Our story" title="Cooking with the seasons" />
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {ABOUT.map((a) => (
              <div key={a.title} className="rounded-xl border border-border bg-card p-6">
                <div className="grid size-11 place-items-center rounded-lg bg-brand/10 text-brand">
                  <a.icon className="size-5" />
                </div>
                <h3 className="mt-5 font-semibold">{a.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section id="gallery" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6 md:py-28">
        <SectionHeading eyebrow="The room" title="A look inside" />
        <div className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-3">
          {GALLERY.map((src, i) => (
            <div key={src} className={`relative overflow-hidden rounded-xl bg-muted ${i === 0 ? "col-span-2 row-span-2 aspect-square md:aspect-auto" : "aspect-square"}`}>
              <Image src={src} alt={s.name} fill className="object-cover transition-transform duration-500 hover:scale-105" />
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative isolate overflow-hidden bg-sidebar text-white">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 md:py-24">
          <Star className="mx-auto size-6 text-brand" />
          <h2 className="mt-5 font-heading text-4xl font-semibold tracking-tight sm:text-5xl">Join us for dinner</h2>
          <p className="mx-auto mt-4 max-w-md text-white/60">
            Pick your table on our floor plan and reserve in seconds.
          </p>
          <Button asChild size="lg" className="mt-8 h-12 px-8 text-base">
            <Link href="/reserve">Reserve a table <ArrowRight className="size-4" /></Link>
          </Button>
          <div className="mt-10 flex flex-col items-center justify-center gap-2 text-sm text-white/50 sm:flex-row sm:gap-6">
            <span className="inline-flex items-center gap-1.5"><MapPin className="size-4 text-brand" /> {s.address}</span>
            <span className="inline-flex items-center gap-1.5"><Clock className="size-4 text-brand" /> Lunch & dinner, 7 days</span>
          </div>
        </div>
      </section>
    </>
  );
}

function SectionHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="max-w-2xl">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">{eyebrow}</span>
      <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      {subtitle && <p className="mt-3 text-base leading-relaxed text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
