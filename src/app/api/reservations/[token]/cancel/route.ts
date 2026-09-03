import { NextRequest } from "next/server";
import { cancelReservationByToken } from "@/server/actions";
import { json, preflight } from "@/lib/cors";

export async function OPTIONS(req: NextRequest) {
  return preflight(req.headers.get("origin"));
}

/** Cancel a reservation by its token (the link used in the guest email). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const origin = req.headers.get("origin");
  const { token } = await params;
  const res = await cancelReservationByToken(token);
  if (!res.ok) return json({ ok: false, error: res.error }, origin, 400);
  return json({ ok: true }, origin);
}
