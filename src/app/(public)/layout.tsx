import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { getRestaurant } from "@/lib/settings";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const s = await getRestaurant();
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader name={s.name} />
      <main className="flex-1">{children}</main>
      <SiteFooter name={s.name} phone={s.phone} address={s.address} email={s.email} tagline={s.tagline} />
    </div>
  );
}
