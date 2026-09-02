/**
 * QA for Transfer JSON import/export (admin paste path).
 * Run: npm run test:transfer-json
 */
import {
  applyTransferJsonToSeed,
} from "../lib/transfers/apply-transfer-json"
import { getTransferSeed, listTransferSeeds } from "../lib/transfers/routes"
import {
  TRANSFER_JSON_TEXT_MAX,
  parseTransferSeedJson,
  parseTransferSeedJsonText,
  safeParseTransferSeedJson,
  unwrapTransferJson,
} from "../lib/transfers/transfer-seed-schema"

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

function main() {
  console.log("\nQA transfer JSON import\n")

  const seeds = listTransferSeeds()
  const base = seeds[0] ?? getTransferSeed("tirana-airport-to-saranda")
  if (!base) {
    fail("fixture", "no transfer seed")
    finish()
    return
  }
  pass("fixture seed", base.slug)

  try {
    const parsed = parseTransferSeedJson(base)
    if (parsed.slug === base.slug && parsed.destinationName === base.destinationName) {
      pass("V1 parseTransferSeedJson seed", parsed.destinationName)
    } else fail("V1 parseTransferSeedJson seed", "shape mismatch")
  } catch (e) {
    fail("V1 parseTransferSeedJson seed", (e as Error).message)
  }

  const wrapped = {
    format: "transfer_v1" as const,
    seed: base,
    flags: { hidden: false },
  }
  const unwrapped = unwrapTransferJson(wrapped)
  if (
    unwrapped &&
    typeof unwrapped === "object" &&
    "slug" in (unwrapped as object)
  ) {
    pass("V2 unwrap transfer_v1 wrapper")
  } else fail("V2 unwrap transfer_v1 wrapper")

  try {
    const fromWrapped = parseTransferSeedJson(wrapped)
    if (fromWrapped.slug === base.slug) pass("V3 parse wrapped document")
    else fail("V3 parse wrapped document", fromWrapped.slug)
  } catch (e) {
    fail("V3 parse wrapped document", (e as Error).message)
  }

  const text = JSON.stringify(base)
  try {
    const fromText = parseTransferSeedJsonText(text)
    if (fromText.slug === base.slug) pass("V4 parseTransferSeedJsonText")
    else fail("V4 parseTransferSeedJsonText", fromText.slug)
  } catch (e) {
    fail("V4 parseTransferSeedJsonText", (e as Error).message)
  }

  try {
    parseTransferSeedJsonText("{ not json")
    fail("V5 invalid JSON throws", "did not throw")
  } catch {
    pass("V5 invalid JSON throws")
  }

  try {
    parseTransferSeedJsonText("x".repeat(TRANSFER_JSON_TEXT_MAX + 1))
    fail("V6 oversized JSON throws", "did not throw")
  } catch (e) {
    if (/too large/i.test((e as Error).message)) pass("V6 oversized JSON throws")
    else fail("V6 oversized JSON throws", (e as Error).message)
  }

  const bad = safeParseTransferSeedJson({
    ...base,
    slug: "NOT_VALID",
  })
  if (!bad.success) pass("V7 invalid slug rejected")
  else fail("V7 invalid slug rejected")

  const applied = applyTransferJsonToSeed(base.slug, {
    ...base,
    slug: "some-other-slug",
    travelDescription: "Translated body for IT",
  })
  if (
    applied.seed.slug === base.slug &&
    applied.slugMismatch &&
    applied.seed.travelDescription === "Translated body for IT"
  ) {
    pass("A1 apply locks URL slug", applied.pageSlug)
  } else {
    fail("A1 apply locks URL slug", JSON.stringify(applied))
  }

  const same = applyTransferJsonToSeed(base.slug, base)
  if (!same.slugMismatch && same.seed.slug === base.slug) {
    pass("A2 apply matching slug")
  } else fail("A2 apply matching slug")

  // Italian-style paste: keep structural fields, translate copy
  const itPaste = {
    ...base,
    travelDescription: `Trasferimento privato da Tirana Airport a ${base.destinationName}.`,
    routeFaqs: base.routeFaqs.map((f) => ({
      question: `[IT] ${f.question}`,
      answer: `[IT] ${f.answer}`,
    })),
    insights: (base.insights ?? []).map((i) => ({
      title: `[IT] ${i.title}`,
      body: `[IT] ${i.body}`,
    })),
  }
  try {
    const it = parseTransferSeedJson(itPaste)
    const merged = applyTransferJsonToSeed(base.slug, it)
    if (
      merged.seed.travelDescription.startsWith("Trasferimento") &&
      merged.seed.slug === base.slug
    ) {
      pass("A3 Italian copy paste keeps slug")
    } else fail("A3 Italian copy paste", merged.seed.travelDescription.slice(0, 40))
  } catch (e) {
    fail("A3 Italian copy paste", (e as Error).message)
  }

  finish()
}

function finish() {
  const failed = results.filter((r) => r.status === "FAIL")
  console.log(
    `\n${results.length - failed.length}/${results.length} passed` +
      (failed.length ? ` · ${failed.length} failed` : ""),
  )
  if (failed.length) process.exit(1)
}

main()
