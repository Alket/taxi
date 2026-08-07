/**
 * Smoke checks for marketing/booking i18n + locale switching.
 * Run: npx tsx scripts/smoke-i18n.ts
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import {
  DEFAULT_LOCALE,
  LOCALES,
  isLocale,
  localeFromPathname,
  localePath,
  stripLocalePrefix,
} from "@/lib/i18n/locales"
import { t } from "@/lib/i18n/t"

const ROOT = path.join(process.cwd(), "messages")

const REQUIRED_KEYS = [
  "nav.book",
  "footer.tagline",
  "footer.location",
  "footer.whatsapp",
  "book.time",
  "book.minNotice",
  "book.typeToSearch",
  "book.noMatchingPlaces",
  "book.meetAndGreetDesc",
  "book.leaveTitle",
  "book.choosePaymentMethod",
  "book.confirmingBooking",
  "destinations.airportTransfer",
  "destinations.distance",
  "destinations.travelTime",
  "confirm.title",
  "confirm.manage",
  "lang.label",
] as const

let failures = 0

function check(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (error) {
    failures += 1
    const message = error instanceof Error ? error.message : String(error)
    console.error(`  ✗ ${name}`)
    console.error(`    ${message}`)
  }
}

console.log("1) Message catalogs")
const catalogs = Object.fromEntries(
  LOCALES.map((locale) => {
    const file = path.join(ROOT, `${locale}.json`)
    assert.ok(fs.existsSync(file), `missing ${locale}.json`)
    return [locale, JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, string>]
  }),
) as Record<(typeof LOCALES)[number], Record<string, string>>

const enKeys = Object.keys(catalogs.en).sort()

check("all locales have the same keys as English", () => {
  for (const locale of LOCALES) {
    if (locale === "en") continue
    const keys = Object.keys(catalogs[locale]).sort()
    assert.deepEqual(
      keys,
      enKeys,
      `${locale}.json key set differs from en.json`,
    )
  }
})

check("required UI keys exist in every locale and are non-empty", () => {
  for (const locale of LOCALES) {
    for (const key of REQUIRED_KEYS) {
      const value = catalogs[locale][key]
      assert.ok(typeof value === "string" && value.trim(), `${locale}:${key}`)
    }
  }
})

check("interpolation placeholders are preserved vs English", () => {
  const placeholder = /\{[a-zA-Z0-9_]+\}/g
  for (const key of REQUIRED_KEYS) {
    const enVars = new Set(catalogs.en[key].match(placeholder) ?? [])
    if (enVars.size === 0) continue
    for (const locale of LOCALES) {
      const vars = new Set(catalogs[locale][key].match(placeholder) ?? [])
      assert.deepEqual(
        [...vars].sort(),
        [...enVars].sort(),
        `${locale}:${key} placeholders`,
      )
    }
  }
})

console.log("\n2) localePath / stripLocalePrefix")
check("English stays unprefixed", () => {
  assert.equal(localePath("/book", "en"), "/book")
  assert.equal(localePath("/destinations/tirana", "en"), "/destinations/tirana")
  assert.equal(localePath("/#book", "en"), "/#book")
})

check("non-English locales get prefix", () => {
  assert.equal(localePath("/book", "it"), "/it/book")
  assert.equal(localePath("/", "de"), "/de")
  // Root + hash becomes `/{locale}#hash` (no trailing slash before hash).
  assert.equal(localePath("/#book", "it"), "/it#book")
  assert.equal(
    localePath("/book/confirmation/ABC123", "pl"),
    "/pl/book/confirmation/ABC123",
  )
})

check("stripLocalePrefix is idempotent for booking paths", () => {
  assert.equal(stripLocalePrefix("/it/book"), "/book")
  assert.equal(stripLocalePrefix("/book"), "/book")
  assert.equal(stripLocalePrefix("/ru/destinations"), "/destinations")
  assert.equal(stripLocalePrefix("/"), "/")
})

check("localeFromPathname reads prefix", () => {
  assert.equal(localeFromPathname("/it/book"), "it")
  assert.equal(localeFromPathname("/book"), "en")
  assert.equal(localeFromPathname("/de"), "de")
})

check("isLocale accepts supported codes only", () => {
  assert.equal(isLocale("it"), true)
  assert.equal(isLocale("fr"), false)
  assert.equal(isLocale(DEFAULT_LOCALE), true)
})

console.log("\n3) t() helper")
check("falls back to English when key missing in locale dict is impossible for required keys", () => {
  for (const locale of LOCALES) {
    const value = t(locale, "book.time")
    assert.ok(value.trim())
    assert.notEqual(value, "book.time")
  }
})

check("interpolates variables", () => {
  const value = t("it", "book.minNotice", { lead: "1 hour" })
  assert.match(value, /1 hour/)
  assert.ok(!value.includes("{lead}"))
})

check("destination title interpolates name", () => {
  const value = t("de", "destinations.airportTransfer", { name: "Tirana" })
  assert.match(value, /Tirana/)
})

console.log("\n4) Language-switch hard-reload contract")
check("switching locale builds a distinct href for every locale", () => {
  const base = "/destinations/tirana"
  const hrefs = new Set(LOCALES.map((locale) => localePath(base, locale)))
  assert.equal(hrefs.size, LOCALES.length)
  assert.ok(hrefs.has("/destinations/tirana"))
  assert.ok(hrefs.has("/it/destinations/tirana"))
})

check("booking leave-guard paths normalize with stripLocalePrefix", () => {
  const isBookingFlowPath = (pathname: string) => {
    const pathOnly = stripLocalePrefix(pathname)
    return pathOnly === "/" || pathOnly === "/book"
  }
  assert.equal(isBookingFlowPath("/"), true)
  assert.equal(isBookingFlowPath("/book"), true)
  assert.equal(isBookingFlowPath("/it"), true)
  assert.equal(isBookingFlowPath("/it/book"), true)
  assert.equal(isBookingFlowPath("/it/destinations"), false)
  assert.equal(isBookingFlowPath("/book/confirmation/X"), false)
})

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`)
  process.exit(1)
}

console.log("\nAll i18n smoke checks passed.")
