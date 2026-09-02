/**
 * QA: multi-locale transfer CMS + JSON import/export wiring.
 *
 * Covers locale tabs, EN→IT save/resolve fallback, public SEO helpers,
 * and Transfer JSON parse/apply (same path as admin paste).
 *
 * Run: npm run test:transfer-locale
 * Also: npm run test:transfer-json (JSON-only unit suite)
 */
import { existsSync, readFileSync } from "fs"
import { resolve } from "path"

import { config as loadEnv } from "dotenv"
import { PrismaClient } from "@prisma/client"

loadEnv({ path: resolve(process.cwd(), ".env") })

const runningInDocker = existsSync("/.dockerenv")
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    "postgresql://postgres:postgres@127.0.0.1:5432/taxi?schema=public"
} else if (!runningInDocker && /@db(?=:\d+)/.test(process.env.DATABASE_URL)) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(
    /@db(?=:\d+)/,
    "@127.0.0.1",
  )
}

import { applyTransferJsonToSeed } from "../lib/transfers/apply-transfer-json"
import {
  getAdminTransfer,
  hasTransferLocaleRow,
  resolveTransferSeed,
  saveTransferSeed,
} from "../lib/transfers/cms"
import {
  getRouteData,
  getTransferSeed,
  listTransferRouteSlugs,
  listTransferSeeds,
  transferCmsSlug,
} from "../lib/transfers/routes"
import {
  TRANSFER_JSON_TEXT_MAX,
  parseTransferSeedJson,
  parseTransferSeedJsonText,
  safeParseTransferSeedJson,
  unwrapTransferJson,
} from "../lib/transfers/transfer-seed-schema"
import { localizedAlternates } from "../lib/i18n/locales"

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

function read(rel: string) {
  return readFileSync(resolve(rel), "utf8")
}

function printSummary() {
  const fails = results.filter((r) => r.status === "FAIL").length
  const passes = results.filter((r) => r.status === "PASS").length
  console.log(`\n${passes} PASS / ${fails} FAIL (${results.length} checks)\n`)
}

