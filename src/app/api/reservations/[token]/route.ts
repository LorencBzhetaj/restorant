import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { json, preflight } from "@/lib/cors";

export async function OPTIONS(req: NextRequest) {
  return preflight(req.headers.get("origin"));
}

/** Read a reservation by its cancel token (public-safe fields). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const origin = req.headers.get("origin");
  const { token } = await params;
  const r = await prisma.reservation.findUnique({
    where: { cancelToken: token },
    include: { table: true, customer: true },
  });
  if (!r) return json({ ok: false, error: "Not found" }, origin, 404);

  return json(
    {
      ok: true,
      reservation: {
        status: r.status,
        partySize: r.partySize,
        start: r.startDateTime.toISOString(),
        table: `${r.table.name} · ${r.table.section}`,
        guestName: `${r.customer.firstName} ${r.customer.lastName}`.trim(),
        cancellable: r.status === "Confirmed" || r.status === "Seated",
      },
    },
    origin,
  );
}
