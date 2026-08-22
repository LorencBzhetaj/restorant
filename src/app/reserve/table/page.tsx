import { redirect } from "next/navigation";
import { getActiveTables } from "@/server/data";
import { StepTable } from "@/components/reserve/step-table";

export const metadata = { title: "Choose your table" };

export default async function ReserveTablePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; party?: string; time?: string; start?: string }>;
}) {
  const { date, party, time, start } = await searchParams;
  if (!date || !party || !time || !start) redirect("/reserve");

  const tables = await getActiveTables();

  return (
    <StepTable
      tables={tables.map((t) => ({
        id: t.id,
        name: t.name,
        seats: t.seats,
        section: t.section,
        shape: t.shape,
        x: t.x,
        y: t.y,
        w: t.w,
        h: t.h,
      }))}
      date={date}
      party={Number(party)}
      time={time}
      start={start}
    />
  );
}
