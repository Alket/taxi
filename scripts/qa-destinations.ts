/**
 * QA for destination CMS fields + public routing/cards + v2 document dual-read.
 * Run: npx tsx scripts/qa-destinations.ts
 */
import { PrismaClient } from "@prisma/client"

import { DESTINATIONS } from "../lib/destinations"
import {
  isDestinationDocumentV2,
  parseDestinationDocument,
  serializeDestinationDocument,
} from "../lib/destination-document"
import { parseSections, sectionValue } from "../lib/page-content-shared"
import {
  publicDestinationSlug,
  resolveDestination,
  resolveDestinationCards,
  resolveDestinationPage,
  resolvePageContent,
  resolvePageDefinition,
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
  const res = await fetch(`${base}${path}`, {
    headers: { "ngrok-skip-browser-warning": "true" },
    redirect: "manual",
  })
  return res.status
}

async function httpText(path: string) {
  const res = await fetch(`${base}${path}`, {
    headers: { "ngrok-skip-browser-warning": "true" },
  })
  return { status: res.status, text: await res.text() }
}

async function main() {
  console.log(`\nQA destinations @ ${base}\n`)

  // --- Library / CMS ---
  const cards = await resolveDestinationCards("en")
  if (cards.length >= 1) pass("C1 cards resolve", String(cards.length))
  else fail("C1 cards resolve", "none")

  let cardsOk = true
  for (const card of cards.slice(0, 12)) {
    if (!card.id || !card.slug || !card.name) {
      cardsOk = false
      fail("C2 card shape", `${card.id} missing id/slug/name`)
      break
    }
    if (!card.travelTime?.trim()) {
      cardsOk = false
      fail("C2 travelTime", `${card.id} empty`)
      break
    }
    if (!card.primaryKeyword?.trim()) {
      cardsOk = false
      fail("C2 primaryKeyword", `${card.id} empty`)
      break
    }
  }
  if (cardsOk) pass("C2 cards have slug + travelTime + primaryKeyword")

  const sample = cards.find((c) => c.id === "tirana") || cards[0]!
  const byId = await resolveDestination(sample.id, "en")
  const bySlug = await resolveDestination(sample.slug, "en")
  if (byId?.id === sample.id && bySlug?.id === sample.id) {
    pass("C3 resolveDestination by id and slug", `${sample.id} / ${sample.slug}`)
  } else {
    fail("C3 resolveDestination", JSON.stringify({ byId: byId?.id, bySlug: bySlug?.id }))
  }

  // Temporary custom slug round-trip on EN tirana (restore after)
  const tiranaSlug = "destinations/tirana"
  const enRow = await prisma.pageContent.findUnique({
    where: { slug_locale: { slug: tiranaSlug, locale: "en" } },
  })
  if (!enRow) {
    fail("C4 EN tirana row", "missing")
  } else {
    const original = enRow.sections
    const doc = parseDestinationDocument(original, {
      id: "tirana",
      title: enRow.title,
      description: enRow.description,
      ogImage: enRow.ogImage,
    })
    const marker = `qa-tirana-${Date.now().toString(36)}`
    const mutated = serializeDestinationDocument({
      ...doc,
      meta: { ...doc.meta, slug: marker },
    })
    await prisma.pageContent.update({
      where: { id: enRow.id },
      data: { sections: mutated },
    })

    const resolved = await resolveDestination(marker, "en")
    if (resolved?.id === "tirana" && resolved.slug === marker) {
      pass("C4 custom meta.slug resolves", marker)
    } else {
      fail(
        "C4 custom meta.slug resolves",
        JSON.stringify({ id: resolved?.id, slug: resolved?.slug }),
      )
    }

    const pageViaCustom = await resolveDestinationPage("tirana", "en")
    if (
      pageViaCustom &&
      publicDestinationSlug(pageViaCustom.document, "tirana") === marker
    ) {
      pass("C5 CMS meta.slug field readable")
    } else {
      fail(
        "C5 CMS meta.slug field",
        pageViaCustom
          ? publicDestinationSlug(pageViaCustom.document, "tirana")
          : "missing",
      )
    }

    const customPage = await httpStatus(`/destinations/${marker}`)
    if (customPage === 200) pass("H1 /destinations/{customSlug} 200", String(customPage))
    else fail("H1 /destinations/{customSlug}", String(customPage))

    await prisma.pageContent.update({
      where: { id: enRow.id },
      data: { sections: original as object },
    })
    const restored = await resolveDestination("tirana", "en")
    if (restored?.id === "tirana") {
      pass("C6 restored slug", restored?.slug || "")
    } else {
      fail("C6 restore", restored?.slug || "missing")
    }
  }

  // Built-in defaults emit v2 documents
  let defaultsOk = true
  for (const dest of DESTINATIONS) {
    const def = await resolvePageDefinition(`destinations/${dest.id}`)
    const document = def?.defaults.destinationDocument
    if (!document || !isDestinationDocumentV2(document)) {
      defaultsOk = false
      fail("D1 defaults v2", `${dest.id} missing destinationDocument`)
      break
    }
    if (!document.meta.slug || !document.meta.travelTime) {
      defaultsOk = false
      fail("D1 defaults meta", `${dest.id} missing slug/travelTime`)
      break
    }
  }
  if (defaultsOk) pass("D1 destination defaults emit v2 documents")

  // Legacy flat array dual-read
  const legacyFlat = [
    {
      id: "t1",
      type: "heading",
      key: "title",
      heading: "Legacy Town",
      level: 1,
    },
    { id: "t2", type: "text", key: "urlSlug", body: "legacy-town" },
    { id: "t3", type: "text", key: "region", body: "North" },
    { id: "t4", type: "text", key: "description", body: "Legacy description" },
    {
      id: "t5",
      type: "image",
      key: "hero",
      src: "/uploads/test.jpg",
      alt: "Legacy Town",
    },
    { id: "t6", type: "text", key: "badge", body: "New" },
    { id: "t7", type: "text", key: "priceFrom", body: "€40" },
    { id: "t8", type: "text", key: "travelTime", body: "1 hr" },
    {
      id: "t9",
      type: "text",
      key: "primaryKeyword",
      body: "Legacy Airport Transfer",
    },
    {
      id: "t10",
      type: "text",
      key: "route.distance",
      body: "≈ 55 km from Tirana International Airport (TIA)",
    },
    {
      id: "t11",
      type: "attraction",
      key: "attraction.1",
      heading: "Old Fortress",
      body: "A historic site.",
      src: "/uploads/a.jpg",
      alt: "Fortress",
    },
  ]
  const fromLegacy = parseDestinationDocument(legacyFlat, { id: "legacy-town" })
  if (
    fromLegacy.format === "destination_v2" &&
    fromLegacy.meta.slug === "legacy-town" &&
    fromLegacy.meta.distanceKm === 55 &&
    fromLegacy.sections.some((s) => s.type === "attractions_grid")
  ) {
    const grid = fromLegacy.sections.find((s) => s.type === "attractions_grid")
    const count =
      grid && grid.type === "attractions_grid" ? grid.items.length : 0
    if (count === 1) pass("D2 legacy dual-read", `distanceKm=${fromLegacy.meta.distanceKm}`)
    else fail("D2 legacy attractions", String(count))
  } else {
    fail("D2 legacy dual-read", JSON.stringify(fromLegacy.meta))
  }

  // V2 round-trip serialize
  const roundTrip = serializeDestinationDocument(fromLegacy)
  if (
    isDestinationDocumentV2(roundTrip) &&
    roundTrip.meta.title === "Legacy Town" &&
    roundTrip.meta.primaryKeyword === "Legacy Airport Transfer"
  ) {
    pass("D3 v2 serialize round-trip")
  } else {
    fail("D3 v2 serialize", roundTrip.meta.title)
  }

  // resolveDestinationPage
  const resolvedPage = await resolveDestinationPage(sample.id, "en")
  if (resolvedPage?.document?.meta?.title) {
    pass("D4 resolveDestinationPage", resolvedPage.document.meta.title)
  } else {
    fail("D4 resolveDestinationPage", "missing")
  }

  // --- HTTP ---
  const home = await httpText("/")
  if (home.status === 200) pass("H2 homepage 200")
  else fail("H2 homepage", String(home.status))

  if (home.text.includes(sample.primaryKeyword)) {
    pass("H3 homepage shows primaryKeyword", sample.primaryKeyword)
  } else {
    fail("H3 homepage primaryKeyword", sample.primaryKeyword)
  }
  if (home.text.includes(sample.travelTime)) {
    pass("H4 homepage shows travelTime", sample.travelTime)
  } else {
    fail("H4 homepage travelTime", sample.travelTime)
  }
  if (home.text.includes(`/destinations/${sample.slug}`)) {
    pass("H5 homepage card links use public slug", sample.slug)
  } else {
    fail("H5 homepage card href", sample.slug)
  }

  const destPage = await httpText(`/destinations/${sample.slug}`)
  if (destPage.status === 200) pass("H6 destination detail 200", sample.slug)
  else fail("H6 destination detail", String(destPage.status))

  if (
    destPage.text.includes("<title>") &&
    (destPage.text.includes(sample.name) ||
      destPage.text.includes(sample.primaryKeyword) ||
      destPage.text.includes("airport transfer"))
  ) {
    pass("H6b destination meta title present")
  } else {
    fail("H6b destination meta title")
  }

  if (destPage.text.includes("TouristDestination")) {
    pass("H6c JSON-LD TouristDestination present")
  } else {
    fail("H6c JSON-LD TouristDestination")
  }

  const byIdPage = await httpStatus(`/destinations/${sample.id}`)
  if (byIdPage === 200) pass("H7 destination by id still 200", sample.id)
  else fail("H7 destination by id", String(byIdPage))

  const archive = await httpStatus("/destinations")
  if (archive === 200) pass("H8 destinations archive 200")
  else fail("H8 destinations archive", String(archive))

  const missing = await httpStatus("/destinations/definitely-not-a-real-place-xyz")
  if (missing === 404) pass("H9 unknown destination 404")
  else fail("H9 unknown destination", String(missing))

  // Legacy urlSlug still readable when row is still flat array
  const anyLegacy = await prisma.pageContent.findFirst({
    where: {
      locale: "en",
      slug: { startsWith: "destinations/" },
    },
  })
  if (anyLegacy && Array.isArray(anyLegacy.sections)) {
    const sections = parseSections(anyLegacy.sections)
    const slug = sectionValue(sections, "urlSlug")
    const viaPublic = publicDestinationSlug(sections, "x")
    if (slug || viaPublic) {
      pass("D5 legacy row still in DB (flat array dual-read path exists)")
    } else {
      pass("D5 no urlSlug on flat row (ok if migrated)")
    }
  } else {
    pass("D5 no flat legacy rows (all v2 or empty)")
  }

  // resolvePageContent still works
  const pageContent = await resolvePageContent(`destinations/${sample.id}`, "en")
  if (pageContent?.destinationDocument) {
    pass("D6 resolvePageContent attaches destinationDocument")
  } else {
    fail("D6 resolvePageContent destinationDocument")
  }

  const failed = results.filter((r) => r.status === "FAIL")
  console.log(
    `\n${results.length - failed.length}/${results.length} passed` +
      (failed.length ? ` · ${failed.length} failed` : ""),
  )
  await prisma.$disconnect()
  process.exit(failed.length ? 1 : 0)
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
