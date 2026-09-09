export const dynamic = "force-dynamic";

import { getAllTables, getAreas, getCombinations } from "@/server/data";
import { TablesManager } from "@/components/admin/tables-manager";
import { CombinationsManager } from "@/components/admin/combinations-manager";

export const metadata = { title: "Tables" };

export default async function TablesPage() {
  const [tables, areas, combinations] = await Promise.all([getAllTables(), getAreas(), getCombinations()]);
  return (
    <div className="space-y-6">
      <TablesManager
        areas={areas.map((a) => ({ id: a.id, name: a.name, kind: a.kind }))}
        tables={tables.map((t) => ({
          id: t.id, name: t.name, seats: t.seats, section: t.section,
          areaId: t.areaId, areaName: t.area?.name ?? null, shape: t.shape,
          x: t.x, y: t.y, w: t.w, h: t.h, isActive: t.isActive, reservations: t._count.reservations,
        }))}
      />
      <CombinationsManager
        areas={areas.map((a) => ({ id: a.id, name: a.name, kind: a.kind }))}
        tables={tables.map((t) => ({ id: t.id, name: t.name, seats: t.seats, areaId: t.areaId }))}
        combinations={combinations.map((c) => ({
          id: c.id, name: c.name, areaId: c.areaId, areaName: c.area.name, areaKind: c.area.kind,
          maxSeats: c.maxSeats, minSeats: c.minSeats, priority: c.priority, isActive: c.isActive,
          members: c.members.map((m) => ({ tableId: m.tableId, tableName: m.table.name, seats: m.table.seats })),
        }))}
      />
    </div>
  );
}