async function main() {
  console.log("\nQA transfer locale + JSON\n")

  // --- Static wiring ---
  const required = [
    "lib/transfers/cms.ts",
    "lib/transfers/transfer-seed-schema.ts",
    "lib/transfers/apply-transfer-json.ts",
    "components/admin/transfer-json-dialog.tsx",
    "components/admin/transfer-editor-view.tsx",
    "app/api/admin/transfers/[slug]/route.ts",
    "app/(booking)/transfers/[slug]/page.tsx",
  ]
  let filesOk = true
  for (const file of required) {
    if (!existsSync(resolve(file))) {
      filesOk = false
      fail("S1 files", `missing ${file}`)
      break
    }
  }
  if (filesOk) pass("S1 transfer locale/JSON files present")

  const cms = read("lib/transfers/cms.ts")
  if (
    cms.includes("hasTransferLocaleRow") &&
    cms.includes("normalizeLocale") &&
    cms.includes("loadTransferSeedFromCms") &&
    cms.includes("resolveTransferSeed")
  ) {
    pass("S2 cms locale helpers")
  } else {
    fail("S2 cms locale helpers")
  }

  const editor = read("components/admin/transfer-editor-view.tsx")
  if (
    editor.includes("LOCALES.map") &&
    editor.includes("TransferJsonDialog") &&
    editor.includes("hasLocaleRow") &&
    editor.includes("localePath")
  ) {
    pass("S3 editor locale tabs + JSON dialog")
  } else {
    fail("S3 editor locale tabs + JSON dialog")
  }

  const api = read("app/api/admin/transfers/[slug]/route.ts")
  if (
    api.includes("localeFromRequest") &&
    api.includes("hasLocaleRow") &&
    api.includes("saveTransferSeed")
  ) {
    pass("S4 admin API locale query/body")
  } else {
    fail("S4 admin API locale")
  }

  const page = read("app/(booking)/transfers/[slug]/page.tsx")
  if (
    page.includes("localizedAlternates") &&
    page.includes("getRouteData(slug, locale)") &&
    !page.includes("englishOnlyAlternates")
  ) {
    pass("S5 public page localizedAlternates")
  } else {
    fail("S5 public page SEO")
  }

  const sitemap = read("app/sitemap.ts")
  const transferBlock = sitemap.slice(
    sitemap.indexOf("listTransferRouteSlugs"),
    sitemap.indexOf("listTransferRouteSlugs") + 400,
  )
  if (
    transferBlock.includes("addPath(`/transfers/${slug}`") &&
    !transferBlock.includes("englishOnly: true")
  ) {
    pass("S6 sitemap transfers all locales")
  } else {
    fail("S6 sitemap transfers", transferBlock.slice(0, 120))
  }

  // --- JSON unit checks ---
  const seeds = listTransferSeeds()
  const base = seeds[0] ?? getTransferSeed("tirana-airport-to-saranda")
  if (!base) {
    fail("J0 fixture", "no seed")
  } else {
    pass("J0 fixture seed", base.slug)
    try {
      const parsed = parseTransferSeedJson(base)
      if (parsed.slug === base.slug) pass("J1 parse bare seed")
      else fail("J1 parse bare seed")
    } catch (e) {
      fail("J1 parse bare seed", (e as Error).message)
    }

    try {
      const wrapped = parseTransferSeedJson({
        format: "transfer_v1",
        seed: base,
      })
      if (wrapped.slug === base.slug) pass("J2 parse transfer_v1 wrapper")
      else fail("J2 parse transfer_v1 wrapper")
    } catch (e) {
      fail("J2 parse transfer_v1 wrapper", (e as Error).message)
    }

    const unwrapped = unwrapTransferJson({
      format: "transfer_v1",
      seed: { slug: "x" },
    })
    if (
      unwrapped &&
      typeof unwrapped === "object" &&
      (unwrapped as { slug?: string }).slug === "x"
    ) {
      pass("J3 unwrap helper")
    } else fail("J3 unwrap helper")

    try {
      parseTransferSeedJsonText("{bad")
      fail("J4 invalid JSON", "no throw")
    } catch {
      pass("J4 invalid JSON throws")
    }

    try {
      parseTransferSeedJsonText("x".repeat(TRANSFER_JSON_TEXT_MAX + 1))
      fail("J5 oversized", "no throw")
    } catch (e) {
      if (/too large/i.test((e as Error).message)) pass("J5 oversized throws")
      else fail("J5 oversized", (e as Error).message)
    }

    if (!safeParseTransferSeedJson({ ...base, slug: "BAD" }).success) {
      pass("J6 bad slug rejected")
    } else fail("J6 bad slug rejected")

    const applied = applyTransferJsonToSeed(base.slug, {
      ...base,
      slug: "other-slug",
      travelDescription: "IT body",
    })
    if (
      applied.slugMismatch &&
      applied.seed.slug === base.slug &&
      applied.seed.travelDescription === "IT body"
    ) {
      pass("J7 apply locks URL slug")
    } else fail("J7 apply locks URL slug")
  }

  // --- Live CMS locale ---
  let slug: string | null = null
  try {
    const slugs = await listTransferRouteSlugs()
    slug = slugs[0] ?? null
    if (!slug) {
      fail("L0 slug fixture", "none")
    } else {
      pass("L0 slug fixture", slug)

      const enAdmin = await getAdminTransfer(slug, "en")
      if (!enAdmin) {
        fail("L1 getAdminTransfer EN", "null")
      } else {
        pass("L1 getAdminTransfer EN", enAdmin.seed.destinationName)

        const marker = `[IT-QA-${Date.now()}]`
        const itBody = `${marker} Trasferimento privato da Tirana Airport a ${enAdmin.seed.destinationName}.`

        await saveTransferSeed(
          {
            ...enAdmin.seed,
            travelDescription: itBody,
          },
          "it",
        )
        pass("L2 saveTransferSeed IT")

        if (await hasTransferLocaleRow(slug, "it")) {
          pass("L3 hasTransferLocaleRow IT true")
        } else fail("L3 hasTransferLocaleRow IT")

        const itAdmin = await getAdminTransfer(slug, "it")
        if (
          itAdmin?.hasLocaleRow === true &&
          itAdmin.seed.travelDescription.includes(marker)
        ) {
          pass("L4 getAdminTransfer IT hasLocaleRow + body")
        } else {
          fail("L4 getAdminTransfer IT", itAdmin?.seed.travelDescription.slice(0, 60))
        }

        const enResolve = await resolveTransferSeed(slug, "en")
        const itResolve = await resolveTransferSeed(slug, "it")
        const deResolve = await resolveTransferSeed(slug, "de")

        if (!enResolve?.travelDescription.includes(marker)) {
          pass("L5 EN resolve unaffected by IT")
        } else fail("L5 EN resolve leaked IT")

        if (itResolve?.travelDescription.includes(marker)) {
          pass("L6 IT resolve uses IT row")
        } else fail("L6 IT resolve")

        // DE has no row → EN fallback (not IT)
        if (
          deResolve &&
          !deResolve.travelDescription.includes(marker) &&
          deResolve.travelDescription === enResolve?.travelDescription
        ) {
          pass("L7 DE falls back to EN not IT")
        } else if (deResolve && !deResolve.travelDescription.includes(marker)) {
          pass("L7 DE falls back without IT marker")
        } else {
          fail("L7 DE fallback", deResolve?.travelDescription.slice(0, 60))
        }

        const routeIt = await getRouteData(slug, "it")
        if (routeIt?.travelDescription.includes(marker)) {
          pass("L8 getRouteData IT")
        } else fail("L8 getRouteData IT")

        const alt = localizedAlternates(`/transfers/${slug}`, "it")
        if (
          alt.canonical === `/it/transfers/${slug}` &&
          alt.languages.en === `/transfers/${slug}` &&
          alt.languages.it === `/it/transfers/${slug}`
        ) {
          pass("L9 localizedAlternates hreflang")
        } else {
          fail("L9 localizedAlternates", JSON.stringify(alt))
        }
      }
    }
  } catch (err) {
    fail("L fatal", (err as Error).message)
  } finally {
    if (slug) {
      await prisma.pageContent.deleteMany({
        where: { slug: transferCmsSlug(slug), locale: "it" },
      })
      pass("L10 cleaned IT QA row")
    }
  }

  printSummary()
  const fails = results.filter((r) => r.status === "FAIL").length
  await prisma.$disconnect()
  process.exit(fails > 0 ? 1 : 0)
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
