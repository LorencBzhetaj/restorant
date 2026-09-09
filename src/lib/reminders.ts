import { prisma } from "./prisma";
import { isEmailConfigured, sendEmail } from "./email";
import { buildReservationEmails } from "./notifications";

/**
 * AUTOMATIC REMINDERS
 * -------------------
 * Sends a 24-hour (and optional 2-hour) reminder to the guest before their
 * reservation. Designed to be driven by a periodic Vercel Cron call and to be
 * safe when executed multiple times.
 *
 * Idempotency: a partial unique index on Notification(reservationId, type) for
 * the reminder types guarantees at most one reminder of each type per
 * reservation. Each reminder is CLAIMED (a Notification row created) before the
 * email is sent, so two overlapping cron runs can never both send — the loser's
 * insert conflicts. A previously Failed reminder is re-claimed and retried.
 *
 * Timezone/DST: due-time selection compares absolute instants (a reservation's
 * UTC start minus a fixed 24h/2h offset vs. now), so it is unaffected by DST.
 * The tenant timezone (Europe/Tirane) only affects the wall-clock date/time
 * rendered inside the email (via the TZ env), not which reminders are due.
 */

type ReminderType = "Reminder24h" | "Reminder2h";

const REMINDERS: { type: ReminderType; offsetMs: number }[] = [
  { type: "Reminder24h", offsetMs: 24 * 60 * 60 * 1000 },
  { type: "Reminder2h", offsetMs: 2 * 60 * 60 * 1000 },
];

const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // matches the cron cadence
const BATCH = 100;

export interface ReminderRunResult {
  checked: number;
  sent: number;
  failed: number;
  skipped: number;
  byType: Record<ReminderType, { sent: number; failed: number }>;
}

export async function sendDueReminders(now: Date = new Date(), windowMs: number = DEFAULT_WINDOW_MS): Promise<ReminderRunResult> {
  const settings = await prisma.restaurantSetting.findFirst();
  const demo = !isEmailConfigured();
  const enabled: Record<ReminderType, boolean> = {
    Reminder24h: settings?.reminder24hEnabled ?? true,
    Reminder2h: settings?.reminder2hEnabled ?? false,
  };

  const result: ReminderRunResult = {
    checked: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    byType: { Reminder24h: { sent: 0, failed: 0 }, Reminder2h: { sent: 0, failed: 0 } },
  };

  for (const r of REMINDERS) {
    if (!enabled[r.type]) continue;

    // Reservation start falls in [now+offset, now+offset+window).
    const from = new Date(now.getTime() + r.offsetMs);
    const to = new Date(now.getTime() + r.offsetMs + windowMs);

    const due = await prisma.reservation.findMany({
      where: {
        status: { notIn: ["Cancelled", "Completed", "NoShow"] },
        startDateTime: { gte: from, lt: to },
        notifications: { none: { type: r.type, status: "Sent" } },
      },
      select: { id: true },
      take: BATCH,
    });
    result.checked += due.length;

    for (const res of due) {
      // Claim before sending. createMany + skipDuplicates does an atomic
      // INSERT ... ON CONFLICT DO NOTHING against the partial unique index, so
      // exactly one run wins the insert (no thrown error to catch). If the row
      // already exists we retry only when it is Failed (flip Failed→Sending);
      // otherwise (Sent/Sending) another run owns it → skip.
      const claim = await prisma.notification.createMany({
        data: [{ reservationId: res.id, type: r.type, channel: "Email", status: "Sending", message: "reminder", recipient: "" }],
        skipDuplicates: true,
      });
      let claimed = claim.count === 1;
      if (!claimed) {
        const flip = await prisma.notification.updateMany({
          where: { reservationId: res.id, type: r.type, status: "Failed" },
          data: { status: "Sending" },
        });
        claimed = flip.count === 1;
      }
      if (!claimed) {
        result.skipped++;
        continue;
      }

      const emails = await buildReservationEmails(res.id, r.type);
      const msg = emails?.customer ?? null;
      if (!msg) {
        await prisma.notification.updateMany({
          where: { reservationId: res.id, type: r.type },
          data: { status: "Failed", message: "No guest email address" },
        });
        result.failed++;
        result.byType[r.type].failed++;
        continue;
      }

      const sent = await sendEmail(msg);
      const ok = sent.delivered || demo;
      await prisma.notification.updateMany({
        where: { reservationId: res.id, type: r.type },
        data: { status: ok ? "Sent" : "Failed", message: `Guest: ${msg.subject}`, recipient: msg.to },
      });
      if (ok) {
        result.sent++;
        result.byType[r.type].sent++;
      } else {
        result.failed++;
        result.byType[r.type].failed++;
      }
    }
  }

  return result;
}
