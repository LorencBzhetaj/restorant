import { NextRequest } from "next/server";
import { getAvailableTimes, getTableAvailabilityAt } from "@/lib/availability";
import { json, preflight } from "@/lib/cors";

export async function OPTIONS(req: NextRequest) {
  return preflight(req.headers.get("origin"));
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const time = searchParams.get("time");
  const party = Number(searchParams.get("party") ?? "2");
  const ignore = searchParams.get("ignore") ?? undefined;
  const areaParam = searchParams.get("area");
  const requestedArea = areaParam === "indoor" || areaParam === "outdoor" ? areaParam : "no_preference";

  if (!date) {
    return json({ error: "Missing date" }, origin, 400);
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
      return json({ tables }, origin);
    }
    // Otherwise -> available start times for the party size.
    const slots = await getAvailableTimes({ dateStr: date, partySize: party, requestedArea });
    return json({ slots }, origin);
  } catch {
    return json({ error: "Failed to load availability" }, origin, 500);
  }
}
