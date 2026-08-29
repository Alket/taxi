-- AlterTable
ALTER TABLE "Booking"
  ADD COLUMN "internalNotesUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "internalNotesUpdatedById" TEXT;

-- CreateEnum
CREATE TYPE "InternalNoteAction" AS ENUM ('created', 'updated', 'deleted');

-- CreateTable
CREATE TABLE "BookingInternalNoteEvent" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "action" "InternalNoteAction" NOT NULL,
    "previousText" TEXT,
    "nextText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingInternalNoteEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Booking_internalNotesUpdatedById_idx" ON "Booking"("internalNotesUpdatedById");

-- CreateIndex
CREATE INDEX "BookingInternalNoteEvent_bookingId_createdAt_idx" ON "BookingInternalNoteEvent"("bookingId", "createdAt");

-- CreateIndex
CREATE INDEX "BookingInternalNoteEvent_actorId_idx" ON "BookingInternalNoteEvent"("actorId");

-- AddForeignKey
ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_internalNotesUpdatedById_fkey"
  FOREIGN KEY ("internalNotesUpdatedById") REFERENCES "AdminUser"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingInternalNoteEvent"
  ADD CONSTRAINT "BookingInternalNoteEvent_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingInternalNoteEvent"
  ADD CONSTRAINT "BookingInternalNoteEvent_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "AdminUser"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
