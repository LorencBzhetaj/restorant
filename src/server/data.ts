import "server-only";
import { prisma } from "@/lib/prisma";
import { getRestaurant } from "@/lib/settings";
import { toDateKey } from "@/lib/format";

export { getRestaurant };

/** Estimated average spend per guest, used for demo revenue figures. */
export const AVG_SPEND_PER_COVER = 35;

export async function getActiveTables() {
  return prisma.restaurantTable.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getAllTables() {
  return prisma.restaurantTable.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { reservations: true } } },
  });
}

export async function getCustomers() {
  const customers = await prisma.customer.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      reservations: { select: { status: true, partySize: true, startDateTime: true } },
    },
  });
  return customers.map((c) => {
    const completed = c.reservations.filter((r) => r.status === "Completed");
    const lastVisit = completed
      .map((r) => r.startDateTime)
      .sort((a, b) => b.getTime() - a.getTime())[0];
    const covers = completed.reduce((s, r) => s + r.partySize, 0);
    return {
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      phone: c.phone,
      email: c.email,
      total: c.reservations.length,
      completed: completed.length,
      covers,
      totalSpent: covers * AVG_SPEND_PER_COVER,
      lastVisit: lastVisit ?? null,
    };
  });
}

export async function getCustomerDetail(id: string) {
  const c = await prisma.customer.findUnique({
    where: { id },
    include: {
      reservations: {
        orderBy: { startDateTime: "desc" },
        include: { table: true },
      },
    },
  });
  if (!c) return null;

  const completed = c.reservations.filter((r) => r.status === "Completed");
  const counter = <T extends string>(items: T[]) => {
    const map = new Map<T, number>();
    for (const i of items) map.set(i, (map.get(i) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  };
  const covers = completed.reduce((s, r) => s + r.partySize, 0);

  return {
    ...c,
    stats: {
      total: c.reservations.length,
      completed: completed.length,
      cancelled: c.reservations.filter((r) => r.status === "Cancelled").length,
      noShows: c.reservations.filter((r) => r.status === "NoShow").length,
      covers,
      totalSpent: covers * AVG_SPEND_PER_COVER,
      lastVisit:
        completed.map((r) => r.startDateTime).sort((a, b) => b.getTime() - a.getTime())[0] ?? null,
      favoriteSection: counter(completed.map((r) => r.table.section)),
      avgPartySize: completed.length ? Math.round((covers / completed.length) * 10) / 10 : 0,
    },
  };
}

export async function getReservations() {
  return prisma.reservation.findMany({
    orderBy: { startDateTime: "desc" },
    include: {
      customer: true,
      table: true,
      notifications: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function getReservationsInRange(start: Date, end: Date) {
  return prisma.reservation.findMany({
    where: { startDateTime: { gte: start, lte: end }, status: { not: "Cancelled" } },
    orderBy: { startDateTime: "asc" },
    include: { customer: true, table: true },
  });
}

export async function getOpeningHours() {
  return prisma.openingHour.findMany({ orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] });
}

export async function getClosures() {
  return prisma.closure.findMany({ orderBy: { startDate: "asc" } });
}

export async function getDashboardData() {
  const settings = await getRestaurant();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [all, tables] = await Promise.all([
    prisma.reservation.findMany({ include: { table: true, customer: true } }),
    prisma.restaurantTable.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  const isToday = (d: Date) => d >= todayStart && d <= todayEnd;
  const active = (s: string) => s !== "Cancelled" && s !== "NoShow";
  const todays = all.filter((r) => isToday(r.startDateTime));

  const coversOf = (list: typeof all) => list.reduce((s, r) => s + r.partySize, 0);
  const completedToday = todays.filter((r) => r.status === "Completed");
  const coversToday = coversOf(todays.filter((r) => active(r.status)));

  const monthCompleted = all.filter((r) => r.status === "Completed" && r.startDateTime >= monthStart);

  const days: { label: string; revenue: number; appointments: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(todayStart);
    d.setDate(todayStart.getDate() - i);
    const key = toDateKey(d);
    const dayRes = all.filter((r) => toDateKey(r.startDateTime) === key);
    const covers = dayRes.filter((r) => r.status === "Completed").reduce((s, r) => s + r.partySize, 0);
    days.push({
      label: `${d.getDate()}/${d.getMonth() + 1}`,
      revenue: covers * AVG_SPEND_PER_COVER,
      appointments: dayRes.filter((r) => active(r.status)).length,
    });
  }

  // Covers by section (completed)
  const sections = [...new Set(tables.map((t) => t.section))];
  const sectionCounts = sections
    .map((name) => ({
      name,
      count: all.filter((r) => r.status === "Completed" && r.table.section === name).reduce((s, r) => s + r.partySize, 0),
    }))
    .sort((a, b) => b.count - a.count);

  // Party-size distribution (all active)
  const partyCounts = [2, 4, 6, 8].map((size) => {
    const label = size === 8 ? "7-8" : size === 6 ? "5-6" : size === 4 ? "3-4" : "1-2";
    const lo = size - 1, hi = size;
    return {
      name: label,
      count: all.filter((r) => active(r.status) && r.partySize >= lo && r.partySize <= hi).length,
    };
  });

  const upcomingList = all
    .filter((r) => r.status === "Confirmed" && r.startDateTime >= now)
    .sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime())
    .slice(0, 6);

  return {
    settings,
    cards: {
      todayCount: todays.filter((r) => active(r.status)).length,
      coversToday,
      upcoming: all.filter((r) => r.status === "Confirmed" && r.startDateTime >= now).length,
      completedToday: completedToday.length,
      cancelledToday: todays.filter((r) => r.status === "Cancelled").length,
      noShowToday: todays.filter((r) => r.status === "NoShow").length,
      revenueToday: coversOf(completedToday) * AVG_SPEND_PER_COVER,
      revenueMonth: coversOf(monthCompleted) * AVG_SPEND_PER_COVER,
    },
    days,
    sectionCounts,
    partyCounts,
    upcomingList,
    todays: todays.sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime()),
  };
}
