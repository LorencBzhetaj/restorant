import { vi, describe, it, expect, beforeAll } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/require-admin", () => ({ isAdmin: async () => true }));

import { prisma } from "@/lib/prisma";
import { getAvailableTimes } from "@/lib/availability";
import { saveFloorLayout } from "@/server/actions";

const T: Record<string, string> = {};

function futureDate(offset: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

beforeAll(async () => {
  await prisma.notification.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.tableCombinationMember.deleteMany();
  await prisma.tableCombination.deleteMany();
  await prisma.reservationTable.deleteMany();
  await prisma.areaClosure.deleteMany();
  await prisma.slotLimit.deleteMany();
  await prisma.openingHour.deleteMany();
  await prisma.closure.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.restaurantTable.deleteMany();
  await prisma.area.deleteMany();
  await prisma.restaurantSetting.deleteMany();

  await prisma.restaurantSetting.create({
    data: { name: "Test", email: "o@test.local", currency: "EUR", turnDurationMinutes: 120, bookingInterval: 30, seatingBuffer: 15, maxPartySize: 12, maxReservationsPerSlot: 0, maxCoversPerSlot: 0 },
  });
  for (let dow = 0; dow < 7; dow++) {
    await prisma.openingHour.create({ data: { dayOfWeek: dow, startTime: "18:00", endTime: "23:00" } });
  }
  const indoor = await prisma.area.create({ data: { name: "Indoor", kind: "indoor", isOpen: true, priority: 1 } });
  for (const [name, sort] of [["A", 1], ["B", 2]] as const) {
    const t = await prisma.restaurantTable.create({ data: { name, seats: 4, section: name, areaId: indoor.id, x: sort, y: 0, w: 2, h: 2, sortOrder: sort } });
    T[name] = t.id;
  }
});

describe("floor layout editor (saveFloorLayout)", () => {
  it("rejects a table that extends past the canvas edge", async () => {
    const res = await saveFloorLayout({ tables: [{ id: T.A, x: 11, y: 0, w: 2, h: 2, shape: "square", rotation: 0 }] });
    expect(res.ok).toBe(false); // x(11) + w(2) = 13 > 12
  });

  it("rejects an invalid rotation", async () => {
    const res = await saveFloorLayout({ tables: [{ id: T.A, x: 0, y: 0, w: 2, h: 2, shape: "square", rotation: 45 }] });
    expect(res.ok).toBe(false);
  });

  it("rejects an unknown table id", async () => {
    const res = await saveFloorLayout({ tables: [{ id: "does-not-exist", x: 0, y: 0, w: 2, h: 2, shape: "square", rotation: 0 }] });
    expect(res.ok).toBe(false);
  });

  it("persists a valid layout (position, size, shape, rotation)", async () => {
    const res = await saveFloorLayout({
      tables: [
        { id: T.A, x: 3, y: 4, w: 3, h: 2, shape: "round", rotation: 90 },
        { id: T.B, x: 6, y: 1, w: 2, h: 2, shape: "rect", rotation: 270 },
      ],
    });
    expect(res.ok).toBe(true);
    const a = await prisma.restaurantTable.findUnique({ where: { id: T.A } });
    expect({ x: a!.x, y: a!.y, w: a!.w, h: a!.h, shape: a!.shape, rotation: a!.rotation }).toEqual({ x: 3, y: 4, w: 3, h: 2, shape: "round", rotation: 90 });
  });

  it("moving shapes (even overlapping) does NOT change availability", async () => {
    const date = futureDate(3);
    const before = await getAvailableTimes({ dateStr: date, partySize: 2, requestedArea: "indoor" });
    // deliberately stack both tables on the exact same cell — visual overlap only
    const res = await saveFloorLayout({
      tables: [
        { id: T.A, x: 0, y: 0, w: 2, h: 2, shape: "square", rotation: 0 },
        { id: T.B, x: 0, y: 0, w: 2, h: 2, shape: "square", rotation: 0 },
      ],
    });
    expect(res.ok).toBe(true);
    const after = await getAvailableTimes({ dateStr: date, partySize: 2, requestedArea: "indoor" });
    expect(after.length).toBe(before.length);
    expect(after[0]?.freeTables).toBe(before[0]?.freeTables); // both tables still bookable
  });
});
