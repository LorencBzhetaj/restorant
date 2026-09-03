import { NextRequest } from "next/server";
import { createReservation } from "@/server/actions";
import { appUrl } from "@/lib/email";
import { json, preflight } from "@/lib/cors";

export async function OPTIONS(req: NextRequest) {
  return preflight(req.headers.get("origin"));
}

/**
 * Create a reservation from an external client (WordPress, custom front end…).
 * Body: { start, partySize, firstName, lastName?, phone, email, notes?, tableId? }
 * `tableId` defaults to "any" (a suitable free table is assigned automatically).
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, origin, 400);
  }

  const res = await createReservation({ tableId: "any", ...body });
  if (!res.ok) return json({ ok: false, error: res.error }, origin, 400);

  return json(
    {
      ok: true,
      reservationId: res.data!.reservationId,
      cancelToken: res.data!.cancelToken,
      manageUrl: `${appUrl()}/r/${res.data!.cancelToken}`,
    },
    origin,
    201,
  );
}
