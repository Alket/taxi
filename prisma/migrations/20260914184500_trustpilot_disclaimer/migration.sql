-- AlterTable
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "trustpilotDisclaimer" TEXT NOT NULL DEFAULT 'Selection of 5 star reviews from verified customers.';
