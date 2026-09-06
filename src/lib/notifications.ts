import { prisma } from "./prisma";
import { NotificationType } from "./constants";
import { formatDateLong, formatTime } from "./format";
import { sendEmail, appUrl, isEmailConfigured, type EmailMessage } from "./email";

/**
 * Reservation notifications — delivered by EMAIL to both the guest and the
 * restaurant owner. Real SMTP is used when configured (see lib/email.ts);
 * otherwise the app runs in demo mode and records the notification without
 * sending. Guest confirmation emails include a one-click cancel link.
 */

const BRAND = "#b85c38";

interface Ctx {
  customerName: string;
  customerEmail: string | null;
  ownerEmail: string | null;
  restaurantName: string;
  address: string;
  tableName: string;
  partySize: number;
  phone: string;
  start: Date;
  cancelUrl: string;
  notes: string | null;
  area: string | null;
  weatherDependent: boolean;
}

function layout(brand: string, title: string, bodyHtml: string, footer?: string): string {
  return `
  <div style="background:#f6f5f3;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#1c1917">
    <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee">
      <div style="background:${BRAND};padding:20px 24px">
        <span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:.5px">${brand}</span>
      </div>
      <div style="padding:24px">
        <h1 style="margin:0 0 12px;font-size:20px">${title}</h1>
        ${bodyHtml}
      </div>
      ${footer ? `<div style="padding:16px 24px;border-top:1px solid #eee;color:#78716c;font-size:12px">${footer}</div>` : ""}
    </div>
  </div>`;
}

function detailsTable(ctx: Ctx): string {
  const rows: [string, string][] = [
    ["Guest", ctx.customerName],
    ["Party", `${ctx.partySize} ${ctx.partySize === 1 ? "guest" : "guests"}`],
    ["Date", formatDateLong(ctx.start)],
    ["Time", formatTime(ctx.start)],
    ["Table", ctx.tableName],
    ...(ctx.area ? [["Area", ctx.area] as [string, string]] : []),
    ...(ctx.notes ? [["Special requests", ctx.notes] as [string, string]] : []),
  ];
  return `<table style="width:100%;border-collapse:collapse;font-size:14px;margin:8px 0 20px">
    ${rows
      .map(
        ([k, v]) =>
          `<tr><td style="padding:6px 0;color:#78716c">${k}</td><td style="padding:6px 0;text-align:right;font-weight:600">${v}</td></tr>`,
      )
      .join("")}
  </table>`;
}

function button(url: string, label: string, color = BRAND): string {
  return `<a href="${url}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:8px">${label}</a>`;
}

