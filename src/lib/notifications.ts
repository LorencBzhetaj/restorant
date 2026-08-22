import { prisma } from "./prisma";
import { NotificationType } from "./constants";
import { formatDateLong, formatTime } from "./format";

/**
 * MOCK / DEMO notification service (no real WhatsApp API).
 * Records a simulated notification and reports it as "Sent" so the demo can
 * show realistic confirmation / reminder activity. Swap the body of
 * `sendNotification` for a real provider in production.
 */

interface Ctx {
  customerName: string;
  restaurantName: string;
  tableName: string;
  partySize: number;
  start: Date;
}

function buildMessage(type: NotificationType, ctx: Ctx): string {
  const when = `${formatDateLong(ctx.start)} at ${formatTime(ctx.start)}`;
  const first = ctx.customerName.split(" ")[0];
  const guests = `${ctx.partySize} ${ctx.partySize === 1 ? "guest" : "guests"}`;
  switch (type) {
    case "BookingConfirmation":
      return `Hi ${first}! Your table at ${ctx.restaurantName} for ${guests} is confirmed for ${when}. We look forward to hosting you. 🍽️`;
    case "Reminder24h":
      return `Reminder: your reservation at ${ctx.restaurantName} for ${guests} is tomorrow, ${when}.`;
    case "Reminder2h":
      return `See you soon, ${first}! Your table for ${guests} at ${ctx.restaurantName} is at ${formatTime(ctx.start)}.`;
    case "Cancellation":
      return `Hi ${first}, your reservation on ${when} at ${ctx.restaurantName} has been cancelled. We hope to welcome you another time.`;
    case "Reschedule":
      return `Hi ${first}, your reservation at ${ctx.restaurantName} has been moved to ${when}.`;
    case "Completed":
      return `Thank you for dining with us, ${first}! We hope you enjoyed your evening at ${ctx.restaurantName}. 🍷`;
    case "NoShow":
      return `Hi ${first}, we missed you for your reservation on ${when}. Get in touch to rebook anytime.`;
  }
}

export async function sendNotification(reservationId: string, type: NotificationType) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { customer: true, table: true },
  });
  if (!reservation) return null;

  const settings = await prisma.restaurantSetting.findFirst();
  const recipient = reservation.customer.whatsappNumber || reservation.customer.phone || "";

  const message = buildMessage(type, {
    customerName: `${reservation.customer.firstName} ${reservation.customer.lastName}`,
    restaurantName: settings?.name ?? "Terrazza",
    tableName: reservation.table.name,
    partySize: reservation.partySize,
    start: new Date(reservation.startDateTime),
  });

  return prisma.notification.create({
    data: { reservationId, type, channel: "WhatsApp", status: "Sent", message, recipient },
  });
}
