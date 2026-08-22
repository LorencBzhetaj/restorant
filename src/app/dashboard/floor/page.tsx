export const dynamic = "force-dynamic";

import { getReservations, getActiveTables, getRestaurant } from "@/server/data";
import { FloorView } from "@/components/admin/floor-view";
import type { AdminReservation } from "@/components/admin/reservation-detail";

export const metadata = { title: "Floor plan" };

export default async function FloorPage() {
  const [reservations, tables, settings] = await Promise.all([
    getReservations(),
    getActiveTables(),
    getRestaurant(),
  ]);

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
    <FloorView
      tables={tables.map((t) => ({ id: t.id, name: t.name, seats: t.seats, section: t.section, shape: t.shape, x: t.x, y: t.y, w: t.w, h: t.h }))}
      reservations={mapped}
      turnMinutes={settings.turnDurationMinutes}
    />
  );
}
