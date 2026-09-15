-- AlterEnum
ALTER TYPE "Direction" ADD VALUE IF NOT EXISTS 'zone_to_zone';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "toZoneId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "InterZoneFare" (
    "id" TEXT NOT NULL,
    "zoneAId" TEXT NOT NULL,
    "zoneBId" TEXT NOT NULL,
    "vehicleType" "VehicleType" NOT NULL,
    "baseFare" DECIMAL(10,2) NOT NULL,
    "minFare" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterZoneFare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Booking_toZoneId_idx" ON "Booking"("toZoneId");

CREATE INDEX IF NOT EXISTS "InterZoneFare_zoneAId_active_idx" ON "InterZoneFare"("zoneAId", "active");

CREATE INDEX IF NOT EXISTS "InterZoneFare_zoneBId_active_idx" ON "InterZoneFare"("zoneBId", "active");

CREATE UNIQUE INDEX IF NOT EXISTS "InterZoneFare_zoneAId_zoneBId_vehicleType_key" ON "InterZoneFare"("zoneAId", "zoneBId", "vehicleType");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Booking" ADD CONSTRAINT "Booking_toZoneId_fkey" FOREIGN KEY ("toZoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "InterZoneFare" ADD CONSTRAINT "InterZoneFare_zoneAId_fkey" FOREIGN KEY ("zoneAId") REFERENCES "Zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "InterZoneFare" ADD CONSTRAINT "InterZoneFare_zoneBId_fkey" FOREIGN KEY ("zoneBId") REFERENCES "Zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
