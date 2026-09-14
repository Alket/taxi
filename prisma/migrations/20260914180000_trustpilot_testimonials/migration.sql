-- Manual Trustpilot testimonials + site visibility toggles for review sections.

ALTER TABLE "Settings"
ADD COLUMN IF NOT EXISTS "customerReviewsVisibleOnSite" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "trustpilotTestimonialsVisibleOnSite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "trustpilotDisplayScore" DECIMAL(2,1) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "trustpilotDisplayCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "trustpilotProfileUrl" TEXT NOT NULL DEFAULT 'https://www.trustpilot.com/review/landedalbania.com';

CREATE TABLE IF NOT EXISTS "TrustpilotTestimonial" (
    "id" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "sourceUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustpilotTestimonial_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TrustpilotTestimonial_published_sortOrder_idx"
ON "TrustpilotTestimonial"("published", "sortOrder");
