import { prisma } from "../lib/db"
import {
  exportPageI18nPack,
  importPageI18nPack,
  pageI18nPackSchema,
  I18N_MAX_BODY,
  I18N_MAX_SECTIONS,
  I18N_MAX_PAGES,
  PAGE_I18N_PACK_KIND,
  PAGE_I18N_PACK_VERSION,
} from "../lib/page-content-i18n-pack"
import { parseSections, isDestinationFeatured } from "../lib/page-content"
import { LOCALES } from "../lib/i18n/locales"

type Result = { status: "PASS" | "FAIL"; case: string; detail?: string }
const results: Result[] = []
function pass(c: string, d = "") {
  results.push({ status: "PASS", case: c, detail: d })
  console.log("PASS:", c, d || "")
}
function fail(c: string, d = "") {
  results.push({ status: "FAIL", case: c, detail: d })
  console.log("FAIL:", c, "—", d)
}

async function main() {
  const pack = await exportPageI18nPack()
  const schema = pageI18nPackSchema.safeParse(pack)
  if (schema.success) pass("E1 schema validates exported pack")
  else fail("E1 schema", schema.error.message)

  if (pack.kind === PAGE_I18N_PACK_KIND && pack.version === PAGE_I18N_PACK_VERSION) {
    pass("E2 kind/version")
  } else {
    fail("E2 kind/version", JSON.stringify({ kind: pack.kind, version: pack.version }))
  }

  if (pack.pages.length >= 5 && pack.pages.length <= I18N_MAX_PAGES) {
    pass("E3 page count", String(pack.pages.length))
  } else {
    fail("E3 page count", String(pack.pages.length))
  }

  const slugs = pack.pages.map((p) => p.slug)
  for (const need of [
    "home",
    "cancellation-policy",
    "privacy-policy",
    "terms",
    "cookies",
  ]) {
    if (slugs.includes(need)) pass(`E4 core page present: ${need}`)
    else fail(`E4 missing core: ${need}`)
  }

  const dests = pack.pages.filter((p) => p.kind === "destination")
  if (dests.length >= 1) pass("E5 destinations included", String(dests.length))
  else fail("E5 no destinations")

  let localeOk = true
  for (const page of pack.pages) {
    for (const loc of LOCALES) {
      const block = page.byLocale[loc]
      if (!block || typeof block.title !== "string" || !block.sections) {
        localeOk = false
        fail("E6 locale shell", `${page.slug}/${loc}`)
        break
      }
    }
    if (!localeOk) break
  }
  if (localeOk) pass("E6 all pages × locales present")

  const home = pack.pages.find((p) => p.slug === "home")!
  const homeEnKeys = Object.keys(home.byLocale.en!.sections)
  const requiredHomeKeys = [
    "hero.heading",
    "uberAlt.eyebrow",
    "uberAlt.heading",
    "uberAlt.highlight",
    "uberAlt.text",
    "uberAlt.feature1.heading",
    "uberAlt.feature1.text",
    "uberAlt.feature2.heading",
    "uberAlt.feature2.text",
    "uberAlt.cta",
    "uberAlt.image",
    "uberAlt.floatingBadge.heading",
    "uberAlt.floatingBadge.text",
    "compare.eyebrow",
    "compare.heading",
    "compare.subtitle",
    "compare.taxi.title",
    "compare.taxi.items",
    "compare.landed.title",
    "compare.landed.badge",
    "compare.landed.items",
    "compare.broker.title",
    "compare.broker.subtitle",
    "compare.broker.items",
    "destinations.heading",
    "peace.heading",
    "peace.item1",
    "peace.item1.text",
    "peace.item2.text",
    "peace.item3.text",
    "peace.item4.text",
    "peace.item5.text",
    "peace.item6.text",
    "testimonials.heading",
  ]
  const missingHome = requiredHomeKeys.filter((k) => !homeEnKeys.includes(k))
  if (missingHome.length === 0 && homeEnKeys.some((k) => k.startsWith("faq."))) {
    pass("E7 home has hero + uberAlt + compare + faq keys", `${homeEnKeys.length} keys`)
  } else {
    fail(
      "E7 home keys",
      missingHome.length
        ? `missing: ${missingHome.join(", ")}`
        : homeEnKeys.slice(0, 10).join(","),
    )
  }

  // Non-EN shells / rows must expose the same key set as EN (empty strings OK).
  let localeKeyParity = true
  for (const loc of LOCALES) {
    if (loc === "en") continue
    const keys = Object.keys(home.byLocale[loc]?.sections || {})
    const missing = homeEnKeys.filter((k) => !keys.includes(k))
    if (missing.length) {
      localeKeyParity = false
      fail(`E7b home locale key parity: ${loc}`, missing.join(", "))
      break
    }
  }
  if (localeKeyParity) pass("E7b home locale key parity with EN")

  // New-section import: apply uberAlt + compare text even if IT row lacked those keys.
  const structureMarker = `QA-STRUCT-${Date.now()}`
  const structurePack = structuredClone(pack) as typeof pack
  structurePack.pages = structurePack.pages.map((p) => {
    if (p.slug !== "home") return p
    const it = p.byLocale.it!
    return {
      ...p,
      byLocale: {
        ...p.byLocale,
        it: {
          ...it,
          title: it.title || "IT Home",
          description: it.description || "IT desc",
          sections: {
            ...it.sections,
            "uberAlt.highlight": { body: `HL ${structureMarker}` },
            "uberAlt.cta": { body: `CTA ${structureMarker}` },
            "compare.heading": { heading: `CMP ${structureMarker}` },
            "compare.landed.badge": { body: `BADGE ${structureMarker}` },
          },
        },
      },
    }
  })
  const sImport = await importPageI18nPack(structurePack, { locales: ["it"] })
  if (sImport.errors.length === 0 && sImport.updated + sImport.created >= 1) {
    pass("S1 import uberAlt/compare into IT", JSON.stringify(sImport))
  } else {
    fail("S1 structure import", JSON.stringify(sImport))
  }

  const homeItStruct = await prisma.pageContent.findUnique({
    where: { slug_locale: { slug: "home", locale: "it" } },
  })
  const itSections = parseSections(homeItStruct?.sections)
  const itHighlight = itSections.find((s) => s.key === "uberAlt.highlight")?.body
  const itCta = itSections.find((s) => s.key === "uberAlt.cta")?.body
  const itCompare = itSections.find((s) => s.key === "compare.heading")?.heading
  const itBadge = itSections.find((s) => s.key === "compare.landed.badge")?.body
  if (itHighlight === `HL ${structureMarker}`) pass("S2 IT uberAlt.highlight applied")
  else fail("S2 IT uberAlt.highlight", itHighlight || "missing")
  if (itCta === `CTA ${structureMarker}`) pass("S3 IT uberAlt.cta applied")
  else fail("S3 IT uberAlt.cta", itCta || "missing")
  if (itCompare === `CMP ${structureMarker}`) pass("S4 IT compare.heading applied")
  else fail("S4 IT compare.heading", itCompare || "missing")
  if (itBadge === `BADGE ${structureMarker}`) pass("S5 IT compare.landed.badge applied")
  else fail("S5 IT compare.landed.badge", itBadge || "missing")

  const reExport = await exportPageI18nPack()
  const reHomeIt = reExport.pages.find((p) => p.slug === "home")?.byLocale.it
  if (reHomeIt?.sections["uberAlt.highlight"]?.body === `HL ${structureMarker}`) {
    pass("S6 re-export includes imported uberAlt.highlight")
  } else {
    fail(
      "S6 re-export uberAlt.highlight",
      reHomeIt?.sections["uberAlt.highlight"]?.body || "missing",
    )
  }
  if (reHomeIt?.sections["compare.heading"]?.heading === `CMP ${structureMarker}`) {
    pass("S7 re-export includes imported compare.heading")
  } else {
    fail(
      "S7 re-export compare.heading",
      reHomeIt?.sections["compare.heading"]?.heading || "missing",
    )
  }

  // Restore IT from original pack before continuing mutate tests.
  await importPageI18nPack(pack, { locales: ["it"] })

  const metaLeak = pack.pages.some((p) =>
    Object.values(p.byLocale).some(
      (b) => b && ("_featured" in b.sections || "_status" in b.sections),
    ),
  )
  if (!metaLeak) pass("E8 no _featured/_status in export")
  else fail("E8 meta leak")

  let srcLeak = false
  for (const page of pack.pages) {
    for (const block of Object.values(page.byLocale)) {
      for (const fields of Object.values(block?.sections || {})) {
        if (fields && "src" in (fields as object)) srcLeak = true
      }
    }
  }
  if (!srcLeak) pass("E9 no image src in text fields")
  else fail("E9 src leaked into pack")

  const homeEnBefore = await prisma.pageContent.findUnique({
    where: { slug_locale: { slug: "home", locale: "en" } },
  })
  const homeItBefore = await prisma.pageContent.findUnique({
    where: { slug_locale: { slug: "home", locale: "it" } },
  })
  const destSlug = dests[0]!.slug
  const destEnBefore = await prisma.pageContent.findUnique({
    where: { slug_locale: { slug: destSlug, locale: "en" } },
  })
  const featuredBefore = destEnBefore
    ? isDestinationFeatured(parseSections(destEnBefore.sections))
    : false
  const heroSrcBefore = parseSections(homeEnBefore?.sections).find(
    (s) => s.key === "hero.image",
  )?.src

  const rt = await importPageI18nPack(pack)
  if (rt.errors.length === 0) {
    pass(
      "R1 round-trip no errors",
      `updated=${rt.updated} created=${rt.created} skipped=${rt.skipped}`,
    )
  } else {
    fail("R1 round-trip errors", rt.errors.join("; "))
  }

  const homeEnAfterRt = await prisma.pageContent.findUnique({
    where: { slug_locale: { slug: "home", locale: "en" } },
  })
  if (homeEnAfterRt?.title === homeEnBefore?.title) {
    pass("R2 EN title unchanged after round-trip")
  } else {
    fail("R2 EN title changed", `${homeEnBefore?.title} => ${homeEnAfterRt?.title}`)
  }

  const marker = `QA-IMPORT-${Date.now()}`
  const mutated = structuredClone(pack) as typeof pack
  mutated.pages = mutated.pages.map((p) => {
    if (p.slug !== "home") return p
    return {
      ...p,
      byLocale: {
        ...p.byLocale,
        it: {
          ...p.byLocale.it!,
          title: marker,
          description: p.byLocale.it!.description,
          sections: {
            ...p.byLocale.it!.sections,
            "hero.heading": { heading: `QA Hero ${marker}` },
          },
        },
      },
    }
  })
  const m = await importPageI18nPack(mutated, { locales: ["it"] })
  if (m.errors.length === 0 && m.updated + m.created >= 1) {
    pass("M1 import mutated IT", JSON.stringify(m))
  } else {
    fail("M1 mutate import", JSON.stringify(m))
  }

  const homeIt = await prisma.pageContent.findUnique({
    where: { slug_locale: { slug: "home", locale: "it" } },
  })
  if (homeIt?.title === marker) pass("M2 IT title applied in DB")
  else fail("M2 IT title", homeIt?.title || "missing")

  const itHero = parseSections(homeIt?.sections).find(
    (s) => s.key === "hero.heading",
  )?.heading
  if (itHero === `QA Hero ${marker}`) pass("M3 IT hero.heading applied")
  else fail("M3 IT hero", itHero || "missing")

  const homeEnAfterM = await prisma.pageContent.findUnique({
    where: { slug_locale: { slug: "home", locale: "en" } },
  })
  if (homeEnAfterM?.title === homeEnBefore?.title) {
    pass("M4 EN untouched by IT-only import")
  } else {
    fail("M4 EN changed")
  }

  const heroSrcAfter = parseSections(homeEnAfterM?.sections).find(
    (s) => s.key === "hero.image",
  )?.src
  if (heroSrcAfter === heroSrcBefore) {
    pass("M5 hero image src preserved", heroSrcAfter || "(empty)")
  } else {
    fail("M5 hero src changed", `${heroSrcBefore} => ${heroSrcAfter}`)
  }

  await importPageI18nPack(pack, { locales: ["it"] })
  const homeItRestored = await prisma.pageContent.findUnique({
    where: { slug_locale: { slug: "home", locale: "it" } },
  })
  if (homeItRestored?.title === homeItBefore?.title) {
    pass("M6 IT restored from original pack")
  } else {
    fail("M6 IT restore", `${homeItBefore?.title} => ${homeItRestored?.title}`)
  }

  const destEnAfter = await prisma.pageContent.findUnique({
    where: { slug_locale: { slug: destSlug, locale: "en" } },
  })
  const featuredAfter = destEnAfter
    ? isDestinationFeatured(parseSections(destEnAfter.sections))
    : false
  if (featuredAfter === featuredBefore) {
    pass("P1 destination featured flag preserved", `${destSlug}=${featuredAfter}`)
  } else {
    fail("P1 featured changed", `${featuredBefore} => ${featuredAfter}`)
  }

  try {
    await importPageI18nPack({ kind: "nope", version: 1, pages: [] })
    fail("V1 bad kind accepted")
  } catch (e) {
    pass("V1 reject bad kind", (e as Error).message.slice(0, 80))
  }

  try {
    const bad = structuredClone(pack) as typeof pack
    bad.pages[0]!.byLocale.en!.sections["hero.text"]!.body = "x".repeat(
      I18N_MAX_BODY + 1,
    )
    await importPageI18nPack(bad)
    fail("V2 oversized body accepted")
  } catch (e) {
    pass("V2 reject oversized body", (e as Error).message.slice(0, 90))
  }

  try {
    const bad = structuredClone(pack) as typeof pack
    const sections: Record<string, { question: string; answer: string }> = {}
    for (let i = 0; i < I18N_MAX_SECTIONS + 1; i++) {
      sections[`faq.${i}`] = { question: "q", answer: "a" }
    }
    bad.pages[0]!.byLocale.en!.sections = sections
    await importPageI18nPack(bad)
    fail("V3 section flood accepted")
  } catch (e) {
    pass("V3 reject section flood", (e as Error).message.slice(0, 90))
  }

  {
    const bad = structuredClone(pack) as typeof pack
    bad.pages.push({
      slug: "totally-unknown-page-xyz",
      label: "X",
      kind: "core",
      byLocale: { en: { title: "t", description: "d", sections: {} } },
    })
    const r = await importPageI18nPack(bad)
    if (r.errors.some((e) => e.includes("Unknown page slug"))) {
      pass("V4 unknown slug reported", r.errors[0])
    } else {
      fail("V4 unknown slug silent", JSON.stringify(r))
    }
  }

  try {
    const bad = structuredClone(pack) as typeof pack
    ;(bad.pages[0]!.byLocale.en!.sections["hero.image"] as Record<string, string>).src =
      "https://evil.example/x.png"
    await importPageI18nPack(bad)
    fail("V5 src injection accepted")
  } catch (e) {
    pass("V5 reject src in section text", (e as Error).message.slice(0, 90))
  }

  const passed = results.filter((r) => r.status === "PASS").length
  const failed = results.filter((r) => r.status === "FAIL").length
  console.log("\n===== QA SUMMARY =====")
  console.log(`PASS=${passed} FAIL=${failed}`)
  for (const r of results.filter((x) => x.status === "FAIL")) {
    console.log(`  FAIL: ${r.case} | ${r.detail}`)
  }
  await prisma.$disconnect()
  if (failed > 0) process.exit(1)
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
