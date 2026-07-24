-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'review_request';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Expand Review for dual ratings + moderation
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "driverRating" INTEGER;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "driverComment" TEXT;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "platformRating" INTEGER;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "platformComment" TEXT;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "status" "ReviewStatus" NOT NULL DEFAULT 'pending';
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "moderatedAt" TIMESTAMP(3);

-- Migrate legacy single-rating rows
UPDATE "Review"
SET
  "driverRating" = COALESCE("driverRating", "rating"),
  "driverComment" = COALESCE("driverComment", "comment"),
  "platformRating" = COALESCE("platformRating", "rating"),
  "status" = COALESCE("status", 'pending'::"ReviewStatus")
WHERE "driverRating" IS NULL OR "platformRating" IS NULL;

-- Ensure non-null after backfill (new installs with empty table: set defaults then NOT NULL)
UPDATE "Review" SET "driverRating" = 5 WHERE "driverRating" IS NULL;
UPDATE "Review" SET "platformRating" = 5 WHERE "platformRating" IS NULL;

ALTER TABLE "Review" ALTER COLUMN "driverRating" SET NOT NULL;
ALTER TABLE "Review" ALTER COLUMN "platformRating" SET NOT NULL;

-- Drop legacy columns if present
ALTER TABLE "Review" DROP COLUMN IF EXISTS "rating";
ALTER TABLE "Review" DROP COLUMN IF EXISTS "comment";

CREATE INDEX IF NOT EXISTS "Review_status_idx" ON "Review"("status");
