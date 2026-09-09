import { NextRequest, NextResponse } from "next/server";
import { sendDueReminders } from "@/lib/reminders";

export const dynamic = "force-dynamic";

/**
 * Protected reminder cron endpoint.
 *
 * Auth: requires `Authorization: Bearer <CRON_SECRET>`. Vercel Cron sends this
 * header automatically when CRON_SECRET is configured. Fails closed — if
 * CRON_SECRET is unset the endpoint returns 401 and does nothing. No secret is
 * ever accepted from the URL/query string.
 *
 * Safe to run repeatedly: sendDueReminders is idempotent (see lib/reminders).
 * Logs counts only — never guest personal data.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendDueReminders();
  console.log(
    `[cron/reminders] checked=${result.checked} sent=${result.sent} failed=${result.failed} skipped=${result.skipped}`,
  );
  return NextResponse.json({ ok: true, ...result });
}
