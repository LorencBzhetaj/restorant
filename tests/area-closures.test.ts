import { vi, describe, it, expect, beforeAll, beforeEach } from "vitest";

// --- mocks so server actions run outside the Next runtime ---
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/require-admin", () => ({ isAdmin: async () => true }));

const sentEmails: { to: string; subject: string; html: string; text: string }[] = [];
vi.mock("@/lib/email", () => ({
  isEmailConfigured: () => true,
  appUrl: () => "http://localhost:3000",
  sendEmail: async (msg: { to: string; subject: string; html: string; text: string }) => {
    sentEmails.push(msg);
    return { delivered: true, demo: false };
  },
}));

import { prisma } from "@/lib/prisma";
import { getAvailableTimes, getTableAvailabilityAt } from "@/lib/availability";
import {
  createReservation,
  rescheduleReservation,
  addAreaClosure,
  deleteAreaClosure,
  addSlotLimit,
} from "@/server/actions";
import { getClosuresOverview } from "@/server/data";

// ---- fixtures ----
const TURN = 120;
let outdoorId = "";
let indoorTableIds: string[] = [];
let outdoorTableIds: string[] = [];

function futureDate(offsetDays: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function startISO(dateStr: string, time: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, mn] = time.split(":").map(Number);
  return new Date(y, m - 1, d, h, mn, 0, 0).toISOString();
}

async function wipeTransactional() {
  await prisma.notification.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.areaClosure.deleteMany();
  await prisma.slotLimit.deleteMany();
  await prisma.customer.deleteMany();
  sentEmails.length = 0;
}

beforeAll(async () => {
  // Clean slate
  await prisma.notification.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.areaClosure.deleteMany();
  await prisma.slotLimit.deleteMany();
  await prisma.openingHour.deleteMany();
  await prisma.closure.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.restaurantTable.deleteMany();
  await prisma.area.deleteMany();
  await prisma.restaurantSetting.deleteMany();

  await prisma.restaurantSetting.create({
    data: {
      name: "Test Restaurant",
      email: "owner@test.local",
      currency: "EUR",
      turnDurationMinutes: TURN,
      bookingInterval: 30,
      seatingBuffer: 15,
      maxPartySize: 12,
      maxReservationsPerSlot: 0,
      maxCoversPerSlot: 0,
    },
  });

  // Opening hours every day: lunch 12-15, dinner 18-23
  for (let dow = 0; dow < 7; dow++) {
    await prisma.openingHour.create({ data: { dayOfWeek: dow, startTime: "12:00", endTime: "15:00" } });
    await prisma.openingHour.create({ data: { dayOfWeek: dow, startTime: "18:00", endTime: "23:00" } });
  }

  const indoor = await prisma.area.create({ data: { name: "Indoor", kind: "indoor", isOpen: true, priority: 1, sortOrder: 2 } });
  const outdoor = await prisma.area.create({ data: { name: "Outdoor", kind: "outdoor", isOpen: true, weatherDependent: true, priority: 0, sortOrder: 1 } });
  outdoorId = outdoor.id;

  indoorTableIds = [];
  outdoorTableIds = [];
  for (let i = 1; i <= 4; i++) {
    const t = await prisma.restaurantTable.create({ data: { name: `I${i}`, seats: 4, section: "Indoor", areaId: indoor.id, x: 0, y: 0, w: 2, h: 2, sortOrder: i } });
    indoorTableIds.push(t.id);
  }
  for (let i = 1; i <= 4; i++) {
    const t = await prisma.restaurantTable.create({ data: { name: `O${i}`, seats: 4, section: "Outdoor", areaId: outdoor.id, x: 0, y: 3, w: 2, h: 2, sortOrder: 10 + i } });
    outdoorTableIds.push(t.id);
  }
});

beforeEach(wipeTransactional);

const okData = { firstName: "Test", phone: "", email: "guest@test.local" };
function guest(n: number) {
  return { ...okData, phone: `+355 69 000 00${n}` };
}

