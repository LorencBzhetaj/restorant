import { vi, describe, it, expect, beforeAll, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/require-admin", () => ({ isAdmin: async () => true }));
vi.mock("@/lib/email", () => ({
  isEmailConfigured: () => true,
  appUrl: () => "http://localhost:3000",
  sendEmail: async () => ({ delivered: true, demo: false }),
}));

import { prisma } from "@/lib/prisma";
import { getAvailableTimes, getTableAvailabilityAt } from "@/lib/availability";
import {
  createReservation,
  rescheduleReservation,
  cancelReservationByToken,
  addCombination,
} from "@/server/actions";

const TURN = 120;
let indoorId = "";
let outdoorId = "";
const T: Record<string, string> = {}; // table name -> id

function futureDate(offset: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function startISO(dateStr: string, time: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, mn] = time.split(":").map(Number);
  return new Date(y, m - 1, d, h, mn, 0, 0).toISOString();
}
function guest(n: number) {
  return { firstName: "Test", lastName: "", email: "guest@test.local", phone: `+355 69 111 00${n}` };
}

async function tablesOf(reservationId: string): Promise<string[]> {
  const rows = await prisma.reservationTable.findMany({ where: { reservationId }, select: { tableId: true } });
  return rows.map((r) => r.tableId).sort();
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
    data: {
      name: "Test", email: "owner@test.local", currency: "EUR",
      turnDurationMinutes: TURN, bookingInterval: 30, seatingBuffer: 15, maxPartySize: 12,
      maxReservationsPerSlot: 0, maxCoversPerSlot: 0,
    },
  });
  for (let dow = 0; dow < 7; dow++) {
    await prisma.openingHour.create({ data: { dayOfWeek: dow, startTime: "12:00", endTime: "15:00" } });
    await prisma.openingHour.create({ data: { dayOfWeek: dow, startTime: "18:00", endTime: "23:00" } });
  }
  const indoor = await prisma.area.create({ data: { name: "Indoor", kind: "indoor", isOpen: true, priority: 1, sortOrder: 2 } });
  const outdoor = await prisma.area.create({ data: { name: "Outdoor", kind: "outdoor", isOpen: true, weatherDependent: true, priority: 0, sortOrder: 1 } });
  indoorId = indoor.id;
  outdoorId = outdoor.id;

  const mk = async (name: string, seats: number, areaId: string, sort: number) => {
    const t = await prisma.restaurantTable.create({ data: { name, seats, section: name, areaId, x: 0, y: 0, w: 2, h: 2, sortOrder: sort } });
    T[name] = t.id;
  };
  await mk("I4", 4, indoorId, 1);
  await mk("I4b", 4, indoorId, 2);
  await mk("I2a", 2, indoorId, 3);
  await mk("I2b", 2, indoorId, 4);
  await mk("O2a", 2, outdoorId, 10);
  await mk("O2b", 2, outdoorId, 11);

  await prisma.tableCombination.create({
    data: { name: "Indoor 2+2", areaId: indoorId, maxSeats: 4, priority: 0, isActive: true, members: { create: [{ tableId: T.I2a }, { tableId: T.I2b }] } },
  });
  await prisma.tableCombination.create({
    data: { name: "Outdoor 2+2", areaId: outdoorId, maxSeats: 4, priority: 0, isActive: true, members: { create: [{ tableId: T.O2a }, { tableId: T.O2b }] } },
  });
});

async function wipeTransactional() {
  await prisma.notification.deleteMany();
  await prisma.reservation.deleteMany(); // cascades ReservationTable
  await prisma.slotLimit.deleteMany();
  await prisma.areaClosure.deleteMany();
  await prisma.customer.deleteMany();
}
beforeEach(wipeTransactional);

async function book(n: number, dateStr: string, time: string, party: number, area: "indoor" | "outdoor" | "no_preference" = "indoor", tableId = "any") {
  return createReservation({ ...guest(n), tableId, start: startISO(dateStr, time), partySize: party, requestedArea: area });
}

