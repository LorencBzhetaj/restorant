-- CreateTable
CREATE TABLE "TableCombination" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "minSeats" INTEGER,
    "maxSeats" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TableCombination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableCombinationMember" (
    "id" TEXT NOT NULL,
    "combinationId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,

    CONSTRAINT "TableCombinationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationTable" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,

    CONSTRAINT "ReservationTable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TableCombination_areaId_idx" ON "TableCombination"("areaId");

-- CreateIndex
CREATE INDEX "TableCombination_isActive_idx" ON "TableCombination"("isActive");

-- CreateIndex
CREATE INDEX "TableCombinationMember_tableId_idx" ON "TableCombinationMember"("tableId");

-- CreateIndex
CREATE UNIQUE INDEX "TableCombinationMember_combinationId_tableId_key" ON "TableCombinationMember"("combinationId", "tableId");

-- CreateIndex
CREATE INDEX "ReservationTable_tableId_idx" ON "ReservationTable"("tableId");

-- CreateIndex
CREATE INDEX "ReservationTable_reservationId_idx" ON "ReservationTable"("reservationId");

-- CreateIndex
CREATE UNIQUE INDEX "ReservationTable_reservationId_tableId_key" ON "ReservationTable"("reservationId", "tableId");

-- AddForeignKey
ALTER TABLE "TableCombination" ADD CONSTRAINT "TableCombination_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableCombinationMember" ADD CONSTRAINT "TableCombinationMember_combinationId_fkey" FOREIGN KEY ("combinationId") REFERENCES "TableCombination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableCombinationMember" ADD CONSTRAINT "TableCombinationMember_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationTable" ADD CONSTRAINT "ReservationTable_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationTable" ADD CONSTRAINT "ReservationTable_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: every existing reservation keeps its current table as a
-- ReservationTable row, so no booking loses its table during the transition.
-- Idempotent via the (reservationId, tableId) unique index. Reservation.tableId
-- remains authoritative until the code refactor is deployed.
INSERT INTO "ReservationTable" ("id", "reservationId", "tableId")
SELECT gen_random_uuid()::text, "id", "tableId"
FROM "Reservation"
ON CONFLICT ("reservationId", "tableId") DO NOTHING;
