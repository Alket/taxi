-- AlterEnum (idempotent for DBs that already received this via db push)
DO $$ BEGIN
  ALTER TYPE "BookingStatus" ADD VALUE 'driver_accepted';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "PushSubscription" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "ownerId" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PushSubscription_audience_idx" ON "PushSubscription"("audience");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PushSubscription_ownerId_idx" ON "PushSubscription"("ownerId");
