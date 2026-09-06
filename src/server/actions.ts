"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isTableBookable, getSettings, slotHasCapacity } from "@/lib/availability";
import { sendNotification } from "@/lib/notifications";
import { toDateKey, pad2 } from "@/lib/format";
import {
  createReservationSchema,
  walkInSchema,
  tableSchema,
  openingHourSchema,
  closureSchema,
  settingsSchema,
  slotLimitSchema,
  areaSchema,
} from "@/lib/validations";
import { ReservationStatus, NotificationType } from "@/lib/constants";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

function revalidateAdmin() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/floor");
  revalidatePath("/dashboard/reservations");
  revalidatePath("/dashboard/customers");
}

async function findOrCreateCustomer(input: {
  firstName: string;
  lastName?: string;
  phone: string;
  whatsappNumber?: string;
  email?: string;
  notes?: string;
}) {
  const existing = await prisma.customer.findFirst({ where: { phone: input.phone } });
  if (existing) return existing;
  return prisma.customer.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName || "",
      phone: input.phone,
      whatsappNumber: input.whatsappNumber || input.phone,
      email: input.email || null,
      notes: input.notes || null,
    },
  });
}

function timeOf(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * Assign a free table INSIDE the booking transaction (race-safe under the
 * per-slot advisory lock). For "any", picks the smallest suitable free table;
 * for a specific table, returns it only if still free. Returns null if none.
 */
async function assignTableTx(
  tx: Prisma.TransactionClient,
  p: {
    requestedTableId: string;
    requestedArea: "indoor" | "outdoor" | "no_preference";
    partySize: number;
    start: Date;
    end: Date;
    bufferMs: number;
  },
): Promise<{ id: string; areaKind: string | null } | null> {
  const busy = await tx.reservation.findMany({
    where: {
      status: { notIn: ["Cancelled", "NoShow"] },
      startDateTime: { lt: new Date(p.end.getTime() + p.bufferMs) },
      endDateTime: { gt: new Date(p.start.getTime() - p.bufferMs) },
    },
    select: { tableId: true },
  });
  const busyIds = new Set(busy.map((b) => b.tableId));

  if (p.requestedTableId !== "any") {
    const t = await tx.restaurantTable.findUnique({ where: { id: p.requestedTableId }, include: { area: true } });
    if (!t || !t.isActive || t.seats < p.partySize || busyIds.has(t.id)) return null;
    return { id: t.id, areaKind: t.area?.kind ?? null };
  }

  const areas = await tx.area.findMany();
  const openIds = new Set(
    areas.filter((a) => a.isOpen && (p.requestedArea === "no_preference" || a.kind === p.requestedArea)).map((a) => a.id),
  );
  const kindOf = new Map(areas.map((a) => [a.id, a.kind]));
  const prioOf = new Map(areas.map((a) => [a.id, a.priority]));

  const tables = await tx.restaurantTable.findMany({
    where: { isActive: true, seats: { gte: p.partySize } },
    select: { id: true, seats: true, sortOrder: true, areaId: true },
  });
  const eligible = tables
    .filter((t) => (t.areaId ? openIds.has(t.areaId) : p.requestedArea === "no_preference"))
    .sort(
      (a, b) =>
        (prioOf.get(a.areaId ?? "") ?? 99) - (prioOf.get(b.areaId ?? "") ?? 99) ||
        a.seats - b.seats ||
        a.sortOrder - b.sortOrder,
    );
  const chosen = eligible.find((t) => !busyIds.has(t.id));
  return chosen ? { id: chosen.id, areaKind: chosen.areaId ? kindOf.get(chosen.areaId) ?? null : null } : null;
}

export async function createReservation(
  raw: unknown,
): Promise<ActionResult<{ reservationId: string; cancelToken: string; email: string }>> {
  const parsed = createReservationSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid reservation details" };
  }
  const input = parsed.data;
  const start = new Date(input.start);
  if (Number.isNaN(start.getTime())) return { ok: false, error: "Invalid time selected" };

  const settings = await getSettings();

  // A concrete table given by the client still gets a fast pre-check; the
  // authoritative assignment (incl. "any") happens INSIDE the locked transaction.
  const isAny = input.tableId === "any";
  if (!isAny) {
    const bookable = await isTableBookable({ tableId: input.tableId, start, partySize: input.partySize });
    if (!bookable) return { ok: false, error: "That table is no longer available. Please pick another slot." };
  }

  const end = new Date(start.getTime() + settings.turnDurationMinutes * 60000);
  const bufferMs = settings.seatingBuffer * 60000;
  const dateStr = toDateKey(start);
  const time = timeOf(start);

  try {
    const customer = await findOrCreateCustomer(input);
    const reservation = await prisma.$transaction(
      async (tx) => {
        // Serialize concurrent bookings for the SAME slot so caps + table
        // assignment are race-safe (each concurrent booking gets a distinct table).
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${dateStr}T${time}`})::bigint)`;

        const assigned = await assignTableTx(tx, {
          requestedTableId: input.tableId,
          requestedArea: input.requestedArea,
          partySize: input.partySize,
          start,
          end,
          bufferMs,
        });
        if (!assigned) throw new Error(isAny ? "NO_TABLE" : "SLOT_TAKEN");

        if (!(await slotHasCapacity(tx, { dateStr, time, partySize: input.partySize, areaKind: assigned.areaKind }))) {
          throw new Error("SLOT_FULL");
        }

        return tx.reservation.create({
          data: {
            tableId: assigned.id,
            customerId: customer.id,
            startDateTime: start,
            endDateTime: end,
            partySize: input.partySize,
            status: "Confirmed",
            notes: input.notes || null,
            source: "Online",
            requestedArea: input.requestedArea,
          },
        });
      },
      { timeout: 20000, maxWait: 12000 },
    );

    await sendNotification(reservation.id, "BookingConfirmation");
    revalidateAdmin();
    return { ok: true, data: { reservationId: reservation.id, cancelToken: reservation.cancelToken, email: input.email } };
  } catch (e) {
    if (e instanceof Error && (e.message === "SLOT_FULL" || e.message === "NO_TABLE")) {
      return { ok: false, error: "That time is fully booked. Please pick another slot." };
    }
    if (e instanceof Error && e.message === "SLOT_TAKEN") {
      return { ok: false, error: "That table was just booked. Please pick another slot." };
    }
    return { ok: false, error: "Could not create the reservation. Please try again." };
  }
}

