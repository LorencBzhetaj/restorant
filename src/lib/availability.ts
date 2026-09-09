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

export interface AreaClosureRange {
  areaId: string;
  startDateTime: Date;
  endDateTime: Date;
}

/** Pure: is `areaId` closed for any part of [slotStart, slotEnd)? */
export function areaClosedAtSlot(
  closures: AreaClosureRange[],
  areaId: string | null,
  slotStart: Date,
  slotEnd: Date,
): boolean {
  if (!areaId) return false;
  return closures.some(
    (c) => c.areaId === areaId && overlaps(slotStart, slotEnd, new Date(c.startDateTime), new Date(c.endDateTime)),
  );
}

/** Temporary area closures overlapping [rangeStart, rangeEnd). */
async function getAreaClosuresInRange(rangeStart: Date, rangeEnd: Date): Promise<AreaClosureRange[]> {
  const rows = await prisma.areaClosure.findMany({
    where: { startDateTime: { lt: rangeEnd }, endDateTime: { gt: rangeStart } },
    select: { areaId: true, startDateTime: true, endDateTime: true },
  });
  return rows;
}

type DbClient = Prisma.TransactionClient | typeof prisma;

export interface Occupancy {
  tableId: string;
  start: Date;
  end: Date;
}

/**
 * Every (tableId, start, end) a table is held for by an active reservation in
 * the window. A combined-table booking contributes one row per member table, so
 * a single booking correctly blocks ALL of its tables. This is the multi-table
 * source of truth (via ReservationTable), replacing the old single-tableId scan.
 */
async function getOccupanciesInRange(
  client: DbClient,
  rangeStart: Date,
  rangeEnd: Date,
  ignoreReservationId?: string,
): Promise<Occupancy[]> {
  const rows = await client.reservationTable.findMany({
    where: {
      reservation: {
        status: { notIn: ["Cancelled", "NoShow"] },
        startDateTime: { lte: rangeEnd },
        endDateTime: { gte: rangeStart },
        ...(ignoreReservationId ? { id: { not: ignoreReservationId } } : {}),
      },
    },
    select: { tableId: true, reservation: { select: { startDateTime: true, endDateTime: true } } },
  });
  return rows.map((r) => ({ tableId: r.tableId, start: r.reservation.startDateTime, end: r.reservation.endDateTime }));
}

/** Does any active reservation hold `tableId` across [start, end) (buffer already applied)? */
function tableClashes(occupancies: Occupancy[], tableId: string, start: Date, end: Date, bufferMs: number): boolean {
  return occupancies.some(
    (o) =>
      o.tableId === tableId &&
      overlaps(start, end, new Date(new Date(o.start).getTime() - bufferMs), new Date(new Date(o.end).getTime() + bufferMs)),
  );
}

export interface EligibleCombination {
  id: string;
  areaId: string;
  areaKind: string | null;
  maxSeats: number;
  minSeats: number | null;
  priority: number;
  memberTableIds: string[];
}

/**
 * Active combinations that could seat `partySize` in a bookable area, validated:
 * at least two members, every member an active table, all members in the combo's
 * own area. Sorted smallest-capacity-then-priority so the tightest fit wins.
 */
