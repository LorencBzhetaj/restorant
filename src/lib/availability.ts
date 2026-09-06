import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { pad2, toDateKey } from "./format";

/**
 * RESTAURANT AVAILABILITY ENGINE
 * ------------------------------
 * A time is bookable for a party only when at least ONE active table:
 *   - has enough seats for the party (seats >= partySize)
 *   - sits inside an opening period, finishing before it closes (start + turn <= period end)
 *   - is not within a restaurant closure
 *   - is free for the whole seating, respecting a buffer between bookings
 *   - is not in the past
 *
 * The same engine powers the public booking, the floor map, and admin walk-ins.
 */

export interface Settings {
  turnDurationMinutes: number;
  bookingInterval: number;
  seatingBuffer: number;
  maxPartySize: number;
}

export interface TableAvailability {
  tableId: string;
  status: "free" | "occupied" | "tooSmall" | "inactive";
}

export interface TimeSlot {
  time: string; // "HH:mm"
  start: string; // ISO
  freeTables: number;
}

interface Period {
  start: number;
  end: number;
}

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export async function getSettings(): Promise<Settings> {
  const s = await prisma.restaurantSetting.findFirst();
  return {
    turnDurationMinutes: s?.turnDurationMinutes ?? 120,
    bookingInterval: s?.bookingInterval ?? 30,
    seatingBuffer: s?.seatingBuffer ?? 15,
    maxPartySize: s?.maxPartySize ?? 12,
  };
}

export interface SlotCaps {
  defaultMaxRes: number; // 0 = no cap
  defaultMaxCovers: number; // 0 = no cap
  limits: { dayOfWeek: number | null; time: string; areaKind: string | null; maxReservations: number; maxCovers: number | null }[];
}

export async function getSlotCaps(): Promise<SlotCaps> {
  const s = await prisma.restaurantSetting.findFirst();
  const limits = await prisma.slotLimit.findMany();
  return {
    defaultMaxRes: s?.maxReservationsPerSlot ?? 0,
    defaultMaxCovers: s?.maxCoversPerSlot ?? 0,
    limits: limits.map((l) => ({
      dayOfWeek: l.dayOfWeek,
      time: l.time,
      areaKind: l.areaKind,
      maxReservations: l.maxReservations,
      maxCovers: l.maxCovers,
    })),
  };
}

/**
 * Resolve caps for a weekday + start time, scoped to an area kind.
 * `areaKind = null` -> whole-restaurant cap (falls back to the default caps).
 * A specific area kind -> that area's cap (0 = no cap unless an override exists).
 * Day-specific overrides beat every-day ones.
 */
export function capForSlot(
  caps: SlotCaps,
  dayOfWeek: number,
  time: string,
  areaKind: string | null = null,
): { maxRes: number; maxCovers: number } {
  const matches = caps.limits
    .filter((l) => l.time === time && (l.areaKind ?? null) === (areaKind ?? null) && (l.dayOfWeek === null || l.dayOfWeek === dayOfWeek))
    .sort((a, b) => (a.dayOfWeek === null ? 1 : 0) - (b.dayOfWeek === null ? 1 : 0));
  const chosen = matches[0];
  if (chosen) return { maxRes: chosen.maxReservations, maxCovers: chosen.maxCovers ?? (areaKind === null ? caps.defaultMaxCovers : 0) };
  if (areaKind === null) return { maxRes: caps.defaultMaxRes, maxCovers: caps.defaultMaxCovers };
  return { maxRes: 0, maxCovers: 0 };
}

export interface AreaInfo {
  id: string;
  name: string;
  kind: string;
  isOpen: boolean;
  weatherDependent: boolean;
  priority: number;
}

export async function getAreas(): Promise<AreaInfo[]> {
  const areas = await prisma.area.findMany({ orderBy: [{ priority: "asc" }, { sortOrder: "asc" }] });
  return areas.map((a) => ({ id: a.id, name: a.name, kind: a.kind, isOpen: a.isOpen, weatherDependent: a.weatherDependent, priority: a.priority }));
}

export type RequestedArea = "indoor" | "outdoor" | "no_preference";

/** Which area ids are bookable for a request (open areas matching the kind). */
function bookableAreaIds(areas: AreaInfo[], requestedArea: RequestedArea): Set<string> {
  return new Set(
    areas.filter((a) => a.isOpen && (requestedArea === "no_preference" || a.kind === requestedArea)).map((a) => a.id),
  );
}

async function getPeriodsForDay(dayOfWeek: number): Promise<Period[]> {
  const hours = await prisma.openingHour.findMany({
    where: { dayOfWeek, isActive: true },
  });
  return hours
    .map((h) => ({ start: hhmmToMinutes(h.startTime), end: hhmmToMinutes(h.endTime) }))
    .sort((a, b) => a.start - b.start);
}

async function isClosedOn(dateKey: string): Promise<boolean> {
  const closures = await prisma.closure.findMany();
  return closures.some((c) => {
    const cs = toDateKey(new Date(c.startDate));
    const ce = toDateKey(new Date(c.endDate));
    return dateKey >= cs && dateKey <= ce;
  });
}

