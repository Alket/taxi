-- AlterEnum
DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE 'date_change';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE 'completed_receipt';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "adminNotificationEmail" TEXT NOT NULL DEFAULT '';