/** Self-service cancellation via the token in the confirmation email. */
export async function cancelReservationByToken(token: string): Promise<ActionResult> {
  const res = await prisma.reservation.findUnique({ where: { cancelToken: token } });
  if (!res) return { ok: false, error: "Reservation not found" };
  if (res.status === "Cancelled") return { ok: true };
  if (res.status === "Completed") return { ok: false, error: "This reservation has already taken place." };
  await prisma.reservation.update({ where: { id: res.id }, data: { status: "Cancelled" } });
  await sendNotification(res.id, "Cancellation");
  revalidateAdmin();
  revalidatePath(`/r/${token}`);
  return { ok: true };
}

export async function createWalkIn(raw: unknown): Promise<ActionResult<{ reservationId: string }>> {
  const parsed = walkInSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid details" };
  const input = parsed.data;
  const start = new Date(input.start);
  if (Number.isNaN(start.getTime())) return { ok: false, error: "Invalid time" };

  const settings = await getSettings();
  const end = new Date(start.getTime() + settings.turnDurationMinutes * 60000);
  const bufferMs = settings.seatingBuffer * 60000;
  const dateStr = toDateKey(start);
  const time = timeOf(start);

  try {
    const customer = await findOrCreateCustomer(input);
    // Walk-ins bypass the per-slot cap (staff override) but still get a real,
    // conflict-free table via the same race-safe assignment.
    const reservation = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${dateStr}T${time}`})::bigint)`;
        const assigned = await assignTableTx(tx, {
          requestedTableId: input.tableId,
          requestedArea: input.requestedArea,
          partySize: input.partySize,
          start,
          end,
          bufferMs,
        });
        if (!assigned) throw new Error("SLOT_TAKEN");
        return tx.reservation.create({
          data: {
            tableId: assigned.id,
            customerId: customer.id,
            startDateTime: start,
            endDateTime: end,
            partySize: input.partySize,
            status: "Confirmed",
            notes: input.notes || null,
            source: "Walk-in",
            requestedArea: input.requestedArea,
          },
        });
      },
      { timeout: 20000, maxWait: 12000 },
    );
    await sendNotification(reservation.id, "BookingConfirmation");
    revalidateAdmin();
    return { ok: true, data: { reservationId: reservation.id } };
  } catch (e) {
    if (e instanceof Error && e.message === "SLOT_TAKEN") return { ok: false, error: "That table was just booked." };
    return { ok: false, error: "Could not create the reservation." };
  }
}

