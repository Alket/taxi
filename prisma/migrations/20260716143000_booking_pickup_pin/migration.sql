-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "pickupPin" TEXT;

-- Backfill unique 6-digit PINs for existing bookings.
DO $$
DECLARE
  r RECORD;
  pin TEXT;
BEGIN
  FOR r IN SELECT id FROM "Booking" WHERE "pickupPin" IS NULL LOOP
    LOOP
      pin := lpad((floor(random() * 1000000))::int::text, 6, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM "Booking" WHERE "pickupPin" = pin);
    END LOOP;
    UPDATE "Booking" SET "pickupPin" = pin WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE "Booking" ALTER COLUMN "pickupPin" SET NOT NULL;

CREATE UNIQUE INDEX "Booking_pickupPin_key" ON "Booking"("pickupPin");
