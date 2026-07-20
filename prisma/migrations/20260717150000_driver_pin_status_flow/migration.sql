-- AlterTable
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "pinHash" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Driver_phone_idx" ON "Driver"("phone");

-- Map legacy operational statuses onto the simplified flow.
UPDATE "Booking" SET "status" = 'arrived' WHERE "status" = 'en_route';
UPDATE "Booking" SET "status" = 'arrived' WHERE "status" = 'in_progress';
