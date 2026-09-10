import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDateLong, formatTime } from "@/lib/format";
import { ReserveForm } from "@/components/reserve/reserve-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your details" };

export default async function ReserveDetailsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; party?: string; start?: string; tableId?: string; time?: string; area?: string }>;
}) {
  const { party, start, tableId, area } = await searchParams;
  if (!party || !start || !tableId) redirect("/reserve");

  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) redirect("/reserve");

  const table = tableId === "any" ? null : await prisma.restaurantTable.findUnique({ where: { id: tableId } });
  const partySize = Number(party);
  const requestedArea = area === "indoor" || area === "outdoor" ? area : "no_preference";
  const areaLabel = requestedArea === "indoor" ? "Indoor" : requestedArea === "outdoor" ? "Outdoor" : "No preference";

  return (
    <div>
      <div className="mb-10 text-center">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-brand">Almost there</p>
        <h1 className="font-heading text-4xl font-medium tracking-tight sm:text-[2.75rem] sm:leading-[1.05]">Your details</h1>
        <p className="mt-3 text-[15px] text-muted-foreground">Just a few details to confirm your table.</p>
        <span className="mx-auto mt-5 block h-px w-16 bg-gradient-to-r from-transparent via-brand/50 to-transparent" />
      </div>
      <ReserveForm
        tableId={tableId}
        start={start}
        partySize={partySize}
        requestedArea={requestedArea}
        outdoor={requestedArea === "outdoor"}
        summary={{
          tableName: table ? `${table.name} · ${table.section}` : "Assigned for you",
          areaLabel,
          dateLabel: formatDateLong(startDate),
          timeLabel: formatTime(startDate),
          partyLabel: `${partySize} ${partySize === 1 ? "guest" : "guests"}`,
        }}
      />
    </div>
  );
}
