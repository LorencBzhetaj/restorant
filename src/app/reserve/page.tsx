import { getRestaurant } from "@/lib/settings";
import { StepDateTime } from "@/components/reserve/step-datetime";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reserve a table" };

export default async function ReservePage() {
  const s = await getRestaurant();
  return <StepDateTime maxParty={s.maxPartySize} />;
}
