-- AlterTable
ALTER TABLE "PageContent" ADD COLUMN IF NOT EXISTS "locale" TEXT NOT NULL DEFAULT 'en';

-- Backfill (safe if column already defaulted)
UPDATE "PageContent" SET "locale" = 'en' WHERE "locale" IS NULL OR "locale" = '';

-- Drop old unique on slug if present (may be a constraint or a unique index)
DO $$ BEGIN
  ALTER TABLE "PageContent" DROP CONSTRAINT IF EXISTS "PageContent_slug_key";
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DROP INDEX IF EXISTS "PageContent_slug_key";

-- Composite unique
CREATE UNIQUE INDEX IF NOT EXISTS "PageContent_slug_locale_key" ON "PageContent"("slug", "locale");

-- Locale index
CREATE INDEX IF NOT EXISTS "PageContent_locale_idx" ON "PageContent"("locale");
