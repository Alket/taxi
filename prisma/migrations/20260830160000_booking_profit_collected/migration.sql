-- AlterTable
ALTER TABLE "Booking"
  ADD COLUMN "profitCollectedAt" TIMESTAMP(3),
  ADD COLUMN "profitCollectedById" TEXT;

-- CreateIndex
CREATE INDEX "Booking_profitCollectedAt_idx" ON "Booking"("profitCollectedAt");

-- CreateIndex
CREATE INDEX "Booking_profitCollectedById_idx" ON "Booking"("profitCollectedById");

-- AddForeignKey
ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_profitCollectedById_fkey"
  FOREIGN KEY ("profitCollectedById") REFERENCES "AdminUser"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
