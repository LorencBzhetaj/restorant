-- AlterTable
ALTER TABLE "RestaurantSetting" ADD COLUMN     "reminder24hEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "reminder2hEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reminderText" TEXT;

-- Hard idempotency guarantee for reminders: at most ONE reminder of each type
-- per reservation can ever exist, so a reminder can never be sent twice even if
-- the cron runs concurrently. Partial, because non-reminder notifications may
-- legitimately repeat (e.g. a reservation rescheduled several times).
CREATE UNIQUE INDEX "Notification_reservation_reminder_type_key"
  ON "Notification" ("reservationId", "type")
  WHERE "type" IN ('Reminder24h', 'Reminder2h');
