import { getRestaurant } from "@/lib/settings";
import { getAreas } from "@/lib/availability";
import { StepDateTime } from "@/components/reserve/step-datetime";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reserve a table" };

export default async function ReservePage() {
  const [s, areas] = await Promise.all([getRestaurant(), getAreas()]);
  const hasIndoor = areas.some((a) => a.isOpen && a.kind === "indoor");
  const hasOutdoor = areas.some((a) => a.isOpen && a.kind === "outdoor");
  return <StepDateTime maxParty={s.maxPartySize} hasIndoor={hasIndoor} hasOutdoor={hasOutdoor} />;
}
