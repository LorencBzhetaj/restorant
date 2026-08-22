import { NextRequest, NextResponse } from "next/server";
import { getAvailableTimes, getTableAvailabilityAt } from "@/lib/availability";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const time = searchParams.get("time");
  const party = Number(searchParams.get("party") ?? "2");
  const ignore = searchParams.get("ignore") ?? undefined;

  if (!date) {
    return NextResponse.json({ error: "Missing date" }, { status: 400 });
  }

  try {
    // With a time -> per-table statuses for the floor map.
    if (time) {
      const tables = await getTableAvailabilityAt({
        dateStr: date,
        time,
        partySize: party,
        ignoreReservationId: ignore,
      });
      return NextResponse.json({ tables });
    }
    // Otherwise -> available start times for the party size.
    const slots = await getAvailableTimes({ dateStr: date, partySize: party });
    return NextResponse.json({ slots });
  } catch {
    return NextResponse.json({ error: "Failed to load availability" }, { status: 500 });
  }
}
