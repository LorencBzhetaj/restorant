export const dynamic = "force-dynamic";

import { getReservations, getActiveTables } from "@/server/data";
import { ReservationsManager } from "@/components/admin/reservations-manager";
import type { AdminReservation } from "@/components/admin/reservation-detail";

export const metadata = { title: "Reservations" };

export default async function ReservationsPage() {
  const [reservations, tables] = await Promise.all([getReservations(), getActiveTables()]);

  const mapped: AdminReservation[] = reservations.map((r) => ({
    id: r.id,
    start: r.startDateTime.toISOString(),
    status: r.status,
    partySize: r.partySize,
    source: r.source,
    notes: r.notes,
    tableId: r.tableId,
    tableName: r.table.name,
    tableSection: r.table.section,
    customerName: `${r.customer.firstName} ${r.customer.lastName}`,
    customerPhone: r.customer.phone,
    notifications: r.notifications.map((n) => ({ id: n.id, type: n.type, status: n.status })),
  }));

  return (
    <ReservationsManager
      reservations={mapped}
      tables={tables.map((t) => ({ id: t.id, name: t.name, seats: t.seats, section: t.section }))}
    />
  );
}
