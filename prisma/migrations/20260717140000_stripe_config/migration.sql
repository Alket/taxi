-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "stripeMode" TEXT NOT NULL DEFAULT 'test';
ALTER TABLE "Settings" ADD COLUMN "stripeTestPublishableKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Settings" ADD COLUMN "stripeTestSecretKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Settings" ADD COLUMN "stripeTestWebhookSecret" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Settings" ADD COLUMN "stripeLivePublishableKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Settings" ADD COLUMN "stripeLiveSecretKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Settings" ADD COLUMN "stripeLiveWebhookSecret" TEXT NOT NULL DEFAULT '';
