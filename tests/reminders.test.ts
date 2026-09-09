import { vi, describe, it, expect, beforeAll, beforeEach } from "vitest";

const emailState = { deliver: true, sent: [] as { to: string; subject: string; html: string }[] };
vi.mock("@/lib/email", () => ({
  isEmailConfigured: () => true,
  appUrl: () => "http://localhost:3000",
  sendEmail: async (msg: { to: string; subject: string; html: string }) => {
    emailState.sent.push(msg);
    return { delivered: emailState.deliver, demo: false };
  },
}));

import { prisma } from "@/lib/prisma";
import { sendDueReminders } from "@/lib/reminders";

const H = 60 * 60 * 1000;
let NOW: Date;
let areaId = "";
let tableId = "";
let custSeq = 0;

async function makeReservation(startOffsetMs: number, status = "Confirmed") {
  const cust = await prisma.customer.create({
    data: { firstName: "Guest", lastName: "Gjecaj", phone: `+355 69 000 ${custSeq++}`, email: "guest@test.local" },
  });
  const start = new Date(NOW.getTime() + startOffsetMs);
  const res = await prisma.reservation.create({
    data: { tableId, customerId: cust.id, startDateTime: start, endDateTime: new Date(start.getTime() + 120 * 60000), partySize: 2, status, requestedArea: "indoor" },
  });
  await prisma.reservationTable.create({ data: { reservationId: res.id, tableId } });
  return res;
}

async function setReminderFlags(r24: boolean, r2: boolean) {
  const s = await prisma.restaurantSetting.findFirst();
  await prisma.restaurantSetting.update({ where: { id: s!.id }, data: { reminder24hEnabled: r24, reminder2hEnabled: r2 } });
}

beforeAll(async () => {
  await prisma.notification.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.reservationTable.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.restaurantTable.deleteMany();
  await prisma.area.deleteMany();
  await prisma.restaurantSetting.deleteMany();

  await prisma.restaurantSetting.create({
    data: { name: "Villa Gjecaj", email: "owner@test.local", currency: "EUR", turnDurationMinutes: 120, reminder24hEnabled: true, reminder2hEnabled: false },
  });
  const area = await prisma.area.create({ data: { name: "Indoor", kind: "indoor", isOpen: true } });
  areaId = area.id;
  const t = await prisma.restaurantTable.create({ data: { name: "T1", seats: 4, section: "T1", areaId, x: 0, y: 0, w: 2, h: 2 } });
  tableId = t.id;
});

beforeEach(async () => {
  await prisma.notification.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.customer.deleteMany();
  emailState.deliver = true;
  emailState.sent = [];
  NOW = new Date();
  await setReminderFlags(true, false);
});

describe("automatic reminders", () => {
  it("selects the 24h reminder for a reservation ~24h out, and not one days away", async () => {
    await makeReservation(24 * H + 5 * 60000); // due
    await makeReservation(3 * 24 * H); // far future — not due
    const r = await sendDueReminders(NOW);
    expect(r.sent).toBe(1);
    expect(emailState.sent).toHaveLength(1);
    const n = await prisma.notification.findMany({ where: { type: "Reminder24h", status: "Sent" } });
    expect(n).toHaveLength(1);
  });

  it("a duplicate cron run sends the reminder only once (idempotent)", async () => {
    await makeReservation(24 * H + 5 * 60000);
    await sendDueReminders(NOW);
    const second = await sendDueReminders(NOW);
    expect(second.sent).toBe(0);
    expect(emailState.sent).toHaveLength(1);
    expect(await prisma.notification.count({ where: { type: "Reminder24h" } })).toBe(1);
  });

  it("cancelled / completed / no-show reservations receive nothing", async () => {
    await makeReservation(24 * H + 5 * 60000, "Cancelled");
    await makeReservation(24 * H + 6 * 60000, "Completed");
    await makeReservation(24 * H + 7 * 60000, "NoShow");
    const r = await sendDueReminders(NOW);
    expect(r.sent).toBe(0);
    expect(emailState.sent).toHaveLength(0);
  });

  it("selects by an absolute 24h offset (DST-independent) within the window", async () => {
    await makeReservation(24 * H + 1 * 60000); // inside [now+24h, now+24h+15m)
    await makeReservation(24 * H + 20 * 60000); // outside the 15m window
    const r = await sendDueReminders(NOW);
    expect(r.sent).toBe(1);
  });

  it("logs a failed email and can retry it without duplicating on success", async () => {
    await makeReservation(24 * H + 5 * 60000);
    emailState.deliver = false;
    const first = await sendDueReminders(NOW);
    expect(first.failed).toBe(1);
    expect(await prisma.notification.count({ where: { type: "Reminder24h", status: "Failed" } })).toBe(1);

    // retry now succeeds — exactly one send, one Sent row, no duplicate
    emailState.deliver = true;
    const retry = await sendDueReminders(NOW);
    expect(retry.sent).toBe(1);
    expect(await prisma.notification.count({ where: { type: "Reminder24h", status: "Sent" } })).toBe(1);
    expect(await prisma.notification.count({ where: { type: "Reminder24h" } })).toBe(1);
  });

  it("the optional 2h reminder sends once when enabled", async () => {
    await setReminderFlags(true, true);
    await makeReservation(2 * H + 5 * 60000); // due for the 2h reminder
    const r = await sendDueReminders(NOW);
    expect(r.byType.Reminder2h.sent).toBe(1);
    const second = await sendDueReminders(NOW);
    expect(second.byType.Reminder2h.sent).toBe(0);
    expect(emailState.sent.filter((m) => /couple of hours|is in a couple|reminder/i.test(m.subject)).length).toBeGreaterThan(0);
  });

  it("includes the guest name, restaurant and assigned table in the email", async () => {
    await makeReservation(24 * H + 5 * 60000);
    await sendDueReminders(NOW);
    const mail = emailState.sent[0];
    expect(mail.to).toBe("guest@test.local");
    expect(mail.html).toContain("Guest"); // guest first name
    expect(mail.html).toContain("Villa Gjecaj"); // restaurant name
    expect(mail.html).toContain("T1"); // assigned table
  });
});