const STATUS_NOTIFICATION: Partial<Record<ReservationStatus, NotificationType>> = {
  Completed: "Completed",
  Cancelled: "Cancellation",
  NoShow: "NoShow",
};

export async function setReservationStatus(id: string, status: ReservationStatus): Promise<ActionResult> {
  const res = await prisma.reservation.findUnique({ where: { id } });
  if (!res) return { ok: false, error: "Reservation not found" };
  await prisma.reservation.update({ where: { id }, data: { status } });
  const notif = STATUS_NOTIFICATION[status];
  if (notif) await sendNotification(id, notif);
  revalidateAdmin();
  return { ok: true };
}

export async function rescheduleReservation(
  id: string,
  newStartIso: string,
  newTableId?: string,
): Promise<ActionResult> {
  const res = await prisma.reservation.findUnique({ where: { id } });
  if (!res) return { ok: false, error: "Reservation not found" };
  const tableId = newTableId || res.tableId;
  const start = new Date(newStartIso);
  if (Number.isNaN(start.getTime())) return { ok: false, error: "Invalid time" };

  const settings = await getSettings();
  const bookable = await isTableBookable({
    tableId,
    start,
    partySize: res.partySize,
    ignoreReservationId: id,
  });
  if (!bookable) return { ok: false, error: "That table/time is not available." };

  const end = new Date(start.getTime() + settings.turnDurationMinutes * 60000);
  await prisma.reservation.update({
    where: { id },
    data: { startDateTime: start, endDateTime: end, tableId },
  });
  await sendNotification(id, "Reschedule");
  revalidateAdmin();
  return { ok: true };
}

// ---- Tables ----------------------------------------------------------------
export async function upsertTable(id: string | null, raw: unknown): Promise<ActionResult> {
  const parsed = tableSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  const p = parsed.data;
  const data = {
    name: p.name,
    seats: p.seats,
    section: p.section,
    areaId: p.areaId || null,
    shape: p.shape,
    x: p.x,
    y: p.y,
    w: p.w,
    h: p.h,
    isActive: p.isActive,
  };
  if (id) {
    await prisma.restaurantTable.update({ where: { id }, data });
  } else {
    const count = await prisma.restaurantTable.count();
    await prisma.restaurantTable.create({ data: { ...data, sortOrder: count + 1 } });
  }
  revalidatePath("/dashboard/tables");
  revalidatePath("/dashboard/floor");
  return { ok: true };
}

// ---- Areas -----------------------------------------------------------------
export async function addArea(raw: unknown): Promise<ActionResult> {
  const parsed = areaSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  const count = await prisma.area.count();
  await prisma.area.create({ data: { ...parsed.data, sortOrder: count + 1 } });
  revalidatePath("/dashboard/tables");
  revalidatePath("/dashboard/floor");
  return { ok: true };
}

export async function toggleAreaOpen(id: string, isOpen: boolean): Promise<ActionResult> {
  await prisma.area.update({ where: { id }, data: { isOpen } });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/floor");
  revalidatePath("/dashboard/tables");
  return { ok: true };
}

