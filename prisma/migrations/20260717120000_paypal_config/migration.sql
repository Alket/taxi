-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "paypalMode" TEXT NOT NULL DEFAULT 'test';
ALTER TABLE "Settings" ADD COLUMN "paypalSandboxClientId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Settings" ADD COLUMN "paypalSandboxSecret" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Settings" ADD COLUMN "paypalLiveClientId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Settings" ADD COLUMN "paypalLiveSecret" TEXT NOT NULL DEFAULT '';
