/**
 * QA for destination CMS fields + public routing/cards.
 * Run: npx tsx scripts/qa-destinations.ts
 */
import { PrismaClient } from "@prisma/client"

import { DESTINATIONS } from "../lib/destinations"
import {
  ensureMissingDefaultSections,
  parseSections,
  sectionValue,
} from "../lib/page-content-shared"
import {
  publicDestinationSlug,
  resolveDestination,
  resolveDestinationCards,
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

  // Temporary custom urlSlug round-trip on EN tirana (restore after)
  const tiranaSlug = "destinations/tirana"
  const enRow = await prisma.pageContent.findUnique({
    where: { slug_locale: { slug: tiranaSlug, locale: "en" } },
  })
  if (!enRow) {
    fail("C4 EN tirana row", "missing")
  } else {
    const def = await resolvePageDefinition(tiranaSlug)
    const original = parseSections(enRow.sections)
    const withDefaults = ensureMissingDefaultSections(
      original,
      def?.defaults.sections ?? [],
    )
    const marker = `qa-tirana-${Date.now().toString(36)}`
    const mutated = withDefaults.map((section) =>
      section.key === "urlSlug" ? { ...section, body: marker } : section,
    )
    await prisma.pageContent.update({
      where: { id: enRow.id },
      data: { sections: mutated },
    })

    const resolved = await resolveDestination(marker, "en")
    if (resolved?.id === "tirana" && resolved.slug === marker) {
      pass("C4 custom urlSlug resolves", marker)
    } else {
      fail(
        "C4 custom urlSlug resolves",
        JSON.stringify({ id: resolved?.id, slug: resolved?.slug }),
      )
    }

    const pageViaCustom = await resolvePageContent(
      `destinations/${resolved?.id ?? "tirana"}`,
      "en",
    )
    if (pageViaCustom && publicDestinationSlug(pageViaCustom.sections, "tirana") === marker) {
      pass("C5 CMS urlSlug field readable")
    } else {
      fail("C5 CMS urlSlug field", publicDestinationSlug(pageViaCustom?.sections ?? [], "tirana"))
    }

    // HTTP with custom slug
    const customPage = await httpStatus(`/destinations/${marker}`)
    if (customPage === 200) pass("H1 /destinations/{customSlug} 200", String(customPage))
    else fail("H1 /destinations/{customSlug}", String(customPage))

    // Restore original urlSlug
    await prisma.pageContent.update({
      where: { id: enRow.id },
      data: { sections: original },
    })
    const restored = await resolveDestination("tirana", "en")
    if (restored?.slug === "tirana" || restored?.slug === sectionValue(original, "urlSlug") || restored?.id === "tirana") {
      pass("C6 restored urlSlug", restored?.slug || "")
    } else {
      fail("C6 restore", restored?.slug || "missing")
    }
  }

  // Built-in defaults include new keys
  let defaultsOk = true
  for (const dest of DESTINATIONS) {
    const def = await resolvePageDefinition(`destinations/${dest.id}`)
    const keys = new Set(def?.defaults.sections.map((s) => s.key))
    for (const need of ["urlSlug", "travelTime", "primaryKeyword"]) {
      if (!keys.has(need)) {
        defaultsOk = false
        fail("D1 defaults keys", `${dest.id} missing ${need}`)
        break
      }
    }
    if (!defaultsOk) break
  }
  if (defaultsOk) pass("D1 destination defaults include new section keys")

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

  const destPage = await httpStatus(`/destinations/${sample.slug}`)
  if (destPage === 200) pass("H6 destination detail 200", sample.slug)
  else fail("H6 destination detail", String(destPage))

  const byIdPage = await httpStatus(`/destinations/${sample.id}`)
  if (byIdPage === 200) pass("H7 destination by id still 200", sample.id)
  else fail("H7 destination by id", String(byIdPage))

  const archive = await httpStatus("/destinations")
  if (archive === 200) pass("H8 destinations archive 200")
  else fail("H8 destinations archive", String(archive))

  const missing = await httpStatus("/destinations/definitely-not-a-real-place-xyz")
  if (missing === 404) pass("H9 unknown destination 404")
  else fail("H9 unknown destination", String(missing))

  // Uber alt section still present on home
  if (home.text.includes("uber-alternative") || home.text.includes("No Uber in Albania")) {
    pass("H10 uber-alt section on homepage")
  } else {
    fail("H10 uber-alt section", "not found")
  }

  const bookingConfig = await fetch(`${base}/api/booking/config`).then((r) =>
    r.json(),
  )
  if (
    Array.isArray(bookingConfig.enabledVehicleTypes) &&
    typeof bookingConfig.sedanEnabled === "boolean"
  ) {
    pass("A1 booking config vehicle flags", JSON.stringify(bookingConfig.enabledVehicleTypes))
  } else {
    fail("A1 booking config vehicle flags", JSON.stringify(bookingConfig).slice(0, 120))
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

main().catch(async (error) => {
  console.error(error)
  await prisma.$disconnect()
  process.exit(1)
})
