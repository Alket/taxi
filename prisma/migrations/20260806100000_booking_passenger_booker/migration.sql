-- CreateEnum
CREATE TYPE "BookerRelation" AS ENUM (
  'family_friend',
  'travel_agent',
  'colleague',
  'prefer_not_to_say'
);

-- AlterTable
ALTER TABLE "Booking"
  ADD COLUMN "bookedForOther" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "passengerName" TEXT,
  ADD COLUMN "passengerEmail" TEXT,
  ADD COLUMN "passengerPhone" TEXT,
  ADD COLUMN "passengerNoEmail" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "bookerRelation" "BookerRelation";
