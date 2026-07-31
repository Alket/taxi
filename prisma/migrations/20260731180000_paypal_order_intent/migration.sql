-- CreateTable
CREATE TABLE "PaypalOrderIntent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "paymentOption" TEXT NOT NULL,
    "expectedAmount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'created',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaypalOrderIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaypalOrderIntent_orderId_key" ON "PaypalOrderIntent"("orderId");

-- CreateIndex
CREATE INDEX "PaypalOrderIntent_bookingId_idx" ON "PaypalOrderIntent"("bookingId");

-- CreateIndex
CREATE INDEX "PaypalOrderIntent_status_idx" ON "PaypalOrderIntent"("status");

-- AddForeignKey
ALTER TABLE "PaypalOrderIntent" ADD CONSTRAINT "PaypalOrderIntent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