describe("date/time-specific area closures", () => {
  it("1. closing Outdoor today does not close Outdoor tomorrow", async () => {
    const today = futureDate(2);
    const tomorrow = futureDate(3);
    const res = await addAreaClosure({ areaId: outdoorId, date: today, fullDay: true });
    expect(res.ok).toBe(true);

    const todaySlots = await getAvailableTimes({ dateStr: today, partySize: 2, requestedArea: "outdoor" });
    const tomorrowSlots = await getAvailableTimes({ dateStr: tomorrow, partySize: 2, requestedArea: "outdoor" });
    expect(todaySlots.length).toBe(0);
    expect(tomorrowSlots.length).toBeGreaterThan(0);
  });

  it("2. a full-day Outdoor closure returns no Outdoor slots for that date", async () => {
    const date = futureDate(4);
    await addAreaClosure({ areaId: outdoorId, date, fullDay: true, reason: "Rain" });
    const slots = await getAvailableTimes({ dateStr: date, partySize: 2, requestedArea: "outdoor" });
    expect(slots.length).toBe(0);
  });

  it("3. a closure 18:00-21:00 removes only affected slots", async () => {
    const date = futureDate(5);
    await addAreaClosure({ areaId: outdoorId, date, fullDay: false, startTime: "18:00", endTime: "21:00" });
    const slots = await getAvailableTimes({ dateStr: date, partySize: 2, requestedArea: "outdoor" });
    const times = slots.map((s) => s.time);
    expect(times).toContain("12:00"); // lunch unaffected
    expect(times).not.toContain("18:00"); // covered by closure
    expect(times).not.toContain("20:00"); // covered
    expect(times).toContain("21:00"); // starts at/after closure end -> allowed
  });

  it("4. Indoor availability is unchanged when Outdoor is closed", async () => {
    const date = futureDate(6);
    const before = await getAvailableTimes({ dateStr: date, partySize: 2, requestedArea: "indoor" });
    await addAreaClosure({ areaId: outdoorId, date, fullDay: true });
    const after = await getAvailableTimes({ dateStr: date, partySize: 2, requestedArea: "indoor" });
    expect(after.length).toBe(before.length);
    expect(after[0].freeTables).toBe(before[0].freeTables);
  });

  it("5. NO_PREFERENCE uses only Indoor when Outdoor is closed", async () => {
    const date = futureDate(7);
    await addAreaClosure({ areaId: outdoorId, date, fullDay: true });
    // free tables at any slot should equal the number of indoor tables (4)
    const slots = await getAvailableTimes({ dateStr: date, partySize: 2, requestedArea: "no_preference" });
    expect(slots[0].freeTables).toBe(indoorTableIds.length);

    // and a booking is assigned an INDOOR table
    const r = await createReservation({ ...guest(1), tableId: "any", start: startISO(date, "19:00"), partySize: 2, requestedArea: "no_preference" });
    expect(r.ok).toBe(true);
    const created = await prisma.reservation.findFirst({ orderBy: { createdAt: "desc" }, include: { table: { include: { area: true } } } });
    expect(created?.table.area?.kind).toBe("indoor");
  });

  it("6. existing Outdoor reservations remain stored and appear as affected", async () => {
    const date = futureDate(8);
    const r = await createReservation({ ...guest(2), tableId: "any", start: startISO(date, "19:00"), partySize: 2, requestedArea: "outdoor" });
    expect(r.ok).toBe(true);
    const before = await prisma.reservation.count();

    await addAreaClosure({ areaId: outdoorId, date, fullDay: true });

    // reservation is NOT cancelled
    expect(await prisma.reservation.count()).toBe(before);
    const stillActive = await prisma.reservation.findFirst();
    expect(stillActive?.status).toBe("Confirmed");

    // it shows up as affected
    const overview = await getClosuresOverview();
    const closure = overview.find((c) => c.areaId === outdoorId);
    expect(closure).toBeTruthy();
    expect(closure!.affected.length).toBe(1);
  });

  it("7. deleting the closure restores Outdoor availability", async () => {
    const date = futureDate(9);
    const add = await addAreaClosure({ areaId: outdoorId, date, fullDay: true });
    expect(add.ok).toBe(true);
    expect((await getAvailableTimes({ dateStr: date, partySize: 2, requestedArea: "outdoor" })).length).toBe(0);

    const closure = await prisma.areaClosure.findFirst({ where: { areaId: outdoorId } });
    await deleteAreaClosure(closure!.id);
    expect((await getAvailableTimes({ dateStr: date, partySize: 2, requestedArea: "outdoor" })).length).toBeGreaterThan(0);
  });

  it("8. global and area-specific slot limits still apply", async () => {
    const date = futureDate(10);
    // Outdoor 19:00 max 1
    await addSlotLimit({ dayOfWeek: -1, time: "19:00", areaKind: "outdoor", maxReservations: 1 });
    const first = await createReservation({ ...guest(3), tableId: "any", start: startISO(date, "19:00"), partySize: 2, requestedArea: "outdoor" });
    expect(first.ok).toBe(true);

    // second outdoor 19:00 is now blocked by the area cap...
    const outdoor19 = await getAvailableTimes({ dateStr: date, partySize: 2, requestedArea: "outdoor" });
    expect(outdoor19.map((s) => s.time)).not.toContain("19:00");
    // ...but indoor 19:00 is unaffected
    const indoor19 = await getAvailableTimes({ dateStr: date, partySize: 2, requestedArea: "indoor" });
    expect(indoor19.map((s) => s.time)).toContain("19:00");
  });

  it("9. concurrency: an ARBITRARY configured limit (here 3) is enforced exactly", async () => {
    // Generic proof that whatever number staff configure is the number honoured.
    // Deliberately uses 3 (NOT Villa Gjeçaj's production 4) to show the cap is
    // data-driven, not hard-coded. The production value of 4 is asserted below.
    const date = futureDate(11);
    await addSlotLimit({ dayOfWeek: -1, time: "18:00", areaKind: "global", maxReservations: 3 });
    const start = startISO(date, "18:00");
    const results = await Promise.all(
      [1, 2, 3, 4, 5, 6].map((n) =>
        createReservation({ ...guest(n), tableId: "any", start, partySize: 2, requestedArea: "no_preference" }),
      ),
    );
    const okCount = results.filter((r) => r.ok).length;
    expect(okCount).toBe(3);
    const active = await prisma.reservation.count({ where: { startDateTime: new Date(start), status: { notIn: ["Cancelled", "NoShow"] } } });
    expect(active).toBe(3);
  });

  it("9b. Villa Gjeçaj acceptance: 6 simultaneous 18:00 requests → exactly 4 succeed on distinct tables", async () => {
    const date = futureDate(20);
    // Production rule for Villa Gjeçaj: max 4 reservations at 18:00.
    await addSlotLimit({ dayOfWeek: -1, time: "18:00", areaKind: "global", maxReservations: 4 });
    const start = startISO(date, "18:00");

    // Fire all six at once.
    const results = await Promise.all(
      [1, 2, 3, 4, 5, 6].map((n) =>
        createReservation({ ...guest(n), tableId: "any", start, partySize: 2, requestedArea: "no_preference" }),
      ),
    );

    // Exactly four accepted, two rejected.
    const accepted = results.filter((r) => r.ok);
    const rejected = results.filter((r) => !r.ok);
    expect(accepted.length).toBe(4);
    expect(rejected.length).toBe(2);

    // The four accepted reservations occupy VALID, DISTINCT tables.
    const active = await prisma.reservation.findMany({
      where: { startDateTime: new Date(start), status: { notIn: ["Cancelled", "NoShow"] } },
      include: { table: true },
    });
    expect(active.length).toBe(4); // DB holds exactly four active reservations for the slot
    const tableIds = active.map((r) => r.tableId);
    expect(new Set(tableIds).size).toBe(4); // distinct
    const allValidTables = [...indoorTableIds, ...outdoorTableIds];
    for (const t of tableIds) expect(allValidTables).toContain(t); // valid, real tables
  });

  it("10. special requests and assigned area appear in guest and owner emails", async () => {
    const date = futureDate(12);
    const r = await createReservation({
      ...guest(4),
      tableId: "any",
      start: startISO(date, "19:00"),
      partySize: 2,
      requestedArea: "outdoor",
      notes: "Window seat with a view please",
    });
    expect(r.ok).toBe(true);
    const guestMail = sentEmails.find((m) => m.to === "guest@test.local");
    const ownerMail = sentEmails.find((m) => m.to === "owner@test.local");
    expect(guestMail).toBeTruthy();
    expect(ownerMail).toBeTruthy();
    for (const m of [guestMail!, ownerMail!]) {
      expect(m.html).toContain("Window seat with a view please");
      expect(m.html).toContain("Outdoor");
    }
    // outdoor weather note present in the guest email
    expect(guestMail!.html.toLowerCase()).toContain("weather");
  });
});

