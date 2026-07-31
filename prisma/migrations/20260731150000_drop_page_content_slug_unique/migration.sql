-- The locale migration attempted DROP CONSTRAINT on PageContent_slug_key,
-- but Prisma created it as a UNIQUE INDEX. Drop the index so multiple
-- locales can share the same slug.
DROP INDEX IF EXISTS "PageContent_slug_key";
