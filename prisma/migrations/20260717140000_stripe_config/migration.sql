-- AlterTable (stripeMode already exists from full_schema as PaymentMode)
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "stripeTestPublishableKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "stripeTestSecretKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "stripeTestWebhookSecret" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "stripeLivePublishableKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "stripeLiveSecretKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "stripeLiveWebhookSecret" TEXT NOT NULL DEFAULT '';
