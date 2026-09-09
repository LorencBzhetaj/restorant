-- CreateTable
CREATE TABLE "AreaClosure" (
    "id" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "startDateTime" TIMESTAMP(3) NOT NULL,
    "endDateTime" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AreaClosure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AreaClosure_areaId_idx" ON "AreaClosure"("areaId");

-- CreateIndex
CREATE INDEX "AreaClosure_startDateTime_idx" ON "AreaClosure"("startDateTime");

-- CreateIndex
CREATE INDEX "AreaClosure_endDateTime_idx" ON "AreaClosure"("endDateTime");

-- AddForeignKey
ALTER TABLE "AreaClosure" ADD CONSTRAINT "AreaClosure_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;
