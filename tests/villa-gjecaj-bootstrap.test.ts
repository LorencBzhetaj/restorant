import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { bootstrapVillaGjecaj, VILLA_GJECAJ_PEAK_MAX } from "@/lib/villa-gjecaj-bootstrap";

// The bootstrap is idempotent and non-destructive. These tests exercise it
// against the isolated Docker Postgres test DB.

async function fullClean() {
  await prisma.notification.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.areaClosure.deleteMany();
  await prisma.restaurantTable.deleteMany();
  await prisma.area.deleteMany();
  await prisma.slotLimit.deleteMany();
}

function globalPeakWhere() {
  return { time: "18:00", areaKind: null, dayOfWeek: null } as const;
}

beforeEach(fullClean);

describe("villa-gjecaj bootstrap", () => {
  it("1. first execution creates both areas and the 18:00 global cap", async () => {
    const actions = await bootstrapVillaGjecaj(prisma);

    // every record reported as created
    expect(actions.every((a) => a.status === "created")).toBe(true);
    expect(actions).toHaveLength(3);

    const indoor = await prisma.area.findMany({ where: { kind: "indoor" } });
    const outdoor = await prisma.area.findMany({ where: { kind: "outdoor" } });
    expect(indoor).toHaveLength(1);
    expect(outdoor).toHaveLength(1);
    expect(indoor[0].name).toBe("Indoor");
    expect(outdoor[0].name).toBe("Outdoor");

    const limit = await prisma.slotLimit.findFirst({ where: globalPeakWhere() });
    expect(limit?.maxReservations).toBe(VILLA_GJECAJ_PEAK_MAX);
  });

  it("2. second execution is a no-op — no duplicates", async () => {
    await bootstrapVillaGjecaj(prisma);
    const second = await bootstrapVillaGjecaj(prisma);

    // nothing changed on the second run
    expect(second.every((a) => a.status === "already-correct")).toBe(true);

    // exactly one of each, still
    expect(await prisma.area.count({ where: { kind: "indoor" } })).toBe(1);
    expect(await prisma.area.count({ where: { kind: "outdoor" } })).toBe(1);
    expect(await prisma.slotLimit.count({ where: globalPeakWhere() })).toBe(1);
    expect(await prisma.slotLimit.count()).toBe(1);
  });

  it("3. corrects the 18:00 value when it differs, without duplicating", async () => {
    // pre-existing global 18:00 rule with the WRONG cap
    await prisma.slotLimit.create({
      data: { time: "18:00", areaKind: null, dayOfWeek: null, maxReservations: 2 },
    });

    const actions = await bootstrapVillaGjecaj(prisma);
    const limitAction = actions.find((a) => a.record.startsWith("SlotLimit 18:00"));
    expect(limitAction?.status).toBe("updated");

    const limits = await prisma.slotLimit.findMany({ where: globalPeakWhere() });
    expect(limits).toHaveLength(1); // corrected in place, not duplicated
    expect(limits[0].maxReservations).toBe(VILLA_GJECAJ_PEAK_MAX);
  });

  it("3b. refuses (throws) when duplicate global 18:00 rows exist — never updates only one", async () => {
    // Two conflicting global 18:00 rows, both wrong.
    await prisma.slotLimit.create({ data: { time: "18:00", areaKind: null, dayOfWeek: null, maxReservations: 2 } });
    await prisma.slotLimit.create({ data: { time: "18:00", areaKind: null, dayOfWeek: null, maxReservations: 8 } });

    await expect(bootstrapVillaGjecaj(prisma)).rejects.toThrow(/duplicate global 18:00/i);

    // both rows are untouched — neither silently updated to 4
    const rows = await prisma.slotLimit.findMany({ where: globalPeakWhere(), orderBy: { maxReservations: "asc" } });
    expect(rows.map((r) => r.maxReservations)).toEqual([2, 8]);
  });

  it("4. preserves unrelated areas and slot limits", async () => {
    // an indoor area under a custom name — must be kept, not renamed or duplicated
    await prisma.area.create({ data: { name: "Sala", kind: "indoor" } });
    // unrelated slot limits: a different time, and an area-specific 18:00 rule
    await prisma.slotLimit.create({ data: { time: "20:00", areaKind: null, dayOfWeek: null, maxReservations: 6 } });
    await prisma.slotLimit.create({ data: { time: "18:00", areaKind: "indoor", dayOfWeek: null, maxReservations: 3 } });

    const actions = await bootstrapVillaGjecaj(prisma);

    // existing indoor area kept as-is (matched by kind), only outdoor created
    const indoor = await prisma.area.findMany({ where: { kind: "indoor" } });
    expect(indoor).toHaveLength(1);
    expect(indoor[0].name).toBe("Sala");
    expect(actions.find((a) => a.record === "Area (indoor)")?.status).toBe("already-correct");
    expect(actions.find((a) => a.record === "Area (outdoor)")?.status).toBe("created");

    // unrelated limits untouched
    const twenty = await prisma.slotLimit.findFirst({ where: { time: "20:00", areaKind: null, dayOfWeek: null } });
    expect(twenty?.maxReservations).toBe(6);
    const indoorPeak = await prisma.slotLimit.findFirst({ where: { time: "18:00", areaKind: "indoor", dayOfWeek: null } });
    expect(indoorPeak?.maxReservations).toBe(3);

    // the new global 18:00 rule was created alongside them
    const globalPeak = await prisma.slotLimit.findFirst({ where: globalPeakWhere() });
    expect(globalPeak?.maxReservations).toBe(VILLA_GJECAJ_PEAK_MAX);
  });
});
