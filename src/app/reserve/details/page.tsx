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
      <div className="mb-8 text-center">
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Your details</h1>
        <p className="mt-2 text-muted-foreground">Almost done — just a few details to confirm.</p>
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
