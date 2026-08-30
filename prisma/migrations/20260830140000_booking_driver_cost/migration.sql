-- AlterTable
ALTER TABLE "Booking"
  ADD COLUMN "driverCost" DECIMAL(10,2),
  ADD COLUMN "driverCostUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "driverCostUpdatedById" TEXT;

-- CreateEnum
CREATE TYPE "DriverCostAction" AS ENUM ('created', 'updated', 'deleted');

-- CreateTable
CREATE TABLE "BookingDriverCostEvent" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "action" "DriverCostAction" NOT NULL,
    "previousAmount" DECIMAL(10,2),
    "nextAmount" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingDriverCostEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Booking_driverCostUpdatedById_idx" ON "Booking"("driverCostUpdatedById");

-- CreateIndex
CREATE INDEX "BookingDriverCostEvent_bookingId_createdAt_idx" ON "BookingDriverCostEvent"("bookingId", "createdAt");

-- CreateIndex
CREATE INDEX "BookingDriverCostEvent_actorId_idx" ON "BookingDriverCostEvent"("actorId");

-- AddForeignKey
ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_driverCostUpdatedById_fkey"
  FOREIGN KEY ("driverCostUpdatedById") REFERENCES "AdminUser"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingDriverCostEvent"
  ADD CONSTRAINT "BookingDriverCostEvent_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingDriverCostEvent"
  ADD CONSTRAINT "BookingDriverCostEvent_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "AdminUser"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
