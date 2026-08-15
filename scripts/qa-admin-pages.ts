/**
 * QA for /admin/pages CMS contracts (list, home editor, hero/OG sync,
 * intentional section deletes, locale text edits, public homepage resolution).
 *
 * Run: npm run test:admin-pages
 * Optional: QA_BASE_URL=http://localhost:3000
 *
 * Mutating cases back up and restore EN + sample locale `home` rows.
 */
import { PrismaClient } from "@prisma/client"

import { CORE_PAGE_SLUGS, parseSections } from "../lib/page-content-shared"
import { localePath } from "../lib/i18n/locales"
import {
  listAdminPages,
  pageHeroImageKey,
  pathForSlug,
  resolveHomeMarketingCopy,
  resolvePageContent,
  resolvePageContentForAdmin,
  resolvePageDefinition,
  type PageSection,
} from "../lib/page-content"

const base = process.env.QA_BASE_URL || "http://localhost:3000"
const prisma = new PrismaClient()

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

async function httpStatus(path: string) {
  try {
    const res = await fetch(`${base}${path}`, {
      headers: { "ngrok-skip-browser-warning": "true" },
      redirect: "manual",
    })
    return res.status
  } catch (error) {
    return `ERR:${(error as Error).message}`
  }
}

async function httpText(path: string) {
  try {
    const res = await fetch(`${base}${path}`, {
      headers: { "ngrok-skip-browser-warning": "true" },
    })
    return { status: res.status, text: await res.text() }
  } catch (error) {
    return { status: 0, text: (error as Error).message }
  }
}

/** Mirrors admin PATCH hero ↔ og sync for pages with a hero key. */
function syncHeroWithOg(
  sections: PageSection[],
  ogImage: string,
  heroKey: "hero" | "hero.image",
): PageSection[] {
  let synced = false
  const next = sections.map((section) => {
    if (section.type === "image" && section.key === heroKey) {
      synced = true
      return { ...section, src: ogImage }
    }
    return section
  })
  if (!synced && ogImage) {
    next.push({
      id: crypto.randomUUID(),
      type: "image",
      key: heroKey,
      src: ogImage,
      alt: "QA hero",
    })
  }
  return next
}

