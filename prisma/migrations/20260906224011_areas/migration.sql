-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "requestedArea" TEXT NOT NULL DEFAULT 'no_preference';

-- AlterTable
ALTER TABLE "RestaurantTable" ADD COLUMN     "areaId" TEXT;

-- AlterTable
ALTER TABLE "SlotLimit" ADD COLUMN     "areaKind" TEXT;

-- CreateTable
CREATE TABLE "Area" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'indoor',
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "weatherDependent" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Area_kind_idx" ON "Area"("kind");

-- CreateIndex
CREATE INDEX "RestaurantTable_areaId_idx" ON "RestaurantTable"("areaId");

-- AddForeignKey
ALTER TABLE "RestaurantTable" ADD CONSTRAINT "RestaurantTable_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;