describe("combined tables", () => {
  it("1. a single suitable table is preferred over a combination", async () => {
    const date = futureDate(2);
    const r = await book(1, date, "19:00", 4, "indoor");
    expect(r.ok).toBe(true);
    const res = await prisma.reservation.findFirst({ orderBy: { createdAt: "desc" } });
    const t = await tablesOf(res!.id);
    expect(t).toHaveLength(1);
    expect([T.I4, T.I4b]).toContain(t[0]); // a single 4-seat table, not the 2+2 combo
  });

  it("2. a combination is used when no single table fits", async () => {
    const date = futureDate(3);
    // occupy both 4-seat singles
    expect((await book(1, date, "19:00", 4, "indoor")).ok).toBe(true);
    expect((await book(2, date, "19:00", 4, "indoor")).ok).toBe(true);
    // third party of 4 must use the 2+2 combination
    const r = await book(3, date, "19:00", 4, "indoor");
    expect(r.ok).toBe(true);
    const res = await prisma.reservation.findFirst({ orderBy: { createdAt: "desc" } });
    expect(await tablesOf(res!.id)).toEqual([T.I2a, T.I2b].sort());
  });

  it("3. an unavailable member makes the combination unavailable", async () => {
    const date = futureDate(4);
    await book(1, date, "19:00", 4, "indoor"); // I4
    await book(2, date, "19:00", 4, "indoor"); // I4b
    await book(3, date, "19:00", 2, "indoor", T.I2a); // occupy one combo member
    // no single 4-seat free, and the only indoor combo has a busy member
    const r = await book(4, date, "19:00", 4, "indoor");
    expect(r.ok).toBe(false);
  });

  it("4. a combination cannot cross Indoor and Outdoor", async () => {
    const res = await addCombination({ name: "Bad mix", areaId: indoorId, maxSeats: 4, priority: 0, isActive: true, tableIds: [T.I2a, T.O2a] });
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.error).toMatch(/belong to the selected area/i);
  });

  it("5. cancelling a combined booking releases every member table", async () => {
    const date = futureDate(5);
    await book(1, date, "19:00", 4, "indoor");
    await book(2, date, "19:00", 4, "indoor");
    const combo = await book(3, date, "19:00", 4, "indoor");
    expect(combo.ok).toBe(true);
    const token = (combo as { data: { cancelToken: string } }).data.cancelToken;

    // members occupied now
    let avail = await getTableAvailabilityAt({ dateStr: date, time: "19:00" });
    expect(avail.find((a) => a.tableId === T.I2a)?.status).toBe("occupied");
    expect(avail.find((a) => a.tableId === T.I2b)?.status).toBe("occupied");

    await cancelReservationByToken(token);

    avail = await getTableAvailabilityAt({ dateStr: date, time: "19:00" });
    expect(avail.find((a) => a.tableId === T.I2a)?.status).toBe("free");
    expect(avail.find((a) => a.tableId === T.I2b)?.status).toBe("free");
  });

  it("6. rescheduling releases the old table and reserves the new one", async () => {
    const date = futureDate(6);
    const r = await book(1, date, "19:00", 4, "indoor");
    const res = await prisma.reservation.findFirst();
    const oldTable = (await tablesOf(res!.id))[0];
    const newTable = oldTable === T.I4 ? T.I4b : T.I4;

    const move = await rescheduleReservation(res!.id, startISO(date, "19:00"), newTable);
    expect(move.ok).toBe(true);
    expect(await tablesOf(res!.id)).toEqual([newTable]);

    const avail = await getTableAvailabilityAt({ dateStr: date, time: "19:00" });
    expect(avail.find((a) => a.tableId === oldTable)?.status).toBe("free");
    expect(avail.find((a) => a.tableId === newTable)?.status).toBe("occupied");
    void r;
  });

  it("7. an area closure blocks the combination", async () => {
    const date = futureDate(7);
    await prisma.areaClosure.create({
      data: { areaId: indoorId, startDateTime: new Date(startISO(date, "00:00")), endDateTime: new Date(startISO(date, "23:59")) },
    });
    // occupy nothing; indoor closed → a party of 4 requesting indoor has no slots
    const slots = await getAvailableTimes({ dateStr: date, partySize: 4, requestedArea: "indoor" });
    expect(slots.length).toBe(0);
  });

  it("8. simultaneous requests cannot share member tables", async () => {
    const date = futureDate(8);
    // fill both single 4-seaters so only the single indoor 2+2 combo can seat a 4-top
    await book(1, date, "19:00", 4, "indoor");
    await book(2, date, "19:00", 4, "indoor");

    const results = await Promise.all([
      book(3, date, "19:00", 4, "indoor"),
      book(4, date, "19:00", 4, "indoor"),
    ]);
    const ok = results.filter((r) => r.ok);
    expect(ok.length).toBe(1); // exactly one wins the only combination

    // the winner holds both members; no double-booking
    const active = await prisma.reservationTable.findMany({
      where: { reservation: { startDateTime: new Date(startISO(date, "19:00")), status: { notIn: ["Cancelled", "NoShow"] } } },
    });
    const ids = active.map((r) => r.tableId);
    expect(new Set(ids).size).toBe(ids.length); // no table appears twice
  });

  it("9. existing single-table reservations survive the backfill migration", async () => {
    const date = futureDate(9);
    const customer = await prisma.customer.create({ data: { firstName: "Legacy", lastName: "", phone: "+355 69 999 999" } });
    // a legacy reservation written with ONLY tableId (no ReservationTable row)
    const legacy = await prisma.reservation.create({
      data: { tableId: T.I4, customerId: customer.id, startDateTime: new Date(startISO(date, "19:00")), endDateTime: new Date(startISO(date, "21:00")), partySize: 4, status: "Confirmed", requestedArea: "indoor" },
    });
    expect(await tablesOf(legacy.id)).toHaveLength(0);

    // the migration's backfill statement, run idempotently
    await prisma.$executeRawUnsafe(
      `INSERT INTO "ReservationTable" ("id","reservationId","tableId") SELECT gen_random_uuid()::text, "id","tableId" FROM "Reservation" ON CONFLICT ("reservationId","tableId") DO NOTHING`,
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO "ReservationTable" ("id","reservationId","tableId") SELECT gen_random_uuid()::text, "id","tableId" FROM "Reservation" ON CONFLICT ("reservationId","tableId") DO NOTHING`,
    );

    expect(await tablesOf(legacy.id)).toEqual([T.I4]); // backfilled exactly once
  });

  it("10. the 18:00 maximum-four rule still holds with combinations present", async () => {
    const date = futureDate(10);
    await prisma.slotLimit.create({ data: { time: "18:00", areaKind: null, dayOfWeek: null, maxReservations: 4 } });
    const start = startISO(date, "18:00");
    const results = await Promise.all(
      [1, 2, 3, 4, 5, 6].map((n) => createReservation({ ...guest(n), tableId: "any", start, partySize: 2, requestedArea: "no_preference" })),
    );
    expect(results.filter((r) => r.ok).length).toBe(4);
    const active = await prisma.reservation.count({ where: { startDateTime: new Date(start), status: { notIn: ["Cancelled", "NoShow"] } } });
    expect(active).toBe(4);
  });
});
