import type { PrismaClient } from "@prisma/client";

/**
 * Villa Gjeçaj configuration bootstrap — IDEMPOTENT and NON-DESTRUCTIVE.
 *
 * Ensures the minimum seating configuration exists:
 *   - an Indoor area and an Outdoor area (created only if none of that kind exists);
 *   - the peak-time global cap (18:00, whole restaurant, every day) = 4 bookings.
 *
 * It never deletes or resets reservations, customers, areas, tables, closures or
 * settings, and never touches unrelated SlotLimit rows (a different time, a
 * day-specific rule, or an area-specific 18:00 rule are all left as-is).
 *
 * The core logic takes a Prisma client so it can be exercised in tests; the CLI
 * wrapper (prisma/bootstrap-villa-gjecaj.ts) supplies the real client and the
 * production-safety confirmation guard. No credentials live here.
 */

export const VILLA_GJECAJ_PEAK_TIME = "18:00";
export const VILLA_GJECAJ_PEAK_MAX = 4;

export type BootstrapStatus = "created" | "updated" | "already-correct";

export interface BootstrapAction {
  record: string;
  status: BootstrapStatus;
  detail: string;
}

const AREA_DEFS = [
  { kind: "indoor", name: "Indoor", weatherDependent: false, priority: 1, sortOrder: 1 },
  { kind: "outdoor", name: "Outdoor", weatherDependent: true, priority: 0, sortOrder: 2 },
] as const;

export async function bootstrapVillaGjecaj(prisma: PrismaClient): Promise<BootstrapAction[]> {
  const actions: BootstrapAction[] = [];

  // --- Areas: create one per kind only if that kind does not already exist. ---
  for (const def of AREA_DEFS) {
    const existing = await prisma.area.findFirst({ where: { kind: def.kind } });
    if (existing) {
      actions.push({
        record: `Area (${def.kind})`,
        status: "already-correct",
        detail: `kept existing "${existing.name}"`,
      });
    } else {
      const created = await prisma.area.create({
        data: {
          name: def.name,
          kind: def.kind,
          isOpen: true,
          weatherDependent: def.weatherDependent,
          priority: def.priority,
          sortOrder: def.sortOrder,
        },
      });
      actions.push({ record: `Area (${def.kind})`, status: "created", detail: `"${created.name}"` });
    }
  }

  // --- Global 18:00 cap: dayOfWeek null = every day, areaKind null = whole restaurant. ---
  // The where-clause deliberately pins BOTH nulls so day-specific or
  // area-specific 18:00 rules are never matched, updated or duplicated.
  //
  // There is no DB unique constraint that could prevent duplicate global rows
  // (Postgres treats NULLs as distinct, so a plain unique index would not help),
  // so we detect duplicates explicitly and REFUSE to act rather than silently
  // updating just one of them and leaving conflicting caps behind.
  const existingLimits = await prisma.slotLimit.findMany({
    where: { time: VILLA_GJECAJ_PEAK_TIME, areaKind: null, dayOfWeek: null },
    orderBy: { id: "asc" },
  });
  if (existingLimits.length > 1) {
    const ids = existingLimits.map((l) => `${l.id}(max=${l.maxReservations})`).join(", ");
    throw new Error(
      `Found ${existingLimits.length} duplicate global ${VILLA_GJECAJ_PEAK_TIME} SlotLimit rows: ${ids}. ` +
        `Refusing to update only one. Remove the extras in the dashboard (Settings → slot limits) ` +
        `so exactly one global ${VILLA_GJECAJ_PEAK_TIME} rule remains, then re-run the bootstrap.`,
    );
  }
  const existingLimit = existingLimits[0] ?? null;

  const limitLabel = `SlotLimit ${VILLA_GJECAJ_PEAK_TIME} (global, every day)`;
  if (!existingLimit) {
    await prisma.slotLimit.create({
      data: {
        time: VILLA_GJECAJ_PEAK_TIME,
        areaKind: null,
        dayOfWeek: null,
        maxReservations: VILLA_GJECAJ_PEAK_MAX,
        maxCovers: null,
      },
    });
    actions.push({ record: limitLabel, status: "created", detail: `maxBookings=${VILLA_GJECAJ_PEAK_MAX}` });
  } else if (existingLimit.maxReservations !== VILLA_GJECAJ_PEAK_MAX) {
    await prisma.slotLimit.update({
      where: { id: existingLimit.id },
      data: { maxReservations: VILLA_GJECAJ_PEAK_MAX },
    });
    actions.push({
      record: limitLabel,
      status: "updated",
      detail: `maxBookings ${existingLimit.maxReservations} → ${VILLA_GJECAJ_PEAK_MAX}`,
    });
  } else {
    actions.push({ record: limitLabel, status: "already-correct", detail: `maxBookings=${VILLA_GJECAJ_PEAK_MAX}` });
  }

  return actions;
}