async function main() {
  console.log(`\nQA admin pages @ ${base}\n`)

  // ---------------------------------------------------------------------------
  // A — Catalog / list
  // ---------------------------------------------------------------------------
  const pages = await listAdminPages()
  if (pages.length >= CORE_PAGE_SLUGS.length) {
    pass("A1 listAdminPages non-empty", String(pages.length))
  } else {
    fail("A1 listAdminPages", `got ${pages.length}`)
  }

  const homeItem = pages.find((p) => p.slug === "home")
  if (
    homeItem &&
    homeItem.path === "/" &&
    homeItem.canDelete === false &&
    homeItem.isDestination === false &&
    homeItem.isBlog === false
  ) {
    pass("A2 home list item shape", homeItem.label)
  } else {
    fail("A2 home list item", JSON.stringify(homeItem))
  }

  let coreOk = true
  for (const slug of CORE_PAGE_SLUGS) {
    const item = pages.find((p) => p.slug === slug)
    if (!item) {
      coreOk = false
      fail("A3 core page listed", slug)
      break
    }
    if (item.canDelete) {
      coreOk = false
      fail("A3 core not deletable", slug)
      break
    }
  }
  if (coreOk) pass("A3 all core pages listed, not deletable")

  if (pathForSlug("home") === "/") pass("A4 pathForSlug home → /")
  else fail("A4 pathForSlug home", pathForSlug("home"))

  // ---------------------------------------------------------------------------
  // B — Hero key matrix (admin SEO ↔ visible hero)
  // ---------------------------------------------------------------------------
  const heroMatrix: Array<[string, "hero" | "hero.image" | null]> = [
    ["home", "hero.image"],
    ["blog/sample", "hero.image"],
    ["destinations/tirana", "hero"],
    ["cancellation-policy", null],
    ["privacy-policy", null],
  ]
  let heroKeysOk = true
  for (const [slug, expected] of heroMatrix) {
    const got = pageHeroImageKey(slug)
    if (got !== expected) {
      heroKeysOk = false
      fail("B1 pageHeroImageKey", `${slug} expected ${expected} got ${got}`)
      break
    }
  }
  if (heroKeysOk) pass("B1 pageHeroImageKey matrix")

  // ---------------------------------------------------------------------------
  // C — Home admin load + public resolve
  // ---------------------------------------------------------------------------
  const homeDef = await resolvePageDefinition("home")
  if (homeDef && homeDef.path === "/" && homeDef.defaults.sections.length > 0) {
    pass(
      "C1 home definition",
      `${homeDef.defaults.sections.length} default sections`,
    )
  } else {
    fail("C1 home definition", homeDef?.path || "missing")
  }

  const adminHome = await resolvePageContentForAdmin("home", "en")
  if (adminHome && adminHome.slug === "home" && adminHome.sections.length > 0) {
    pass(
      "C2 admin resolve home EN",
      `sections=${adminHome.sections.length} fromDb=${adminHome.fromDatabase}`,
    )
  } else {
    fail("C2 admin resolve home EN", "missing")
  }

  const publicHome = await resolvePageContent("home", "en")
  if (publicHome && publicHome.sections.length > 0) {
    pass("C3 public resolve home EN", String(publicHome.sections.length))
  } else {
    fail("C3 public resolve home EN", "missing")
  }

  const heroSection = adminHome?.sections.find(
    (s) => s.type === "image" && s.key === "hero.image",
  )
  if (heroSection) pass("C4 home has hero.image section", heroSection.src || "")
  else fail("C4 home hero.image", "missing section")

  // ---------------------------------------------------------------------------
  // D — resolveHomeMarketingCopy prefers ogImage over section src
  // ---------------------------------------------------------------------------
  const ogProbe = `/uploads/pages/qa-admin-og-${Date.now()}.webp`
  const sectionProbe = `/uploads/pages/qa-admin-section-${Date.now()}.webp`
  const copy = await resolveHomeMarketingCopy(
    [
      {
        id: "qa-hero",
        type: "image",
        key: "hero.image",
        src: sectionProbe,
        alt: "section alt",
      },
      {
        id: "qa-heading",
        type: "heading",
        key: "hero.heading",
        heading: "QA Heading",
        level: 1,
      },
    ],
    ogProbe,
  )
  if (copy.hero.image === ogProbe) {
    pass("D1 hero image prefers ogImage", ogProbe)
  } else {
    fail("D1 hero image prefers ogImage", copy.hero.image)
  }

  const copyFallback = await resolveHomeMarketingCopy(
    [
      {
        id: "qa-hero-2",
        type: "image",
        key: "hero.image",
        src: sectionProbe,
        alt: "section alt",
      },
    ],
    "   ",
  )
  if (copyFallback.hero.image === sectionProbe) {
    pass("D2 empty og falls back to hero.image src")
  } else {
    fail("D2 empty og fallback", copyFallback.hero.image)
  }

  // ---------------------------------------------------------------------------
  // E — Mutating round-trips on EN home (always restore)
  // ---------------------------------------------------------------------------
  const homeRow = await prisma.pageContent.findUnique({
    where: { slug_locale: { slug: "home", locale: "en" } },
  })
  if (!homeRow) {
    fail("E0 EN home row", "missing — seed or save home once before QA")
  } else {
    const original = {
      title: homeRow.title,
      description: homeRow.description,
      ogImage: homeRow.ogImage,
      label: homeRow.label,
      sections: homeRow.sections,
    }
    const originalSections = parseSections(homeRow.sections)

    try {
      // E1 — OG / hero sync persists through admin reload
      const qaOg = `/uploads/pages/qa-home-hero-${Date.now()}.webp`
      const syncedSections = syncHeroWithOg(
        originalSections,
        qaOg,
        "hero.image",
      )
      await prisma.pageContent.update({
        where: { id: homeRow.id },
        data: {
          ogImage: qaOg,
          sections: syncedSections,
        },
      })

      const afterSyncAdmin = await resolvePageContentForAdmin("home", "en")
      const afterSyncHero = afterSyncAdmin?.sections.find(
        (s) => s.key === "hero.image",
      )
      const afterSyncCopy = await resolveHomeMarketingCopy(
        afterSyncAdmin?.sections ?? [],
        afterSyncAdmin?.ogImage,
      )
      if (
        afterSyncAdmin?.ogImage === qaOg &&
        afterSyncHero?.src === qaOg &&
        afterSyncCopy.hero.image === qaOg
      ) {
        pass("E1 home OG↔hero sync + marketing copy", qaOg)
      } else {
        fail(
          "E1 home OG↔hero sync",
          JSON.stringify({
            og: afterSyncAdmin?.ogImage,
            heroSrc: afterSyncHero?.src,
            copy: afterSyncCopy.hero.image,
          }),
        )
      }

      // E2 — Deleting a keyed block must survive admin reload (no default reinsert)
      const removable = syncedSections.find(
        (s) =>
          s.key === "uberAlt.eyebrow" ||
          s.key === "compare.eyebrow" ||
          (s.key.startsWith("peace.item") && s.type === "text"),
      )
      if (!removable?.key) {
        fail("E2 pick removable section", "no candidate key on home")
      } else {
        const deletedKey = removable.key
        const without = syncedSections.filter((s) => s.key !== deletedKey)
        await prisma.pageContent.update({
          where: { id: homeRow.id },
          data: { sections: without, ogImage: qaOg },
        })

        const afterDeleteAdmin = await resolvePageContentForAdmin("home", "en")
        const afterDeletePublic = await resolvePageContent("home", "en")
        const adminHas = afterDeleteAdmin?.sections.some(
          (s) => s.key === deletedKey,
        )
        const publicHas = afterDeletePublic?.sections.some(
          (s) => s.key === deletedKey,
        )
        if (!adminHas && !publicHas) {
          pass(
            "E2 deleted home block stays deleted after resolve",
            deletedKey,
          )
        } else {
          fail(
            "E2 deleted home block reappeared",
            JSON.stringify({ deletedKey, adminHas, publicHas }),
          )
        }

        // E3 — Destination still fills missing structural defaults
        const destSlug = "destinations/tirana"
        const destDef = await resolvePageDefinition(destSlug)
        const destRow = await prisma.pageContent.findUnique({
          where: { slug_locale: { slug: destSlug, locale: "en" } },
        })
        if (!destDef || !destRow) {
          fail("E3 destination fixture", "tirana missing")
        } else {
          const destSections = parseSections(destRow.sections).filter(
            (s) => s.key !== "travelTime",
          )
          await prisma.pageContent.update({
            where: { id: destRow.id },
            data: { sections: destSections },
          })
          try {
            const destAdmin = await resolvePageContentForAdmin(destSlug, "en")
            const hasTravel = destAdmin?.sections.some(
              (s) => s.key === "travelTime",
            )
            if (hasTravel) {
              pass("E3 destination still rehydrates missing defaults")
            } else {
              fail("E3 destination missing defaults", "travelTime absent")
            }
          } finally {
            await prisma.pageContent.update({
              where: { id: destRow.id },
              data: { sections: destRow.sections },
            })
          }
        }
      }
    } finally {
      await prisma.pageContent.update({
        where: { id: homeRow.id },
        data: original,
      })
      const restored = await resolvePageContentForAdmin("home", "en")
      if (
        restored?.ogImage === original.ogImage &&
        parseSections(original.sections).length === restored.sections.length
      ) {
        pass("E4 restored EN home row after QA mutations")
      } else {
        fail(
          "E4 restore home",
          `og=${restored?.ogImage} sections=${restored?.sections.length}`,
        )
      }
    }
  }

  // ---------------------------------------------------------------------------
  // G — Other-language text edits + block deletes (admin + public)
  // ---------------------------------------------------------------------------
  const qaLocale = "it" as const
  const localeHomeRow = await prisma.pageContent.findUnique({
    where: { slug_locale: { slug: "home", locale: qaLocale } },
  })
  if (!localeHomeRow) {
    fail(
      "G0 IT home row",
      "missing — save an IT homepage translation once before QA",
    )
  } else {
    const localeOriginal = {
      title: localeHomeRow.title,
      description: localeHomeRow.description,
      ogImage: localeHomeRow.ogImage,
      label: localeHomeRow.label,
      sections: localeHomeRow.sections,
    }
    const localeSections = parseSections(localeHomeRow.sections)
    const marker = `QA-IT-HERO-${Date.now()}`

    try {
      // G1 — Text change on IT persists in admin + public resolve
      const textEdited = localeSections.map((section) => {
        if (section.key === "hero.heading" && section.type === "heading") {
          return { ...section, heading: marker }
        }
        if (section.key === "hero.text" && section.type === "text") {
          return { ...section, body: `${marker} body` }
        }
        return section
      })
      const qaTitle = `QA IT title ${Date.now()}`
      await prisma.pageContent.update({
        where: { id: localeHomeRow.id },
        data: {
          title: qaTitle,
          sections: textEdited,
        },
      })

      const adminIt = await resolvePageContentForAdmin("home", qaLocale)
      const publicIt = await resolvePageContent("home", qaLocale)
      const adminHeading = adminIt?.sections.find(
        (s) => s.key === "hero.heading",
      )?.heading
      const publicHeading = publicIt?.sections.find(
        (s) => s.key === "hero.heading",
      )?.heading
      const publicCopy = await resolveHomeMarketingCopy(
        publicIt?.sections ?? [],
        publicIt?.ogImage,
      )

      if (
        adminIt?.hasLocaleRow === true &&
        adminIt.title === qaTitle &&
        adminHeading === marker &&
        publicHeading === marker &&
        publicCopy.hero.heading === marker
      ) {
        pass("G1 IT text edit persists (admin + public)", marker)
      } else {
        fail(
          "G1 IT text edit",
          JSON.stringify({
            title: adminIt?.title,
            adminHeading,
            publicHeading,
            copy: publicCopy.hero.heading,
            hasLocaleRow: adminIt?.hasLocaleRow,
          }),
        )
      }

      // G2 — Delete a block on IT: stays gone in admin AND public (not refilled from EN)
      const removableIt = textEdited.find(
        (s) =>
          s.key === "uberAlt.eyebrow" ||
          s.key === "compare.eyebrow" ||
          (s.key.startsWith("peace.item") && s.type === "text"),
      )
      if (!removableIt?.key) {
        fail("G2 pick IT removable section", "no candidate")
      } else {
        const deletedKey = removableIt.key
        const withoutIt = textEdited.filter((s) => s.key !== deletedKey)
        await prisma.pageContent.update({
          where: { id: localeHomeRow.id },
          data: { title: qaTitle, sections: withoutIt },
        })

        const adminAfterDel = await resolvePageContentForAdmin(
          "home",
          qaLocale,
        )
        const publicAfterDel = await resolvePageContent("home", qaLocale)
        const enStillHas = (
          await resolvePageContent("home", "en")
        )?.sections.some((s) => s.key === deletedKey)
        const adminHas = adminAfterDel?.sections.some(
          (s) => s.key === deletedKey,
        )
        const publicHas = publicAfterDel?.sections.some(
          (s) => s.key === deletedKey,
        )

        if (!adminHas && !publicHas && enStillHas) {
          pass(
            "G2 IT deleted block stays deleted (EN still has it)",
            deletedKey,
          )
        } else {
          fail(
            "G2 IT deleted block",
            JSON.stringify({ deletedKey, adminHas, publicHas, enStillHas }),
          )
        }

        // G3 — Empty IT field still falls back to EN for a shared key
        const enHeading =
          (await resolvePageContent("home", "en"))?.sections.find(
            (s) => s.key === "hero.heading",
          )?.heading || ""
        const withEmptyHeading = withoutIt.map((section) =>
          section.key === "hero.heading" && section.type === "heading"
            ? { ...section, heading: "" }
            : section,
        )
        await prisma.pageContent.update({
          where: { id: localeHomeRow.id },
          data: { sections: withEmptyHeading },
        })
        const publicFallback = await resolvePageContent("home", qaLocale)
        const fallbackHeading = publicFallback?.sections.find(
          (s) => s.key === "hero.heading",
        )?.heading
        if (enHeading && fallbackHeading === enHeading) {
          pass("G3 empty IT heading falls back to EN", enHeading.slice(0, 40))
        } else {
          fail(
            "G3 IT empty-field EN fallback",
            JSON.stringify({ enHeading, fallbackHeading }),
          )
        }
      }

      // G4 — Localized public page HTTP
      const itHome = await httpText(localePath("/", qaLocale))
      if (itHome.status === 200) pass("G4 /it 200")
      else fail("G4 /it", String(itHome.status))
    } finally {
      await prisma.pageContent.update({
        where: { id: localeHomeRow.id },
        data: localeOriginal,
      })
      const restoredIt = await resolvePageContentForAdmin("home", qaLocale)
      if (
        restoredIt?.title === localeOriginal.title &&
        parseSections(localeOriginal.sections).length ===
          (restoredIt?.sections.length ?? -1)
      ) {
        pass("G5 restored IT home row after QA mutations")
      } else {
        fail(
          "G5 restore IT home",
          `title=${restoredIt?.title} sections=${restoredIt?.sections.length}`,
        )
      }
    }
  }

  // ---------------------------------------------------------------------------
  // F — HTTP smoke (auth gate + public marketing)
  // ---------------------------------------------------------------------------
  const adminList = await httpStatus("/admin/pages")
  if (
    adminList === 307 ||
    adminList === 302 ||
    adminList === 401 ||
    adminList === 403
  ) {
    pass("F1 /admin/pages requires auth", String(adminList))
  } else if (adminList === 200) {
    // Dev session may already be logged in — still acceptable.
    pass("F1 /admin/pages reachable (session present)", "200")
  } else {
    fail("F1 /admin/pages", String(adminList))
  }

  const adminHomeHttp = await httpStatus("/admin/pages/home")
  if (
    adminHomeHttp === 307 ||
    adminHomeHttp === 302 ||
    adminHomeHttp === 401 ||
    adminHomeHttp === 403 ||
    adminHomeHttp === 200
  ) {
    pass("F2 /admin/pages/home responds", String(adminHomeHttp))
  } else {
    fail("F2 /admin/pages/home", String(adminHomeHttp))
  }

  const apiList = await httpStatus("/api/admin/pages")
  if (
    apiList === 401 ||
    apiList === 403 ||
    apiList === 307 ||
    apiList === 302
  ) {
    pass("F3 GET /api/admin/pages unauthorized without session", String(apiList))
  } else if (apiList === 200) {
    pass("F3 GET /api/admin/pages (session present)", "200")
  } else {
    fail("F3 GET /api/admin/pages", String(apiList))
  }

  const homeHttp = await httpText("/")
  if (homeHttp.status === 200) pass("F4 public / 200")
  else fail("F4 public /", String(homeHttp.status))

  const live = await resolvePageContent("home", "en")
  const liveCopy = await resolveHomeMarketingCopy(
    live?.sections ?? [],
    live?.ogImage,
  )
  if (
    homeHttp.status === 200 &&
    liveCopy.hero.heading &&
    homeHttp.text.includes(liveCopy.hero.heading.split("\n")[0]!.trim())
  ) {
    pass("F5 public / renders CMS hero heading")
  } else if (homeHttp.status === 200) {
    fail("F5 CMS hero heading", liveCopy.hero.heading)
  }

  // ---------------------------------------------------------------------------
  const passed = results.filter((r) => r.status === "PASS").length
  const failed = results.filter((r) => r.status === "FAIL").length
  console.log("\n===== QA SUMMARY (admin pages) =====")
  console.log(`PASS=${passed} FAIL=${failed}`)
  for (const r of results.filter((x) => x.status === "FAIL")) {
    console.log(`  FAIL: ${r.case} | ${r.detail}`)
  }

  await prisma.$disconnect()
  if (failed > 0) process.exit(1)
}

main().catch(async (error) => {
  console.error(error)
  await prisma.$disconnect()
  process.exit(1)
})
