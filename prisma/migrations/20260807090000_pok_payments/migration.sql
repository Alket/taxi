-- AlterEnum
ALTER TYPE "PaymentProvider" ADD VALUE 'pok';

-- AlterTable
ALTER TABLE "Settings"
    ADD COLUMN "pokEnabled" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "pokMode" TEXT NOT NULL DEFAULT 'test',
    ADD COLUMN "pokStagingKeyId" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "pokStagingKeySecret" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "pokStagingMerchantId" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "pokLiveKeyId" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "pokLiveKeySecret" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "pokLiveMerchantId" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "PokOrderIntent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "paymentOption" TEXT NOT NULL,
    "expectedAmount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'created',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PokOrderIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PokOrderIntent_orderId_key" ON "PokOrderIntent"("orderId");

-- CreateIndex
CREATE INDEX "PokOrderIntent_bookingId_idx" ON "PokOrderIntent"("bookingId");

-- CreateIndex
CREATE INDEX "PokOrderIntent_status_idx" ON "PokOrderIntent"("status");

-- AddForeignKey
ALTER TABLE "PokOrderIntent" ADD CONSTRAINT "PokOrderIntent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
