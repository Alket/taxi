-- CreateTable
CREATE TABLE "StaffNotification" (
    "id" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "ownerId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "bookingId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffNotification_audience_createdAt_idx" ON "StaffNotification"("audience", "createdAt");

-- CreateIndex
CREATE INDEX "StaffNotification_audience_readAt_idx" ON "StaffNotification"("audience", "readAt");

-- CreateIndex
CREATE INDEX "StaffNotification_ownerId_createdAt_idx" ON "StaffNotification"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "StaffNotification_bookingId_idx" ON "StaffNotification"("bookingId");
