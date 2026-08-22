export const dynamic = "force-dynamic";

import { getAllTables } from "@/server/data";
import { TablesManager } from "@/components/admin/tables-manager";

export const metadata = { title: "Tables" };

export default async function TablesPage() {
  const tables = await getAllTables();
  return (
    <TablesManager
      tables={tables.map((t) => ({
        id: t.id, name: t.name, seats: t.seats, section: t.section, shape: t.shape,
        x: t.x, y: t.y, w: t.w, h: t.h, isActive: t.isActive, reservations: t._count.reservations,
      }))}
    />
  );
}
