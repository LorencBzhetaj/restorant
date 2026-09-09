import type { PrismaClient } from "@prisma/client";

/**
 * IDEMPOTENT TABLE / COMBINATION IMPORTER
 * ---------------------------------------
 * Applies a validated configuration of real tables and combinations:
 *   - creates missing tables, updates matching ones (matched by name WITHIN an
 *     area), never deletes anything, never duplicates;
 *   - reports conflicts (duplicate names in the input, a name that already
 *     exists in a different area, unknown areas, bad combination members)
 *     instead of guessing;
 *   - reports every table/combination as created, updated or unchanged;
 *   - verifies the resulting counts and flags duplicate names per area.
 *
 * It NEVER invents data — it only applies what the operator supplied.
 */

export type AreaKind = "indoor" | "outdoor";
export type TableShape = "square" | "round" | "rect";

export interface TableConfigEntry {
  name: string;
  area: AreaKind;
  maxSeats: number; // stored as the table's seat capacity
  minSeats?: number; // accepted for documentation; per-table minimum is not stored
  shape?: TableShape;
  w?: number;
  h?: number;
  x?: number;
  y?: number;
  active?: boolean;
}

export interface CombinationConfigEntry {
  name: string;
  area: AreaKind;
  maxSeats: number;
  minSeats?: number;
  priority?: number;
  active?: boolean;
  tables: string[]; // member table names (must all be in `area`)
}

export interface TableConfig {
  tables: TableConfigEntry[];
  combinations?: CombinationConfigEntry[];
  expectedCounts?: { indoor?: number; outdoor?: number };
}

type Status = "created" | "updated" | "unchanged";

export interface ImportReport {
  tables: Record<Status, string[]>;
  combinations: Record<Status, string[]>;
  conflicts: string[];
  verification: {
    indoorCount: number;
    outdoorCount: number;
    duplicateNames: string[];
    expected?: { indoor?: number; outdoor?: number };
    ok: boolean;
  };
}

const DEFAULTS = { shape: "square" as TableShape, w: 2, h: 2, x: 0, y: 0, active: true };

/**
 * Validate + apply a config. When `apply` is false it only validates and reports
 * conflicts (a dry run). Returns a full report; throws only on a truly malformed
 * config (not on data conflicts, which are reported).
 */
