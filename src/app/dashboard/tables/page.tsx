export const dynamic = "force-dynamic";

import { getAllTables, getAreas } from "@/server/data";
import { TablesManager } from "@/components/admin/tables-manager";

export const metadata = { title: "Tables" };

export default async function TablesPage() {
  const [tables, areas] = await Promise.all([getAllTables(), getAreas()]);
  return (
    <TablesManager
      areas={areas.map((a) => ({ id: a.id, name: a.name, kind: a.kind }))}
      tables={tables.map((t) => ({
        id: t.id, name: t.name, seats: t.seats, section: t.section,
        areaId: t.areaId, areaName: t.area?.name ?? null, shape: t.shape,
        x: t.x, y: t.y, w: t.w, h: t.h, isActive: t.isActive, reservations: t._count.reservations,
      }))}
    />
  );
}