async function getEligibleCombinations(
  client: DbClient,
  partySize: number,
  openAreaIds: Set<string>,
): Promise<EligibleCombination[]> {
  const areas = await client.area.findMany({ select: { id: true, kind: true } });
  const kindOf = new Map(areas.map((a) => [a.id, a.kind]));
  const combos = await client.tableCombination.findMany({
    where: { isActive: true },
    select: {
      id: true,
      areaId: true,
      maxSeats: true,
      minSeats: true,
      priority: true,
      members: { select: { table: { select: { id: true, isActive: true, areaId: true } } } },
    },
  });
  const result: EligibleCombination[] = [];
  for (const c of combos) {
    if (!openAreaIds.has(c.areaId)) continue;
    if (c.maxSeats < partySize) continue;
    if (c.minSeats != null && c.minSeats > partySize) continue;
    const members = c.members.map((m) => m.table);
    if (members.length < 2) continue; // a combination needs at least two tables
    if (!members.every((t) => t.isActive)) continue; // every member must be active
    if (!members.every((t) => t.areaId === c.areaId)) continue; // members share the combo's area
    result.push({
      id: c.id,
      areaId: c.areaId,
      areaKind: kindOf.get(c.areaId) ?? null,
      maxSeats: c.maxSeats,
      minSeats: c.minSeats,
      priority: c.priority,
      memberTableIds: members.map((t) => t.id),
    });
  }
  result.sort((a, b) => a.maxSeats - b.maxSeats || a.priority - b.priority);
  return result;
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
  const occupancies = await getOccupanciesInRange(prisma, dayStart, dayEnd, params.ignoreReservationId);

  return tables.map((t) => {
    if (!t.isActive) return { tableId: t.id, status: "inactive" as const };
    if (partySize && t.seats < partySize) return { tableId: t.id, status: "tooSmall" as const };
    const clash = tableClashes(occupancies, t.id, start, end, bufferMs);
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
  const closures = await getAreaClosuresInRange(dayStart, dayEnd);
  const occupancies = await getOccupanciesInRange(prisma, dayStart, dayEnd);

  // Configured combinations that could seat this party, in a bookable area, with
  // every member an active table. Combinations widen availability for parties no
  // single free table can seat; the engine never invents groupings.
  const combos = await getEligibleCombinations(prisma, partySize, openIds);

  const slots: TimeSlot[] = [];
  for (const period of periods) {
    for (let t = period.start; t + turn <= period.end; t += interval) {
      const start = buildDate(dateStr, t);
      const end = new Date(start.getTime() + turn * 60000);
      if (start <= now) continue;
      const timeStr = `${pad2(Math.floor(t / 60))}:${pad2(t % 60)}`;

      let freeTables = 0;
      for (const table of tables) {
        // Skip tables whose area has a temporary closure covering this slot.
        if (areaClosedAtSlot(closures, table.areaId, start, end)) continue;
        if (!tableClashes(occupancies, table.id, start, end, bufferMs)) freeTables++;
      }
      // Add combinations whose members are all free and whose area is open here.
      for (const c of combos) {
        if (areaClosedAtSlot(closures, c.areaId, start, end)) continue;
        if (c.memberTableIds.every((id) => !tableClashes(occupancies, id, start, end, bufferMs))) freeTables++;
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

export interface AssignmentResult {
  tableIds: string[]; // one table for a single booking; several for a combination
  areaKind: string | null;
}

/**
 * Choose the table(s) for a booking INSIDE the transaction, race-safe.
 *
 * Locking: acquires a per-table advisory lock for every candidate table in
 * ascending id order (deterministic → deadlock-free), BEFORE reading occupancy,
 * so two concurrent bookings can never be assigned the same member table. The
 * caller still holds the per-slot lock first (for cap correctness); this only
 * ever adds table locks after it, preserving a single global lock order.
 *
 * Selection: a concrete requested table is used only if it is active, fits and
 * is free. For "any", a single smallest suitable free table is preferred; only
 * when no single table fits/frees is the smallest available configured
 * combination used (respecting priority on ties). Area closures and permanent
 * area status apply to both.
 */
export async function assignTablesTx(
  tx: Prisma.TransactionClient,
  p: {
    requestedTableId: string;
    requestedArea: RequestedArea;
    partySize: number;
    start: Date;
    end: Date;
    bufferMs: number;
    ignoreReservationId?: string;
  },
): Promise<AssignmentResult | null> {
  const areas = await tx.area.findMany();
  const openIds = new Set(
    areas.filter((a) => a.isOpen && (p.requestedArea === "no_preference" || a.kind === p.requestedArea)).map((a) => a.id),
  );
  const kindOf = new Map(areas.map((a) => [a.id, a.kind]));
  const prioOf = new Map(areas.map((a) => [a.id, a.priority]));

  const singleTables = await tx.restaurantTable.findMany({
    where: { isActive: true },
    select: { id: true, seats: true, sortOrder: true, areaId: true },
  });
  const combos = await getEligibleCombinations(tx, p.partySize, openIds);

  // Candidate set to lock (config only — a few extra locks are harmless).
  const candidateIds = new Set<string>();
  if (p.requestedTableId !== "any") {
    candidateIds.add(p.requestedTableId);
  } else {
    for (const t of singleTables) {
      if (t.seats < p.partySize) continue;
      if (t.areaId ? openIds.has(t.areaId) : p.requestedArea === "no_preference") candidateIds.add(t.id);
    }
    for (const c of combos) for (const id of c.memberTableIds) candidateIds.add(id);
  }
  // Deterministic sorted order prevents deadlocks between concurrent bookings.
  for (const id of [...candidateIds].sort()) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`tbl:${id}`})::bigint)`;
  }

  // Read occupancy + closures AFTER the locks are held.
  const occ = await getOccupanciesInRange(
    tx,
    new Date(p.start.getTime() - p.bufferMs),
    new Date(p.end.getTime() + p.bufferMs),
    p.ignoreReservationId,
  );
  const closures = await tx.areaClosure.findMany({
    where: { startDateTime: { lt: p.end }, endDateTime: { gt: p.start } },
    select: { areaId: true, startDateTime: true, endDateTime: true },
  });
  const isFree = (tableId: string) => !tableClashes(occ, tableId, p.start, p.end, p.bufferMs);

  // Concrete table (staff transfer / specific pick) → single table only.
  if (p.requestedTableId !== "any") {
    const t = singleTables.find((x) => x.id === p.requestedTableId);
    if (!t || t.seats < p.partySize) return null;
    if (areaClosedAtSlot(closures, t.areaId, p.start, p.end)) return null;
    if (!isFree(t.id)) return null;
    return { tableIds: [t.id], areaKind: t.areaId ? kindOf.get(t.areaId) ?? null : null };
  }

  // Prefer a single smallest suitable free table.
  const eligibleSingles = singleTables
    .filter((t) => t.seats >= p.partySize)
    .filter((t) => (t.areaId ? openIds.has(t.areaId) : p.requestedArea === "no_preference"))
    .filter((t) => !areaClosedAtSlot(closures, t.areaId, p.start, p.end))
    .sort(
      (a, b) =>
        (prioOf.get(a.areaId ?? "") ?? 99) - (prioOf.get(b.areaId ?? "") ?? 99) ||
        a.seats - b.seats ||
        a.sortOrder - b.sortOrder,
    );
  const single = eligibleSingles.find((t) => isFree(t.id));
  if (single) {
    return { tableIds: [single.id], areaKind: single.areaId ? kindOf.get(single.areaId) ?? null : null };
  }

  // No single table fits/free → smallest available configured combination.
  for (const c of combos) {
    if (areaClosedAtSlot(closures, c.areaId, p.start, p.end)) continue;
    if (c.memberTableIds.every(isFree)) return { tableIds: c.memberTableIds, areaKind: c.areaKind };
  }
  return null;
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

  // Temporary area closure covering this window?
  if (table.areaId) {
    const closures = await getAreaClosuresInRange(start, end);
    if (areaClosedAtSlot(closures, table.areaId, start, end)) return false;
  }

  const clash = await prisma.reservationTable.findFirst({
    where: {
      tableId,
      reservation: {
        status: { notIn: ["Cancelled", "NoShow"] },
        id: params.ignoreReservationId ? { not: params.ignoreReservationId } : undefined,
        startDateTime: { lt: new Date(end.getTime() + bufferMs) },
        endDateTime: { gt: new Date(start.getTime() - bufferMs) },
      },
    },
    select: { id: true },
  });
  return !clash;
}