describe("requestedArea vs assigned area + manual transfer", () => {
  it("requestedArea and assigned area remain distinguishable", async () => {
    const date = futureDate(13);
    await createReservation({ ...guest(5), tableId: "any", start: startISO(date, "19:00"), partySize: 2, requestedArea: "no_preference" });
    const res = await prisma.reservation.findFirst({ include: { table: { include: { area: true } } } });
    expect(res?.requestedArea).toBe("no_preference");
    expect(["indoor", "outdoor"]).toContain(res?.table.area?.kind);
  });

  it("transferring an Outdoor booking to Indoor keeps requestedArea, frees old table, checks conflicts, emails guest", async () => {
    const date = futureDate(14);
    // outdoor booking
    const r = await createReservation({ ...guest(6), tableId: "any", start: startISO(date, "19:00"), partySize: 2, requestedArea: "outdoor" });
    expect(r.ok).toBe(true);
    const original = await prisma.reservation.findFirst({ include: { table: true } });
    const oldTableId = original!.tableId;
    expect(original!.requestedArea).toBe("outdoor");

    sentEmails.length = 0;
    const targetIndoor = indoorTableIds[0];
    const move = await rescheduleReservation(original!.id, startISO(date, "19:00"), targetIndoor);
    expect(move.ok).toBe(true);

    const moved = await prisma.reservation.findUnique({ where: { id: original!.id }, include: { table: { include: { area: true } } } });
    expect(moved!.tableId).toBe(targetIndoor);
    expect(moved!.table.area?.kind).toBe("indoor"); // assigned area changed
    expect(moved!.requestedArea).toBe("outdoor"); // original request preserved

    // old outdoor table is free again
    const statuses = await getTableAvailabilityAt({ dateStr: date, time: "19:00", partySize: 2 });
    expect(statuses.find((s) => s.tableId === oldTableId)?.status).toBe("free");

    // reschedule email sent to the guest
    expect(sentEmails.some((m) => m.to === "guest@test.local")).toBe(true);
  });

  it("reschedule to an occupied table is rejected (conflict check)", async () => {
    const date = futureDate(15);
    // book indoor table 0 at 19:00
    await createReservation({ ...guest(7), tableId: indoorTableIds[0], start: startISO(date, "19:00"), partySize: 2, requestedArea: "indoor" });
    // another booking on a different table
    const other = await createReservation({ ...guest(8), tableId: indoorTableIds[1], start: startISO(date, "19:00"), partySize: 2, requestedArea: "indoor" });
    expect(other.ok).toBe(true);
    const otherRes = await prisma.reservation.findFirst({ where: { tableId: indoorTableIds[1] } });
    // try to move it onto the occupied table 0
    const move = await rescheduleReservation(otherRes!.id, startISO(date, "19:00"), indoorTableIds[0]);
    expect(move.ok).toBe(false);
  });
});
