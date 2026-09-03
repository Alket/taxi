/**
 * QA for Destination JSON import/export (admin paste path).
 * Run: npm run test:destination-json
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import {
  applyDestinationJsonToPage,
  pageContentToDestinationDocument,
} from "../lib/apply-destination-json"
import { destinationDocumentFromSeed } from "../lib/destination-document"
import {
  DESTINATION_JSON_TEXT_MAX,
  parseDestinationDocumentJson,
  parseDestinationDocumentJsonText,
  safeParseDestinationDocumentJson,
} from "../lib/destination-json-schema"
import { DESTINATIONS } from "../lib/destinations"
import type { PageContentRecord } from "../lib/page-content-shared"

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

function sampleDoc() {
  const dest = DESTINATIONS.find((d) => d.id === "tirana") ?? DESTINATIONS[0]
  if (!dest) throw new Error("DESTINATIONS empty")
  return destinationDocumentFromSeed(dest, {
    distance: "17 km from Tirana Airport",
    duration: "20–25 min",
    whyBook: "Fixed fare airport transfer.",
  })
}

function fakePage(slugId: string): PageContentRecord {
  return {
    slug: `destinations/${slugId}`,
    label: `Destination · ${slugId}`,
    title: "SEO",
    description: "Desc",
    ogImage: "",
    sections: [],
    fromDatabase: true,
    locale: "en",
  }
}

function main() {
  console.log("\nQA destination JSON import\n")

  const seed = sampleDoc()
  try {
    const parsed = parseDestinationDocumentJson(seed)
    if (
      parsed.format === "destination_v2" &&
      parsed.meta.slug === seed.meta.slug &&
      parsed.sections.length === seed.sections.length
    ) {
      pass(
        "V1 parseDestinationDocumentJson seed",
        `${parsed.sections.length} sections`,
      )
    } else {
      fail("V1 parseDestinationDocumentJson seed", "shape mismatch")
    }
  } catch (e) {
    fail("V1 parseDestinationDocumentJson seed", (e as Error).message)
  }

  try {
    const text = JSON.stringify(seed, null, 2)
    const reparsed = parseDestinationDocumentJsonText(text)
    if (reparsed.meta.title === seed.meta.title) {
      pass("V2 parseDestinationDocumentJsonText round-trip")
    } else {
      fail("V2 parseDestinationDocumentJsonText round-trip", "title mismatch")
    }
  } catch (e) {
    fail("V2 parseDestinationDocumentJsonText round-trip", (e as Error).message)
  }

  try {
    parseDestinationDocumentJsonText("{ not json")
    fail("V3 reject invalid JSON", "should throw")
  } catch (e) {
    if ((e as Error).message.includes("Invalid JSON")) {
      pass("V3 reject invalid JSON")
    } else {
      fail("V3 reject invalid JSON", (e as Error).message)
    }
  }

  const bad = safeParseDestinationDocumentJson({
    format: "destination_v2",
    meta: { title: "x" },
  })
  if (!bad.success) {
    pass("V4 reject incomplete document")
  } else {
    fail("V4 reject incomplete document", "unexpected success")
  }

  try {
    const huge = "x".repeat(DESTINATION_JSON_TEXT_MAX + 1)
    parseDestinationDocumentJsonText(huge)
    fail("V5 reject oversized text", "should throw")
  } catch (e) {
    if ((e as Error).message.includes("too large")) {
      pass("V5 reject oversized text")
    } else {
      fail("V5 reject oversized text", (e as Error).message)
    }
  }

  try {
    const page: PageContentRecord = {
      ...fakePage("tirana"),
      title: seed.meta.title,
      description: seed.meta.description,
      ogImage: seed.sections.find((s) => s.type === "hero")?.src ?? "",
      destinationDocument: seed,
    }
    const exported = pageContentToDestinationDocument(page)
    if (!exported) {
      fail("R1 pageContentToDestinationDocument", "null")
    } else {
      const text = JSON.stringify(exported)
      const reparsed = parseDestinationDocumentJsonText(text)
      const applied = applyDestinationJsonToPage(page, {
        ...reparsed,
        meta: {
          ...reparsed.meta,
          slug: "wrong-slug",
          title: "Translated Tirana",
        },
      })
      if (
        applied.slugMismatch &&
        applied.pageSlug === "tirana" &&
        applied.page.destinationDocument?.meta.slug === "tirana" &&
        applied.page.title === "Translated Tirana"
      ) {
        pass("R2 apply locks URL slug + syncs title")
      } else {
        fail(
          "R2 apply locks URL slug + syncs title",
          JSON.stringify({
            mismatch: applied.slugMismatch,
            pageSlug: applied.pageSlug,
            metaSlug: applied.page.destinationDocument?.meta.slug,
            title: applied.page.title,
          }),
        )
      }
    }
  } catch (e) {
    fail("R* export/apply", (e as Error).message)
  }

  const home: PageContentRecord = {
    slug: "home",
    label: "Home",
    title: "Home",
    description: "",
    ogImage: "",
    sections: [],
    fromDatabase: true,
  }
  if (pageContentToDestinationDocument(home) === null) {
    pass("R3 non-destination export null")
  } else {
    fail("R3 non-destination export null", "expected null")
  }

  const editor = readFileSync(
    resolve("components/admin/page-editor-view.tsx"),
    "utf8",
  )
  const dialog = readFileSync(
    resolve("components/admin/destination-json-dialog.tsx"),
    "utf8",
  )
  if (
    editor.includes("DestinationJsonDialog") &&
    editor.includes("destinationJsonOpen") &&
    dialog.includes("Destination JSON")
  ) {
    pass("W1 page editor wires DestinationJsonDialog")
  } else {
    fail("W1 page editor wires DestinationJsonDialog")
  }

  const fails = results.filter((r) => r.status === "FAIL").length
  const passes = results.filter((r) => r.status === "PASS").length
  console.log(`\n${passes} PASS / ${fails} FAIL (${results.length} checks)\n`)
  process.exit(fails > 0 ? 1 : 0)
}

main()
