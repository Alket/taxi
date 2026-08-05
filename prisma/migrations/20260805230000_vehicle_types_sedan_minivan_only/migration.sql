-- Drop Comfort and Premium: keep Sedan + Minivan only.
-- Remap historical rows first (3-seat cars → sedan), then rebuild the enum.

UPDATE "Driver"
SET "vehicleType" = 'sedan'
WHERE "vehicleType" IN ('comfort', 'premium');

UPDATE "Booking"
SET "vehicleType" = 'sedan'
WHERE "vehicleType" IN ('comfort', 'premium');

DELETE FROM "PricingRule"
WHERE "vehicleType" IN ('comfort', 'premium');

CREATE TYPE "VehicleType_new" AS ENUM ('sedan', 'minivan');

ALTER TABLE "Driver"
  ALTER COLUMN "vehicleType" TYPE "VehicleType_new"
  USING ("vehicleType"::text::"VehicleType_new");

ALTER TABLE "Booking"
  ALTER COLUMN "vehicleType" TYPE "VehicleType_new"
  USING ("vehicleType"::text::"VehicleType_new");

ALTER TABLE "PricingRule"
  ALTER COLUMN "vehicleType" TYPE "VehicleType_new"
  USING ("vehicleType"::text::"VehicleType_new");

DROP TYPE "VehicleType";
ALTER TYPE "VehicleType_new" RENAME TO "VehicleType";
