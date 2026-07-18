-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CancellationOutcome" AS ENUM ('free_cancellation', 'deposit_forfeited');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PaymentType" AS ENUM ('deposit', 'balance');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterEnum
DO $$ BEGIN
  ALTER TYPE "PaymentStatus" ADD VALUE 'fully_paid';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable Booking
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "depositAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "balanceChargedAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "balanceChargedBy" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "cancellationOutcome" "CancellationOutcome";
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "meetAndGreet" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "isRoundTrip" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "roundTripId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Booking_roundTripId_idx" ON "Booking"("roundTripId");

-- AlterTable Payment
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "type" "PaymentType" NOT NULL DEFAULT 'deposit';
