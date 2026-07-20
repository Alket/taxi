-- Align stripeMode/paypalMode with Prisma String fields (were PaymentMode enums from full_schema).
ALTER TABLE "Settings" ALTER COLUMN "stripeMode" DROP DEFAULT;
ALTER TABLE "Settings" ALTER COLUMN "paypalMode" DROP DEFAULT;
ALTER TABLE "Settings" ALTER COLUMN "stripeMode" TYPE TEXT USING "stripeMode"::text;
ALTER TABLE "Settings" ALTER COLUMN "paypalMode" TYPE TEXT USING "paypalMode"::text;
ALTER TABLE "Settings" ALTER COLUMN "stripeMode" SET DEFAULT 'test';
ALTER TABLE "Settings" ALTER COLUMN "paypalMode" SET DEFAULT 'test';

-- PayPal API credentials (paypalMode already exists from full_schema)
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "paypalSandboxClientId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "paypalSandboxSecret" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "paypalLiveClientId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "paypalLiveSecret" TEXT NOT NULL DEFAULT '';