export async function importTableConfig(
  prisma: PrismaClient,
  config: TableConfig,
  opts: { apply?: boolean } = { apply: true },
): Promise<ImportReport> {
  const apply = opts.apply !== false;
  const report: ImportReport = {
    tables: { created: [], updated: [], unchanged: [] },
    combinations: { created: [], updated: [], unchanged: [] },
    conflicts: [],
    verification: { indoorCount: 0, outdoorCount: 0, duplicateNames: [], expected: config.expectedCounts, ok: true },
  };

  const areas = await prisma.area.findMany();
  const areaByKind = new Map<string, { id: string }>();
  for (const a of areas) if (!areaByKind.has(a.kind)) areaByKind.set(a.kind, { id: a.id });

  // Input-side duplicate detection (same name + area appears twice in the file).
  const seen = new Set<string>();
  for (const t of config.tables) {
    const key = `${t.area}::${t.name}`;
    if (seen.has(key)) report.conflicts.push(`Duplicate table "${t.name}" in ${t.area} appears more than once in the config.`);
    seen.add(key);
  }

  const existingTables = await prisma.restaurantTable.findMany({ include: { area: true } });
  const tableIdByAreaName = new Map<string, string>(); // "kind::name" -> id (for combination resolution)
  for (const t of existingTables) if (t.area) tableIdByAreaName.set(`${t.area.kind}::${t.name}`, t.id);

  for (const t of config.tables) {
    const area = areaByKind.get(t.area);
    if (!area) {
      report.conflicts.push(`No "${t.area}" area exists — run the bootstrap first. Skipped table "${t.name}".`);
      continue;
    }
    // A same-named table in a DIFFERENT area is an ambiguity we refuse to guess.
    const elsewhere = existingTables.find((x) => x.name === t.name && x.area?.kind !== t.area);
    if (elsewhere) report.conflicts.push(`Table "${t.name}" also exists in ${elsewhere.area?.kind ?? "another area"} — resolve the name clash.`);

    const desired = {
      name: t.name,
      seats: t.maxSeats,
      section: t.name,
      areaId: area.id,
      shape: t.shape ?? DEFAULTS.shape,
      x: t.x ?? DEFAULTS.x,
      y: t.y ?? DEFAULTS.y,
      w: t.w ?? DEFAULTS.w,
      h: t.h ?? DEFAULTS.h,
      isActive: t.active ?? DEFAULTS.active,
    };

    const existing = existingTables.find((x) => x.name === t.name && x.area?.kind === t.area);
    if (existing) {
      const same =
        existing.seats === desired.seats && existing.shape === desired.shape && existing.x === desired.x &&
        existing.y === desired.y && existing.w === desired.w && existing.h === desired.h && existing.isActive === desired.isActive;
      if (same) {
        report.tables.unchanged.push(t.name);
      } else {
        if (apply) await prisma.restaurantTable.update({ where: { id: existing.id }, data: desired });
        report.tables.updated.push(t.name);
      }
      tableIdByAreaName.set(`${t.area}::${t.name}`, existing.id);
    } else {
      if (apply) {
        const count = await prisma.restaurantTable.count();
        const created = await prisma.restaurantTable.create({ data: { ...desired, sortOrder: count + 1 } });
        tableIdByAreaName.set(`${t.area}::${t.name}`, created.id);
      }
      report.tables.created.push(t.name);
    }
  }

  // Combinations
  for (const c of config.combinations ?? []) {
    const area = areaByKind.get(c.area);
    if (!area) {
      report.conflicts.push(`No "${c.area}" area for combination "${c.name}".`);
      continue;
    }
    if (c.tables.length < 2) {
      report.conflicts.push(`Combination "${c.name}" needs at least two member tables.`);
      continue;
    }
    if (new Set(c.tables).size !== c.tables.length) {
      report.conflicts.push(`Combination "${c.name}" lists a table more than once.`);
      continue;
    }
    const memberIds: string[] = [];
    let bad = false;
    for (const memberName of c.tables) {
      const id = tableIdByAreaName.get(`${c.area}::${memberName}`);
      if (!id) {
        report.conflicts.push(`Combination "${c.name}" references unknown ${c.area} table "${memberName}".`);
        bad = true;
      } else memberIds.push(id);
    }
    if (bad) continue;

    const existing = await prisma.tableCombination.findFirst({ where: { name: c.name, areaId: area.id }, include: { members: true } });
    const desired = { name: c.name, areaId: area.id, maxSeats: c.maxSeats, minSeats: c.minSeats ?? null, priority: c.priority ?? 0, isActive: c.active ?? true };
    if (existing) {
      const sameMembers =
        existing.members.length === memberIds.length && existing.members.every((m) => memberIds.includes(m.tableId));
      const sameFields =
        existing.maxSeats === desired.maxSeats && existing.minSeats === desired.minSeats &&
        existing.priority === desired.priority && existing.isActive === desired.isActive;
      if (sameMembers && sameFields) {
        report.combinations.unchanged.push(c.name);
      } else {
        if (apply) {
          await prisma.tableCombination.update({ where: { id: existing.id }, data: desired });
          await prisma.tableCombinationMember.deleteMany({ where: { combinationId: existing.id } });
          await prisma.tableCombinationMember.createMany({ data: memberIds.map((tableId) => ({ combinationId: existing.id, tableId })) });
        }
        report.combinations.updated.push(c.name);
      }
    } else {
      if (apply) {
        await prisma.tableCombination.create({ data: { ...desired, members: { create: memberIds.map((tableId) => ({ tableId })) } } });
      }
      report.combinations.created.push(c.name);
    }
  }

  // Verification
  const finalTables = await prisma.restaurantTable.findMany({ include: { area: true } });
  report.verification.indoorCount = finalTables.filter((t) => t.area?.kind === "indoor").length;
  report.verification.outdoorCount = finalTables.filter((t) => t.area?.kind === "outdoor").length;
  const byAreaName = new Map<string, number>();
  for (const t of finalTables) {
    const k = `${t.area?.kind ?? "?"}::${t.name}`;
    byAreaName.set(k, (byAreaName.get(k) ?? 0) + 1);
  }
  for (const [k, n] of byAreaName) if (n > 1) report.verification.duplicateNames.push(k);

  const exp = config.expectedCounts;
  report.verification.ok =
    report.conflicts.length === 0 &&
    report.verification.duplicateNames.length === 0 &&
    (exp?.indoor == null || exp.indoor === report.verification.indoorCount) &&
    (exp?.outdoor == null || exp.outdoor === report.verification.outdoorCount);

  return report;
}
