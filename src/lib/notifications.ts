import { prisma } from "./prisma";
import { NotificationType } from "./constants";
import { formatDateLong, formatTime } from "./format";
import { sendEmail, appUrl, isEmailConfigured, type EmailMessage } from "./email";
import { resolveLogoUrl } from "./branding";

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
  reminderText: string | null;
  logoUrl: string | null;
}

function layout(brand: string, logoUrl: string | null, title: string, bodyHtml: string, footer?: string): string {
  // Logo only when it's an absolute https URL (email-client compatible, no
  // base64). The brand name is the alt text, so the header stays readable when
  // images are blocked. Constrained height avoids oversized logos.
  const header =
    logoUrl && /^https:\/\//i.test(logoUrl)
      ? `<img src="${logoUrl}" alt="${brand}" height="48" style="max-height:48px;width:auto;display:inline-block;border:0;outline:none" />`
      : `<span style="color:#fff;font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:600;letter-spacing:.3px">${brand}</span>`;
  return `
  <div style="background:#f4f1ee;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#1c1917">
    <div style="max-width:540px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #eae6e2;box-shadow:0 1px 3px rgba(60,40,20,0.06)">
      <div style="background:${BRAND};padding:26px 24px;text-align:center">
        ${header}
      </div>
      <div style="height:3px;background:linear-gradient(90deg,#d98b63,${BRAND},#9c4a2a)"></div>
      <div style="padding:30px 28px">
        <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:23px;font-weight:600;line-height:1.25;color:#1c1917">${title}</h1>
        ${bodyHtml}
      </div>
      ${footer ? `<div style="padding:18px 28px;border-top:1px solid #f0ece8;color:#8a827b;font-size:12px;text-align:center;line-height:1.6">${footer}</div>` : ""}
    </div>
    <p style="max-width:540px;margin:16px auto 0;text-align:center;color:#b3aaa2;font-size:11px;letter-spacing:.3px">${brand}</p>
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
  return `<table style="width:100%;border-collapse:collapse;font-size:14px;margin:6px 0 22px;background:#faf8f6;border:1px solid #f0ece8;border-radius:12px">
    ${rows
      .map(
        ([k, v], i) =>
          `<tr><td style="padding:11px 16px;color:#8a827b;${i > 0 ? "border-top:1px solid #f0ece8" : ""}">${k}</td><td style="padding:11px 16px;text-align:right;font-weight:600;color:#292524;${i > 0 ? "border-top:1px solid #f0ece8" : ""}">${v}</td></tr>`,
      )
      .join("")}
  </table>`;
}

function button(url: string, label: string, color = BRAND): string {
  return `<a href="${url}" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:13px 26px;border-radius:10px;box-shadow:0 1px 2px rgba(60,40,20,0.15)">${label}</a>`;
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
    to ? { to, subject, html: layout(ctx.restaurantName, ctx.logoUrl, subject, inner, footer), text: `${subject}\n\n${ctx.customerName} · ${ctx.partySize} guests · ${when} · ${ctx.tableName}` } : null;

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
    case "Reminder24h":
    case "Reminder2h": {
      const lead = type === "Reminder24h" ? "tomorrow" : "in a couple of hours";
      const extra = ctx.reminderText
        ? `<p style="font-size:14px;color:#44403c">${ctx.reminderText}</p>`
        : "";
      return {
        customer: mk(
          ctx.customerEmail,
          `Reminder — your table at ${ctx.restaurantName} is ${lead}`,
          `<p style="font-size:14px;color:#44403c">Hi ${first}, a friendly reminder about your reservation ${lead}:</p>
           ${details}
           ${extra}
           <p style="font-size:14px;color:#44403c;margin-bottom:16px">Can no longer make it? You can cancel here:</p>
           ${button(ctx.cancelUrl, "Cancel my reservation", "#be123c")}`,
          `${ctx.restaurantName}${ctx.address ? ` · ${ctx.address}` : ""}${ctx.phone ? ` · ${ctx.phone}` : ""}`,
        ),
        owner: null, // reminders go to the guest only
      };
    }
    default:
      return { customer: null, owner: null };
  }
}

/**
 * Load a reservation and build the guest/owner emails for a notification type.
 * Shared by sendNotification and the reminder pipeline so every email type uses
 * the same branded layout and the same all-tables / area / notes context.
 */
export async function buildReservationEmails(
  reservationId: string,
  type: NotificationType,
): Promise<{ customer: EmailMessage | null; owner: EmailMessage | null } | null> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      customer: true,
      table: { include: { area: true } },
      tables: { include: { table: true } },
    },
  });
  if (!reservation) return null;

  const settings = await prisma.restaurantSetting.findFirst();
  const area = reservation.table.area;
  // Show every assigned table (a combined booking holds several); fall back to
  // the primary table if the join is somehow empty.
  const assignedTables =
    reservation.tables.length > 0 ? reservation.tables.map((rt) => rt.table) : [reservation.table];
  const tableLabel = assignedTables.map((t) => t.name).join(" + ");
  const ctx: Ctx = {
    customerName: `${reservation.customer.firstName} ${reservation.customer.lastName}`.trim(),
    customerEmail: reservation.customer.email,
    ownerEmail: settings?.email ?? null,
    restaurantName: settings?.name ?? "Gjeçaj Alpine Restaurant Cuisine",
    address: settings?.address ?? "",
    tableName: assignedTables.length > 1 ? `${tableLabel} · ${area?.name ?? reservation.table.section}` : `${reservation.table.name} · ${reservation.table.section}`,
    partySize: reservation.partySize,
    phone: reservation.customer.phone,
    start: new Date(reservation.startDateTime),
    cancelUrl: `${appUrl()}/r/${reservation.cancelToken}`,
    notes: reservation.notes,
    area: area?.name ?? null,
    weatherDependent: area?.kind === "outdoor" && (area?.weatherDependent ?? false),
    reminderText: settings?.reminderText ?? null,
    // Uploaded logo if set, otherwise the bundled Villa Gjeçaj default (absolute
    // URL so email clients can load it; only rendered when https).
    logoUrl: resolveLogoUrl(settings?.logoUrl ?? null, appUrl()),
  };
  return buildEmails(type, ctx);
}

/** Send a reservation notification to the guest and/or owner and record it. */
export async function sendNotification(reservationId: string, type: NotificationType) {
  const emails = await buildReservationEmails(reservationId, type);
  if (!emails) return null;
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