function buildDate(dateStr: string, minutes: number): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 0, minutes, 0, 0);
}

/** Per-table status at a specific date + time (drives the floor map). */
export async function getTableAvailabilityAt(params: {
  dateStr: string;
  time: string; // "HH:mm"
  partySize?: number;
  ignoreReservationId?: string;
}): Promise<TableAvailability[]> {
  const { dateStr, time, partySize } = params;
  const settings = await getSettings();
  const start = buildDate(dateStr, hhmmToMinutes(time));
  const end = new Date(start.getTime() + settings.turnDurationMinutes * 60000);
  const bufferMs = settings.seatingBuffer * 60000;

  const tables = await prisma.restaurantTable.findMany({ orderBy: { sortOrder: "asc" } });

  const dayStart = buildDate(dateStr, 0);
  const dayEnd = buildDate(dateStr, 24 * 60);
  const reservations = await prisma.reservation.findMany({
    where: {
      status: { notIn: ["Cancelled", "NoShow"] },
      id: params.ignoreReservationId ? { not: params.ignoreReservationId } : undefined,
      startDateTime: { lte: dayEnd },
      endDateTime: { gte: dayStart },
    },
    select: { tableId: true, startDateTime: true, endDateTime: true },
  });

  return tables.map((t) => {
    if (!t.isActive) return { tableId: t.id, status: "inactive" as const };
    if (partySize && t.seats < partySize) return { tableId: t.id, status: "tooSmall" as const };
    const clash = reservations.some(
      (r) =>
        r.tableId === t.id &&
        overlaps(
          start,
          end,
          new Date(new Date(r.startDateTime).getTime() - bufferMs),
          new Date(new Date(r.endDateTime).getTime() + bufferMs),
        ),
    );
    return { tableId: t.id, status: clash ? ("occupied" as const) : ("free" as const) };
  });
}

/** Available start times for a given date + party size, optionally by area. */
export async function getAvailableTimes(params: {
  dateStr: string;
  partySize: number;
  requestedArea?: RequestedArea;
  now?: Date;
}): Promise<TimeSlot[]> {
  const { dateStr, partySize } = params;
  const requestedArea: RequestedArea = params.requestedArea ?? "no_preference";
  const now = params.now ?? new Date();
  const settings = await getSettings();
  const turn = settings.turnDurationMinutes;
  const interval = settings.bookingInterval;
  const bufferMs = settings.seatingBuffer * 60000;

  const dayStart = buildDate(dateStr, 0);
  const dayOfWeek = dayStart.getDay();
  const dateKey = toDateKey(dayStart);

  if (await isClosedOn(dateKey)) return [];
  const periods = await getPeriodsForDay(dayOfWeek);
  if (periods.length === 0) return [];

  const areas = await getAreas();
  const openIds = bookableAreaIds(areas, requestedArea);
  const kindOfArea = new Map(areas.map((a) => [a.id, a.kind]));

  // Tables that fit + belong to a bookable (open, matching-kind) area.
  // Unassigned tables (no area) are only offered for "no preference".
  const tables = (await prisma.restaurantTable.findMany({ where: { isActive: true } })).filter(
    (t) =>
      t.seats >= partySize &&
      (t.areaId ? openIds.has(t.areaId) : requestedArea === "no_preference"),
  );
  if (tables.length === 0) return [];

  const dayEnd = buildDate(dateStr, 24 * 60);
  const reservations = await prisma.reservation.findMany({
    where: {
      status: { notIn: ["Cancelled", "NoShow"] },
      startDateTime: { lte: dayEnd },
      endDateTime: { gte: dayStart },
    },
    select: { tableId: true, startDateTime: true, endDateTime: true, partySize: true, table: { select: { areaId: true } } },
  });

  const caps = await getSlotCaps();
  const areaKindForCap = requestedArea === "no_preference" ? null : requestedArea;

  const slots: TimeSlot[] = [];
  for (const period of periods) {
    for (let t = period.start; t + turn <= period.end; t += interval) {
      const start = buildDate(dateStr, t);
      const end = new Date(start.getTime() + turn * 60000);
      if (start <= now) continue;
      const timeStr = `${pad2(Math.floor(t / 60))}:${pad2(t % 60)}`;

      let freeTables = 0;
      for (const table of tables) {
        const clash = reservations.some(
          (r) =>
            r.tableId === table.id &&
            overlaps(
              start,
              end,
              new Date(new Date(r.startDateTime).getTime() - bufferMs),
              new Date(new Date(r.endDateTime).getTime() + bufferMs),
            ),
        );
        if (!clash) freeTables++;
      }
      if (freeTables === 0) continue;

      const atSlot = reservations.filter((r) => new Date(r.startDateTime).getTime() === start.getTime());

      // Global (whole-restaurant) cap.
      const g = capForSlot(caps, dayOfWeek, timeStr, null);
      if (g.maxRes > 0) {
        const remaining = g.maxRes - atSlot.length;
        if (remaining <= 0) continue;
        freeTables = Math.min(freeTables, remaining);
      }
      if (g.maxCovers > 0 && atSlot.reduce((s, r) => s + r.partySize, 0) + partySize > g.maxCovers) continue;

      // Area cap (only when the guest picked a specific area).
      if (areaKindForCap) {
        const a = capForSlot(caps, dayOfWeek, timeStr, areaKindForCap);
        const inArea = atSlot.filter((r) => {
          const aid = r.table.areaId;
          return aid ? kindOfArea.get(aid) === areaKindForCap : false;
        });
        if (a.maxRes > 0) {
          const remaining = a.maxRes - inArea.length;
          if (remaining <= 0) continue;
          freeTables = Math.min(freeTables, remaining);
        }
        if (a.maxCovers > 0 && inArea.reduce((s, r) => s + r.partySize, 0) + partySize > a.maxCovers) continue;
      }

      slots.push({ time: timeStr, start: start.toISOString(), freeTables });
    }
  }
  return slots;
}