export async function deleteArea(id: string): Promise<ActionResult> {
  const tableCount = await prisma.restaurantTable.count({ where: { areaId: id } });
  if (tableCount > 0) return { ok: false, error: "Move or delete this area's tables first." };
  await prisma.area.delete({ where: { id } });
  revalidatePath("/dashboard/tables");
  return { ok: true };
}

export async function toggleTableActive(id: string, isActive: boolean): Promise<ActionResult> {
  await prisma.restaurantTable.update({ where: { id }, data: { isActive } });
  revalidatePath("/dashboard/tables");
  revalidatePath("/dashboard/floor");
  return { ok: true };
}

// ---- Opening hours ---------------------------------------------------------
export async function addOpeningHour(raw: unknown): Promise<ActionResult> {
  const parsed = openingHourSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  if (parsed.data.startTime >= parsed.data.endTime) return { ok: false, error: "End time must be after start time" };
  await prisma.openingHour.create({ data: parsed.data });
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function deleteOpeningHour(id: string): Promise<ActionResult> {
  await prisma.openingHour.delete({ where: { id } });
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

// ---- Closures --------------------------------------------------------------
export async function addClosure(raw: unknown): Promise<ActionResult> {
  const parsed = closureSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  if (parsed.data.startDate > parsed.data.endDate) return { ok: false, error: "End date must be after start date" };
  const [ys, ms, ds] = parsed.data.startDate.split("-").map(Number);
  const [ye, me, de] = parsed.data.endDate.split("-").map(Number);
  await prisma.closure.create({
    data: {
      startDate: new Date(ys, ms - 1, ds, 0, 0, 0, 0),
      endDate: new Date(ye, me - 1, de, 0, 0, 0, 0),
      reason: parsed.data.reason || null,
    },
  });
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function deleteClosure(id: string): Promise<ActionResult> {
  await prisma.closure.delete({ where: { id } });
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

// ---- Customer / Settings ---------------------------------------------------
export async function updateCustomerNotes(id: string, notes: string): Promise<ActionResult> {
  await prisma.customer.update({ where: { id }, data: { notes: notes || null } });
  revalidatePath(`/dashboard/customers/${id}`);
  return { ok: true };
}

export async function updateSettings(raw: unknown): Promise<ActionResult> {
  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  const existing = await prisma.restaurantSetting.findFirst();
  const data = {
    name: parsed.data.name,
    tagline: parsed.data.tagline || null,
    phone: parsed.data.phone || null,
    whatsapp: parsed.data.whatsapp || null,
    address: parsed.data.address || null,
    email: parsed.data.email || null,
    currency: parsed.data.currency,
    turnDurationMinutes: parsed.data.turnDurationMinutes,
    bookingInterval: parsed.data.bookingInterval,
    seatingBuffer: parsed.data.seatingBuffer,
    maxPartySize: parsed.data.maxPartySize,
    maxReservationsPerSlot: parsed.data.maxReservationsPerSlot,
    maxCoversPerSlot: parsed.data.maxCoversPerSlot,
  };
  if (existing) {
    await prisma.restaurantSetting.update({ where: { id: existing.id }, data });
  } else {
    await prisma.restaurantSetting.create({ data });
  }
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  revalidatePath("/");
  return { ok: true };
}

// ---- Per-slot limits -------------------------------------------------------
export async function addSlotLimit(raw: unknown): Promise<ActionResult> {
  const parsed = slotLimitSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  await prisma.slotLimit.create({
    data: {
      dayOfWeek: parsed.data.dayOfWeek < 0 ? null : parsed.data.dayOfWeek,
      time: parsed.data.time,
      areaKind: parsed.data.areaKind === "global" ? null : parsed.data.areaKind,
      maxReservations: parsed.data.maxReservations,
      maxCovers: parsed.data.maxCovers ?? null,
    },
  });
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function deleteSlotLimit(id: string): Promise<ActionResult> {
  await prisma.slotLimit.delete({ where: { id } });
  revalidatePath("/dashboard/settings");
  return { ok: true };
}
