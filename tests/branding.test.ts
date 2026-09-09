import { vi, describe, it, expect } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/email", () => ({
  isEmailConfigured: () => true,
  appUrl: () => "http://localhost:3000",
  sendEmail: async () => ({ delivered: true, demo: false }),
}));

import { prisma } from "@/lib/prisma";
import { buildReservationEmails } from "@/lib/notifications";
import { updateSettings } from "@/server/actions";

const LOGO = "https://booking.gjecaj.al/logo.png";
let tableId = "";

async function seed(logoUrl: string | null) {
  await prisma.notification.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.reservationTable.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.restaurantTable.deleteMany();
  await prisma.area.deleteMany();
  await prisma.restaurantSetting.deleteMany();

  await prisma.restaurantSetting.create({ data: { name: "Villa Gjecaj", email: "owner@test.local", currency: "EUR", logoUrl } });
  const area = await prisma.area.create({ data: { name: "Indoor", kind: "indoor", isOpen: true } });
  const t = await prisma.restaurantTable.create({ data: { name: "T1", seats: 4, section: "T1", areaId: area.id, x: 0, y: 0, w: 2, h: 2 } });
  tableId = t.id;
  const cust = await prisma.customer.create({ data: { firstName: "Guest", lastName: "G", phone: "+355 69 1", email: "guest@test.local" } });
  const start = new Date(Date.now() + 24 * 3600 * 1000);
  const res = await prisma.reservation.create({
    data: { tableId, customerId: cust.id, startDateTime: start, endDateTime: new Date(start.getTime() + 2 * 3600 * 1000), partySize: 2, status: "Confirmed", requestedArea: "indoor" },
  });
  await prisma.reservationTable.create({ data: { reservationId: res.id, tableId } });
  return res.id;
}

function validSettings(over: Record<string, unknown>) {
  return {
    name: "Villa Gjecaj", tagline: "", phone: "", whatsapp: "", address: "", email: "owner@test.local",
    currency: "EUR", turnDurationMinutes: 120, bookingInterval: 30, seatingBuffer: 15, maxPartySize: 12,
    maxReservationsPerSlot: 0, maxCoversPerSlot: 0, reminder24hEnabled: true, reminder2hEnabled: false, reminderText: "",
    logoUrl: "", websiteUrl: "", brandColor: "", ...over,
  };
}

describe("branding", () => {
  it("renders the logo <img> in emails when a https logo URL is set", async () => {
    const id = await seed(LOGO);
    const emails = await buildReservationEmails(id, "BookingConfirmation");
    expect(emails?.customer?.html).toContain(`<img src="${LOGO}"`);
    expect(emails?.customer?.html).toContain('alt="Villa Gjecaj"'); // readable when images blocked
  });

  it("falls back to the restaurant name text when no logo is set", async () => {
    const id = await seed(null);
    const emails = await buildReservationEmails(id, "BookingConfirmation");
    expect(emails?.customer?.html).not.toContain("<img src=");
    expect(emails?.customer?.html).toContain("Villa Gjecaj");
  });

  it("does not render a non-https logo as an image", async () => {
    const id = await seed("http://insecure.example.com/logo.png");
    const emails = await buildReservationEmails(id, "BookingConfirmation");
    expect(emails?.customer?.html).not.toContain("<img src=");
  });

  it("the reminder email also uses the branded layout with the logo", async () => {
    const id = await seed(LOGO);
    const emails = await buildReservationEmails(id, "Reminder24h");
    expect(emails?.customer?.html).toContain(`<img src="${LOGO}"`);
  });

  it("settings validation rejects a non-https logo URL", async () => {
    await seed(null);
    const res = await updateSettings(validSettings({ logoUrl: "http://insecure.example.com/logo.png" }));
    expect(res.ok).toBe(false);
  });

  it("settings validation accepts a https logo URL", async () => {
    await seed(null);
    const res = await updateSettings(validSettings({ logoUrl: LOGO }));
    expect(res.ok).toBe(true);
    const s = await prisma.restaurantSetting.findFirst();
    expect(s?.logoUrl).toBe(LOGO);
  });
});