/** Returns the email for each recipient (or null when not applicable). */
function buildEmails(
  type: NotificationType,
  ctx: Ctx,
): { customer: EmailMessage | null; owner: EmailMessage | null } {
  const first = ctx.customerName.split(" ")[0];
  const when = `${formatDateLong(ctx.start)} at ${formatTime(ctx.start)}`;
  const details = detailsTable(ctx);

  const mk = (to: string | null, subject: string, inner: string, footer?: string): EmailMessage | null =>
    to ? { to, subject, html: layout(ctx.restaurantName, subject, inner, footer), text: `${subject}\n\n${ctx.customerName} · ${ctx.partySize} guests · ${when} · ${ctx.tableName}` } : null;

  switch (type) {
    case "BookingConfirmation":
      return {
        customer: mk(
          ctx.customerEmail,
          `Your table at ${ctx.restaurantName} is confirmed`,
          `<p style="font-size:14px;color:#44403c">Hi ${first}, thanks for booking with us. Here are your details:</p>
           ${details}
           ${
             ctx.weatherDependent
               ? `<p style="font-size:13px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 12px;margin:0 0 16px">Your reservation is for the <strong>outdoor</strong> area. In case of unfavourable weather, we will contact you to confirm availability indoors.</p>`
               : ""
           }
           <p style="font-size:14px;color:#44403c;margin-bottom:16px">Plans changed? You can cancel your reservation with one click:</p>
           ${button(ctx.cancelUrl, "Cancel my reservation", "#be123c")}`,
          `${ctx.restaurantName}${ctx.address ? ` · ${ctx.address}` : ""}${ctx.phone ? ` · ${ctx.phone}` : ""}`,
        ),
        owner: mk(
          ctx.ownerEmail,
          `New reservation — ${ctx.customerName}, ${ctx.partySize}p, ${formatTime(ctx.start)}`,
          `<p style="font-size:14px;color:#44403c">A new reservation just came in.</p>
           ${details}
           <p style="font-size:14px;color:#44403c">Contact: ${ctx.phone}${ctx.customerEmail ? ` · ${ctx.customerEmail}` : ""}</p>`,
        ),
      };
    case "Cancellation":
      return {
        customer: mk(
          ctx.customerEmail,
          `Your reservation at ${ctx.restaurantName} was cancelled`,
          `<p style="font-size:14px;color:#44403c">Hi ${first}, your reservation for ${when} has been cancelled. We hope to welcome you another time.</p>${details}`,
        ),
        owner: mk(
          ctx.ownerEmail,
          `Reservation cancelled — ${ctx.customerName}, ${formatTime(ctx.start)}`,
          `<p style="font-size:14px;color:#44403c">This reservation has been cancelled and the table is now free.</p>${details}`,
        ),
      };
    case "Reschedule":
      return {
        customer: mk(
          ctx.customerEmail,
          `Your reservation at ${ctx.restaurantName} was updated`,
          `<p style="font-size:14px;color:#44403c">Hi ${first}, your reservation has been moved. New details:</p>${details}${button(ctx.cancelUrl, "Cancel my reservation", "#be123c")}`,
        ),
        owner: mk(
          ctx.ownerEmail,
          `Reservation rescheduled — ${ctx.customerName}`,
          `<p style="font-size:14px;color:#44403c">A reservation was rescheduled.</p>${details}`,
        ),
      };
    case "Completed":
      return {
        customer: mk(
          ctx.customerEmail,
          `Thanks for dining at ${ctx.restaurantName}`,
          `<p style="font-size:14px;color:#44403c">Hi ${first}, thank you for visiting us. We hope to see you again soon!</p>`,
        ),
        owner: null,
      };
    case "NoShow":
      return {
        customer: null,
        owner: mk(
          ctx.ownerEmail,
          `No-show — ${ctx.customerName}, ${formatTime(ctx.start)}`,
          `<p style="font-size:14px;color:#44403c">This guest did not arrive for their reservation.</p>${details}`,
        ),
      };
    default:
      return { customer: null, owner: null };
  }
}

/** Send a reservation notification to the guest and/or owner and record it. */
export async function sendNotification(reservationId: string, type: NotificationType) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { customer: true, table: { include: { area: true } } },
  });
  if (!reservation) return null;

  const settings = await prisma.restaurantSetting.findFirst();
  const area = reservation.table.area;
  const ctx: Ctx = {
    customerName: `${reservation.customer.firstName} ${reservation.customer.lastName}`.trim(),
    customerEmail: reservation.customer.email,
    ownerEmail: settings?.email ?? null,
    restaurantName: settings?.name ?? "Gjeçaj Alpine Restaurant Cuisine",
    address: settings?.address ?? "",
    tableName: `${reservation.table.name} · ${reservation.table.section}`,
    partySize: reservation.partySize,
    phone: reservation.customer.phone,
    start: new Date(reservation.startDateTime),
    cancelUrl: `${appUrl()}/r/${reservation.cancelToken}`,
    notes: reservation.notes,
    area: area?.name ?? null,
    weatherDependent: area?.kind === "outdoor" && (area?.weatherDependent ?? false),
  };

  const emails = buildEmails(type, ctx);
  const demo = !isEmailConfigured();

  for (const [recipientKind, msg] of [
    ["customer", emails.customer],
    ["owner", emails.owner],
  ] as const) {
    if (!msg) continue;
    const result = await sendEmail(msg);
    await prisma.notification.create({
      data: {
        reservationId,
        type,
        channel: "Email",
        status: result.delivered ? "Sent" : demo ? "Sent" : "Failed",
        message: `${recipientKind === "owner" ? "Owner" : "Guest"}: ${msg.subject}`,
        recipient: msg.to,
      },
    });
  }
  return true;
}
