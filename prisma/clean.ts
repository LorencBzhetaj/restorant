import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Production clean: removes all demo reservations, customers and notifications,
 * but KEEPS tables, opening hours, closures and settings. Also ensures the
 * "max 4 reservations at 18:00" rule exists.
 */
async function main() {
  const n = await prisma.notification.deleteMany();
  const r = await prisma.reservation.deleteMany();
  const c = await prisma.customer.deleteMany();

  const existing = await prisma.slotLimit.findFirst({ where: { time: "18:00", dayOfWeek: null } });
  if (!existing) {
    await prisma.slotLimit.create({ data: { dayOfWeek: null, time: "18:00", maxReservations: 4 } });
  }

  const tables = await prisma.restaurantTable.count();
  const hours = await prisma.openingHour.count();
  console.log(`Cleaned: removed ${r.count} reservations, ${c.count} customers, ${n.count} notifications.`);
  console.log(`Kept: ${tables} tables, ${hours} opening-hour rows, settings + slot limits.`);
  console.log(`Slot rule ensured: max 4 reservations at 18:00 (every day).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
