-- AlterTable
ALTER TABLE "RestaurantSetting" ADD COLUMN     "maxCoversPerSlot" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "maxReservationsPerSlot" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SlotLimit" (
    "id" TEXT NOT NULL,
    "dayOfWeek" INTEGER,
    "time" TEXT NOT NULL,
    "maxReservations" INTEGER NOT NULL,
    "maxCovers" INTEGER,

    CONSTRAINT "SlotLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SlotLimit_time_idx" ON "SlotLimit"("time");
