-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN IF NOT EXISTS "requiresPasswordReset" BOOLEAN NOT NULL DEFAULT false;
