export const dynamic = "force-dynamic";

import { getAllTables, getAreas, getCombinations } from "@/server/data";
import { FloorEditor } from "@/components/admin/floor-editor";

export const metadata = { title: "Edit floor layout" };

export default async function FloorEditPage() {
  const [tables, areas, combinations] = await Promise.all([getAllTables(), getAreas(), getCombinations()]);
  return (
    <FloorEditor
      tables={tables.map((t) => ({
        id: t.id, name: t.name, seats: t.seats, areaId: t.areaId,
        areaName: t.area?.name ?? null, areaKind: t.area?.kind ?? null,
        shape: t.shape, x: t.x, y: t.y, w: t.w, h: t.h, rotation: t.rotation, isActive: t.isActive,
      }))}
      areas={areas.map((a) => ({ id: a.id, name: a.name, kind: a.kind }))}
      combinations={combinations.map((c) => ({ id: c.id, name: c.name, areaId: c.areaId, memberTableIds: c.members.map((m) => m.tableId) }))}
    />
  );
}
