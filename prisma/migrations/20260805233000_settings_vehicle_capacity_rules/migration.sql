-- Vehicle capacity rules (admin Settings → Rules). Defaults match prior hard-coded catalog.
ALTER TABLE "Settings"
  ADD COLUMN IF NOT EXISTS "sedanSeats" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS "sedanLuggage" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS "minivanSeats" INTEGER NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS "minivanLuggage" INTEGER NOT NULL DEFAULT 6;
