/**
 * One-off backfill: add the new "Getting to <destination>" route-content
 * sections (distance / duration / why-book) to existing English destination
 * rows that predate this feature. Idempotent — skips rows that already have
 * a `route.heading` section.
 *
 * Run with: npx tsx scripts/backfill-destination-route-content.ts
 */
import { prisma } from "@/lib/db"
import { DESTINATIONS } from "@/lib/destinations"
import { destinationDefinitionFromMeta } from "@/lib/page-content"
import { parseSections } from "@/lib/page-content-shared"

async function main() {
  let updated = 0
  let skipped = 0

  for (const dest of DESTINATIONS) {
    const slug = `destinations/${dest.id}`
    const row = await prisma.pageContent.findUnique({
      where: { slug_locale: { slug, locale: "en" } },
    })
    if (!row) {
      skipped += 1
      continue
    }

    const sections = parseSections(row.sections)
    if (sections.some((s) => s.key === "route.heading")) {
      skipped += 1
      continue
    }

    const defaults = destinationDefinitionFromMeta(dest).defaults.sections
    const routeSections = defaults.filter((s) => s.key.startsWith("route."))
    if (routeSections.length === 0) {
      skipped += 1
      continue
    }

    // Insert right after the "priceFrom" section (or append) to keep the
    // admin editor's section order sensible.
    const priceIndex = sections.findIndex((s) => s.key === "priceFrom")
    const nextSections =
      priceIndex >= 0
        ? [
            ...sections.slice(0, priceIndex + 1),
            ...routeSections,
            ...sections.slice(priceIndex + 1),
          ]
        : [...sections, ...routeSections]

    await prisma.pageContent.update({
      where: { slug_locale: { slug, locale: "en" } },
      data: { sections: nextSections },
    })
    updated += 1
    console.log(`Updated ${slug}`)
  }

  console.log(`Done. updated=${updated} skipped=${skipped}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
