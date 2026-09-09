import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { importTableConfig, type TableConfig } from "@/lib/table-import";

let indoorId = "";
let outdoorId = "";

const baseConfig = (): TableConfig => ({
  tables: [
    { name: "I1", area: "indoor", maxSeats: 2 },
    { name: "I2", area: "indoor", maxSeats: 4, shape: "round", x: 2, y: 0, w: 2, h: 2 },
    { name: "O1", area: "outdoor", maxSeats: 4 },
  ],
  combinations: [{ name: "Indoor 2+4", area: "indoor", maxSeats: 6, tables: ["I1", "I2"] }],
  expectedCounts: { indoor: 2, outdoor: 1 },
});

beforeAll(async () => {
  await prisma.reservation.deleteMany();
  await prisma.reservationTable.deleteMany();
  await prisma.tableCombinationMember.deleteMany();
  await prisma.tableCombination.deleteMany();
  await prisma.restaurantTable.deleteMany();
  await prisma.area.deleteMany();
  const indoor = await prisma.area.create({ data: { name: "Indoor", kind: "indoor", isOpen: true } });
  const outdoor = await prisma.area.create({ data: { name: "Outdoor", kind: "outdoor", isOpen: true } });
  indoorId = indoor.id;
  outdoorId = outdoor.id;
});

beforeEach(async () => {
  await prisma.tableCombinationMember.deleteMany();
  await prisma.tableCombination.deleteMany();
  await prisma.reservationTable.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.restaurantTable.deleteMany();
});

describe("table importer", () => {
  it("creates missing tables and combinations, verification passes", async () => {
    const r = await importTableConfig(prisma, baseConfig());
    expect(r.tables.created.sort()).toEqual(["I1", "I2", "O1"]);
    expect(r.combinations.created).toEqual(["Indoor 2+4"]);
    expect(r.conflicts).toHaveLength(0);
    expect(r.verification).toMatchObject({ indoorCount: 2, outdoorCount: 1, ok: true });
    expect(await prisma.restaurantTable.count()).toBe(3);
  });

  it("is idempotent — a second run changes nothing and creates no duplicates", async () => {
    await importTableConfig(prisma, baseConfig());
    const r = await importTableConfig(prisma, baseConfig());
    expect(r.tables.created).toHaveLength(0);
    expect(r.tables.unchanged.sort()).toEqual(["I1", "I2", "O1"]);
    expect(r.combinations.unchanged).toEqual(["Indoor 2+4"]);
    expect(await prisma.restaurantTable.count()).toBe(3);
    expect(await prisma.tableCombination.count()).toBe(1);
  });

  it("updates a matching table when its details change", async () => {
    await importTableConfig(prisma, baseConfig());
    const cfg = baseConfig();
    cfg.tables[0].maxSeats = 3; // I1 2 -> 3
    const r = await importTableConfig(prisma, cfg);
    expect(r.tables.updated).toEqual(["I1"]);
    const i1 = await prisma.restaurantTable.findFirst({ where: { name: "I1", areaId: indoorId } });
    expect(i1?.seats).toBe(3);
    expect(await prisma.restaurantTable.count()).toBe(3); // no duplicate
  });

  it("dry-run reports actions without writing", async () => {
    const r = await importTableConfig(prisma, baseConfig(), { apply: false });
    expect(r.tables.created).toHaveLength(3);
    expect(await prisma.restaurantTable.count()).toBe(0); // nothing written
  });

  it("reports a combination that references an unknown table", async () => {
    const cfg = baseConfig();
    cfg.combinations = [{ name: "Bad", area: "indoor", maxSeats: 6, tables: ["I1", "NOPE"] }];
    const r = await importTableConfig(prisma, cfg);
    expect(r.conflicts.some((c) => /unknown indoor table "NOPE"/.test(c))).toBe(true);
    expect(r.combinations.created).not.toContain("Bad");
    expect(r.verification.ok).toBe(false);
  });

  it("reports a duplicate name in the input", async () => {
    const cfg = baseConfig();
    cfg.tables.push({ name: "I1", area: "indoor", maxSeats: 2 });
    const r = await importTableConfig(prisma, cfg);
    expect(r.conflicts.some((c) => /Duplicate table "I1"/.test(c))).toBe(true);
  });

  it("reports a table name that already exists in a different area", async () => {
    await prisma.restaurantTable.create({ data: { name: "X", seats: 2, section: "X", areaId: outdoorId, x: 0, y: 0, w: 2, h: 2 } });
    const cfg: TableConfig = { tables: [{ name: "X", area: "indoor", maxSeats: 2 }] };
    const r = await importTableConfig(prisma, cfg);
    expect(r.conflicts.some((c) => /also exists in outdoor/.test(c))).toBe(true);
  });

  it("verification fails when expected counts do not match", async () => {
    const cfg = baseConfig();
    cfg.expectedCounts = { indoor: 9, outdoor: 17 }; // real targets, but the test config only has 2/1
    const r = await importTableConfig(prisma, cfg);
    expect(r.verification.ok).toBe(false);
  });

  it("flags duplicate table names present in the database", async () => {
    await prisma.restaurantTable.create({ data: { name: "D", seats: 2, section: "D", areaId: indoorId, x: 0, y: 0, w: 2, h: 2 } });
    await prisma.restaurantTable.create({ data: { name: "D", seats: 2, section: "D", areaId: indoorId, x: 0, y: 0, w: 2, h: 2 } });
    const r = await importTableConfig(prisma, { tables: [{ name: "D", area: "indoor", maxSeats: 2 }] });
    expect(r.verification.duplicateNames).toContain("indoor::D");
    expect(r.verification.ok).toBe(false);
  });
});
