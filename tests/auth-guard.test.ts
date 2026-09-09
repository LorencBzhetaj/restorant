import { vi, describe, it, expect, beforeEach } from "vitest";

// Simulate an UNAUTHENTICATED caller — every admin-only server action must refuse.
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/require-admin", () => ({ isAdmin: async () => false }));

import { prisma } from "@/lib/prisma";
import {
  updateSettings, addArea, deleteArea, toggleAreaOpen, upsertTable, toggleTableActive,
  addOpeningHour, deleteOpeningHour, addClosure, deleteClosure, addSlotLimit, deleteSlotLimit,
  updateCustomerNotes, setReservationStatus, rescheduleReservation, createWalkIn,
  addCombination, updateCombination, toggleCombination, deleteCombination,
  saveFloorLayout, addAreaClosure, updateAreaClosure, deleteAreaClosure,
} from "@/server/actions";

async function expectUnauthorized(p: Promise<{ ok: boolean; error?: string }>) {
  const res = await p;
  expect(res.ok).toBe(false);
  expect(res.error).toMatch(/unauthorized/i);
}

beforeEach(async () => {
  await prisma.area.deleteMany();
  await prisma.restaurantSetting.deleteMany();
  await prisma.slotLimit.deleteMany();
  await prisma.openingHour.deleteMany();
  await prisma.closure.deleteMany();
});

describe("admin action authorization", () => {
  it("rejects every admin-only action for an unauthenticated caller", async () => {
    await expectUnauthorized(updateSettings({}));
    await expectUnauthorized(addArea({ name: "X", kind: "indoor" }));
    await expectUnauthorized(deleteArea("x"));
    await expectUnauthorized(toggleAreaOpen("x", false));
    await expectUnauthorized(upsertTable(null, {}));
    await expectUnauthorized(toggleTableActive("x", false));
    await expectUnauthorized(addOpeningHour({ dayOfWeek: 1, startTime: "12:00", endTime: "15:00" }));
    await expectUnauthorized(deleteOpeningHour("x"));
    await expectUnauthorized(addClosure({ startDate: "2026-01-01", endDate: "2026-01-02" }));
    await expectUnauthorized(deleteClosure("x"));
    await expectUnauthorized(addSlotLimit({ dayOfWeek: -1, time: "18:00", areaKind: "global", maxReservations: 4 }));
    await expectUnauthorized(deleteSlotLimit("x"));
    await expectUnauthorized(updateCustomerNotes("x", "note"));
    await expectUnauthorized(setReservationStatus("x", "Cancelled"));
    await expectUnauthorized(rescheduleReservation("x", new Date().toISOString()));
    await expectUnauthorized(createWalkIn({}));
    await expectUnauthorized(addCombination({}));
    await expectUnauthorized(updateCombination("x", {}));
    await expectUnauthorized(toggleCombination("x", false));
    await expectUnauthorized(deleteCombination("x"));
    await expectUnauthorized(saveFloorLayout({ tables: [] }));
    await expectUnauthorized(addAreaClosure({}));
    await expectUnauthorized(updateAreaClosure("x", {}));
    await expectUnauthorized(deleteAreaClosure("x"));
  });

  it("writes nothing when unauthorized (guard runs before any DB write)", async () => {
    await addArea({ name: "Sneaky", kind: "indoor" });
    await addSlotLimit({ dayOfWeek: -1, time: "18:00", areaKind: "global", maxReservations: 99 });
    await updateSettings({ name: "Hacked", currency: "EUR", turnDurationMinutes: 120, bookingInterval: 30, seatingBuffer: 15, maxPartySize: 12, maxReservationsPerSlot: 0, maxCoversPerSlot: 0 });
    expect(await prisma.area.count()).toBe(0);
    expect(await prisma.slotLimit.count()).toBe(0);
    expect(await prisma.restaurantSetting.count()).toBe(0);
  });
});