/**
 * Race-safe capacity check for the per-slot caps, run INSIDE the booking
 * transaction (after an advisory lock on the slot) so concurrent requests
 * for the last spot cannot exceed the cap.
 */
export async function slotHasCapacity(
  client: Prisma.TransactionClient,
  params: { dateStr: string; time: string; partySize: number; areaKind?: string | null; ignoreReservationId?: string },
): Promise<boolean> {
  const caps = await getSlotCaps();
  const dow = buildDate(params.dateStr, 0).getDay();
  const g = capForSlot(caps, dow, params.time, null);
  const a = params.areaKind ? capForSlot(caps, dow, params.time, params.areaKind) : { maxRes: 0, maxCovers: 0 };
  if (g.maxRes <= 0 && g.maxCovers <= 0 && a.maxRes <= 0 && a.maxCovers <= 0) return true;

  const start = buildDate(params.dateStr, hhmmToMinutes(params.time));
  const atSlot = await client.reservation.findMany({
    where: {
      status: { notIn: ["Cancelled", "NoShow"] },
      startDateTime: start,
      ...(params.ignoreReservationId ? { id: { not: params.ignoreReservationId } } : {}),
    },
    select: { partySize: true, table: { select: { area: { select: { kind: true } } } } },
  });

  // Global cap
  if (g.maxRes > 0 && atSlot.length >= g.maxRes) return false;
  if (g.maxCovers > 0 && atSlot.reduce((s, r) => s + r.partySize, 0) + params.partySize > g.maxCovers) return false;

  // Area cap
  if (params.areaKind && (a.maxRes > 0 || a.maxCovers > 0)) {
    const inArea = atSlot.filter((r) => r.table.area?.kind === params.areaKind);
    if (a.maxRes > 0 && inArea.length >= a.maxRes) return false;
    if (a.maxCovers > 0 && inArea.reduce((s, r) => s + r.partySize, 0) + params.partySize > a.maxCovers) return false;
  }
  return true;
}

/** Smallest suitable free table for a slot (used for "Any table"). */
export async function pickTableForSlot(params: {
  dateStr: string;
  time: string;
  partySize: number;
}): Promise<string | null> {
  const availability = await getTableAvailabilityAt(params);
  const freeIds = new Set(
    availability.filter((a) => a.status === "free").map((a) => a.tableId),
  );
  const tables = await prisma.restaurantTable.findMany({
    where: { id: { in: [...freeIds] }, seats: { gte: params.partySize } },
    orderBy: [{ seats: "asc" }, { sortOrder: "asc" }],
  });
  return tables[0]?.id ?? null;
}

/** Authoritative check used right before creating a reservation. */
export async function isTableBookable(params: {
  tableId: string;
  start: Date;
  partySize: number;
  now?: Date;
  ignoreReservationId?: string;
  allowPast?: boolean;
}): Promise<boolean> {
  const { tableId, start, partySize } = params;
  const now = params.now ?? new Date();
  const settings = await getSettings();
  const end = new Date(start.getTime() + settings.turnDurationMinutes * 60000);
  const bufferMs = settings.seatingBuffer * 60000;

  if (!params.allowPast && start <= now) return false;

  const table = await prisma.restaurantTable.findUnique({ where: { id: tableId } });
  if (!table || !table.isActive || table.seats < partySize) return false;

  const dateStr = toDateKey(start);
  const dayStart = buildDate(dateStr, 0);
  const dayOfWeek = dayStart.getDay();

  if (await isClosedOn(dateStr)) return false;

  const periods = await getPeriodsForDay(dayOfWeek);
  const startMin = start.getHours() * 60 + start.getMinutes();
  const endMin = startMin + settings.turnDurationMinutes;
  const insidePeriod = periods.some((p) => startMin >= p.start && endMin <= p.end);
  if (!insidePeriod) return false;

  const clash = await prisma.reservation.findFirst({
    where: {
      tableId,
      status: { notIn: ["Cancelled", "NoShow"] },
      id: params.ignoreReservationId ? { not: params.ignoreReservationId } : undefined,
      startDateTime: { lt: new Date(end.getTime() + bufferMs) },
      endDateTime: { gt: new Date(start.getTime() - bufferMs) },
    },
    select: { id: true },
  });
  return !clash;
}
