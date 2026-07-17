-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "depositPaymentEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Settings" ADD COLUMN "fullPaymentEnabled" BOOLEAN NOT NULL DEFAULT true;
