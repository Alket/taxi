/**
 * Transfer route CMS — stores editable TransferRouteSeed JSON in PageContent
 * under slug `transfers/{routeSlug}` (no Prisma schema change).
 */

import { prisma } from "@/lib/db"
import {
  DEFAULT_LOCALE,
  isLocale,
  type Locale,
} from "@/lib/i18n/locales"
import {
  type ComparisonOption,
  type RouteFaq,
  type RouteInsight,
  type TransferRoute,
  type TransferRouteSeed,
  TRANSFER_CMS_PREFIX,
  getTransferSeed,
  isBuiltInTransferSlug,
  listTransferSeeds,
  routeSlugFromCmsSlug,
  transferCmsSlug,
} from "@/lib/transfers/routes"
import {
  calculatePriceForZone,
  UncoveredDestinationError,
} from "@/lib/pricing"
import { getDestination } from "@/lib/destinations"
import type { VehicleType } from "@/lib/types"

export const TRANSFER_DOCUMENT_FORMAT = "transfer_v1" as const

export type TransferDocument = {
  format: typeof TRANSFER_DOCUMENT_FORMAT
  seed: TransferRouteSeed
  flags?: { hidden?: boolean }
}

export type AdminTransferListItem = {
  slug: string
  destinationName: string
  zoneName: string
  catalogPriceEur: number
  path: string
  fromDatabase: boolean
  isBuiltIn: boolean
  updatedAt: string | null
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return fallback
}

function normalizeFaq(raw: unknown): RouteFaq | null {
  if (!raw || typeof raw !== "object") return null
  const item = raw as Record<string, unknown>
  return {
    question: asString(item.question),
    answer: asString(item.answer),
  }
}

function normalizeInsight(raw: unknown): RouteInsight | null {
  if (!raw || typeof raw !== "object") return null
  const item = raw as Record<string, unknown>
  return {
    title: asString(item.title),
    body: asString(item.body),
  }
}

function normalizeComparison(raw: unknown): ComparisonOption | null {
  if (!raw || typeof raw !== "object") return null
  const item = raw as Record<string, unknown>
  return {
    mode: asString(item.mode),
    typicalTime: asString(item.typicalTime),
    changes: asString(item.changes),
    priceClarity: asString(item.priceClarity),
    highlight: Boolean(item.highlight) || undefined,
  }
}

export function isTransferDocument(data: unknown): data is TransferDocument {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false
  const obj = data as Record<string, unknown>
  return (
    obj.format === TRANSFER_DOCUMENT_FORMAT &&
    obj.seed != null &&
    typeof obj.seed === "object"
  )
}

export function normalizeTransferSeed(
  raw: unknown,
  fallbackSlug = "transfer",
): TransferRouteSeed {
  const s =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}
  const durationRaw =
    s.duration && typeof s.duration === "object"
      ? (s.duration as Record<string, unknown>)
      : {}
  const slug =
    asString(s.slug).trim() ||
    fallbackSlug

  return {
    slug,
    origin: asString(s.origin) || "Tirana International Airport (TIA)",
    destinationName: asString(s.destinationName) || slug,
    nameVariants: Array.isArray(s.nameVariants)
      ? s.nameVariants.filter((v): v is string => typeof v === "string")
      : [],
    destinationId: asString(s.destinationId),
    zoneName: asString(s.zoneName),
    distanceKm: asNumber(s.distanceKm),
    duration: {
      minMinutes: asNumber(durationRaw.minMinutes),
      maxMinutes: asNumber(durationRaw.maxMinutes),
      label: asString(durationRaw.label) || "—",
    },
    catalogPriceEur: asNumber(s.catalogPriceEur, 0),
    heroImageUrl: asString(s.heroImageUrl),
    travelDescription: asString(s.travelDescription),
    comparisonTable: Array.isArray(s.comparisonTable)
      ? s.comparisonTable
          .map(normalizeComparison)
          .filter((c): c is ComparisonOption => Boolean(c))
      : [],
    routeFaqs: Array.isArray(s.routeFaqs)
      ? s.routeFaqs
          .map(normalizeFaq)
          .filter((f): f is RouteFaq => Boolean(f && (f.question || f.answer)))
      : [],
    insights: Array.isArray(s.insights)
      ? s.insights
          .map(normalizeInsight)
          .filter((i): i is RouteInsight => Boolean(i && (i.title || i.body)))
      : [],
    relatedSlugs: Array.isArray(s.relatedSlugs)
      ? s.relatedSlugs.filter((v): v is string => typeof v === "string")
      : [],
  }
}

export function parseTransferDocument(
  raw: unknown,
  fallbackSlug?: string,
): TransferDocument | null {
  if (isTransferDocument(raw)) {
    return {
      format: TRANSFER_DOCUMENT_FORMAT,
      seed: normalizeTransferSeed(raw.seed, fallbackSlug || raw.seed.slug),
      flags: {
        hidden: Boolean(raw.flags?.hidden),
      },
    }
  }
  // Allow storing bare seed object for flexibility
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>
    if (typeof obj.slug === "string" && typeof obj.destinationName === "string") {
      return {
        format: TRANSFER_DOCUMENT_FORMAT,
        seed: normalizeTransferSeed(obj, fallbackSlug),
        flags: {},
      }
    }
  }
  return null
}

export function serializeTransferDocument(
  seed: TransferRouteSeed,
  flags?: { hidden?: boolean },
): TransferDocument {
  const normalized = normalizeTransferSeed(seed, seed.slug)
  return {
    format: TRANSFER_DOCUMENT_FORMAT,
    seed: normalized,
    flags: { hidden: Boolean(flags?.hidden) },
  }
}

async function resolveLivePriceEur(
  zoneName: string,
  vehicleType: VehicleType = "sedan",
): Promise<number | null> {
  if (!zoneName.trim()) return null
  try {
    const zone = await prisma.zone.findFirst({
      where: { name: zoneName, active: true },
      select: { id: true },
    })
    if (!zone) return null
    return await calculatePriceForZone(zone.id, vehicleType)
  } catch (error) {
    if (error instanceof UncoveredDestinationError) return null
    console.error(`[transfers] price lookup failed for zone "${zoneName}"`, error)
    return null
  }
}

function normalizeLocale(locale?: string | null): Locale {
  return isLocale(locale) ? locale : DEFAULT_LOCALE
}

export async function hasTransferLocaleRow(
  routeSlug: string,
  localeInput?: string | null,
): Promise<boolean> {
  const locale = normalizeLocale(localeInput)
  const row = await prisma.pageContent.findUnique({
    where: {
      slug_locale: {
        slug: transferCmsSlug(routeSlug),
        locale,
      },
    },
    select: { id: true },
  })
  return Boolean(row)
}

export async function loadTransferSeedFromCms(
  routeSlug: string,
  localeInput?: string | null,
): Promise<{ seed: TransferRouteSeed; hidden: boolean; updatedAt: string | null } | null> {
  const locale = normalizeLocale(localeInput)
  const row = await prisma.pageContent.findUnique({
    where: {
      slug_locale: {
        slug: transferCmsSlug(routeSlug),
        locale,
      },
    },
  })
  if (!row) return null
  const doc = parseTransferDocument(row.sections, routeSlug)
  if (!doc) return null
  return {
    seed: { ...doc.seed, slug: routeSlug },
    hidden: Boolean(doc.flags?.hidden),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** Resolve editable seed: locale CMS → EN CMS → code seed. */
export async function resolveTransferSeed(
  routeSlug: string,
  localeInput?: string | null,
): Promise<TransferRouteSeed | null> {
  const locale = normalizeLocale(localeInput)
  const localized = await loadTransferSeedFromCms(routeSlug, locale)
  if (localized && !localized.hidden) return localized.seed

  if (locale !== DEFAULT_LOCALE) {
    const en = await loadTransferSeedFromCms(routeSlug, DEFAULT_LOCALE)
    if (en?.hidden) return null
    if (en) return en.seed
  } else if (localized?.hidden) {
    return null
  }

  return getTransferSeed(routeSlug)
}

export async function hydrateTransferRoute(
  seed: TransferRouteSeed,
): Promise<TransferRoute> {
  const live = await resolveLivePriceEur(seed.zoneName)
  const dest = seed.destinationId
    ? getDestination(seed.destinationId)
    : null
  const catalogFromDest = dest?.priceFrom
    ? Number(String(dest.priceFrom).replace(/[^\d.]/g, ""))
    : NaN
  const fallback =
    Number.isFinite(catalogFromDest) && catalogFromDest > 0
      ? catalogFromDest
      : seed.catalogPriceEur

  const { catalogPriceEur: _c, ...rest } = seed
  return {
    ...rest,
    heroImageUrl: seed.heroImageUrl || dest?.image || "",
    priceEur: live ?? fallback,
    priceFromLiveQuote: live != null,
  }
}

export async function listCmsTransferSlugs(): Promise<string[]> {
  const rows = await prisma.pageContent.findMany({
    where: {
      locale: DEFAULT_LOCALE,
      slug: { startsWith: TRANSFER_CMS_PREFIX },
    },
    select: { slug: true, sections: true },
  })
  const out: string[] = []
  for (const row of rows) {
    const routeSlug = routeSlugFromCmsSlug(row.slug)
    if (!routeSlug) continue
    const doc = parseTransferDocument(row.sections, routeSlug)
    if (doc?.flags?.hidden) continue
    out.push(routeSlug)
  }
  return out
}

export async function listAdminTransfers(): Promise<AdminTransferListItem[]> {
  const seeds = listTransferSeeds()
  const builtInIds = new Set(seeds.map((s) => s.slug))
  const rows = await prisma.pageContent.findMany({
    where: {
      locale: DEFAULT_LOCALE,
      slug: { startsWith: TRANSFER_CMS_PREFIX },
    },
    select: { slug: true, sections: true, updatedAt: true },
  })
  const byRoute = new Map<
    string,
    { seed: TransferRouteSeed; updatedAt: string; hidden: boolean }
  >()
  for (const row of rows) {
    const routeSlug = routeSlugFromCmsSlug(row.slug)
    if (!routeSlug) continue
    const doc = parseTransferDocument(row.sections, routeSlug)
    if (!doc) continue
    byRoute.set(routeSlug, {
      seed: { ...doc.seed, slug: routeSlug },
      updatedAt: row.updatedAt.toISOString(),
      hidden: Boolean(doc.flags?.hidden),
    })
  }

  const items: AdminTransferListItem[] = []
  for (const seed of seeds) {
    const cms = byRoute.get(seed.slug)
    if (cms?.hidden) continue
    const effective = cms?.seed ?? seed
    items.push({
      slug: seed.slug,
      destinationName: effective.destinationName,
      zoneName: effective.zoneName,
      catalogPriceEur: effective.catalogPriceEur,
      path: `/transfers/${seed.slug}`,
      fromDatabase: Boolean(cms),
      isBuiltIn: true,
      updatedAt: cms?.updatedAt ?? null,
    })
  }

  for (const [routeSlug, cms] of byRoute) {
    if (builtInIds.has(routeSlug) || cms.hidden) continue
    items.push({
      slug: routeSlug,
      destinationName: cms.seed.destinationName,
      zoneName: cms.seed.zoneName,
      catalogPriceEur: cms.seed.catalogPriceEur,
      path: `/transfers/${routeSlug}`,
      fromDatabase: true,
      isBuiltIn: false,
      updatedAt: cms.updatedAt,
    })
  }

  return items.sort((a, b) => a.destinationName.localeCompare(b.destinationName))
}

export async function getAdminTransfer(
  routeSlug: string,
  localeInput?: string | null,
): Promise<{
  seed: TransferRouteSeed
  fromDatabase: boolean
  isBuiltIn: boolean
  livePriceEur: number | null
  updatedAt: string | null
  hasLocaleRow: boolean
  locale: Locale
} | null> {
  const locale = normalizeLocale(localeInput)
  const localeCms = await loadTransferSeedFromCms(routeSlug, locale)
  if (localeCms?.hidden) return null

  const hasLocaleRow = Boolean(localeCms)
  // Prefer locale row; otherwise prefill from EN CMS / code seed for editors.
  let seed = localeCms?.seed ?? null
  let updatedAt = localeCms?.updatedAt ?? null
  let fromDatabase = Boolean(localeCms)

  if (!seed) {
    const enCms =
      locale === DEFAULT_LOCALE
        ? null
        : await loadTransferSeedFromCms(routeSlug, DEFAULT_LOCALE)
    if (enCms?.hidden) return null
    seed = enCms?.seed ?? getTransferSeed(routeSlug) ?? null
    updatedAt = enCms?.updatedAt ?? null
    fromDatabase = false
  }

  if (!seed) return null
  const live = await resolveLivePriceEur(seed.zoneName)
  return {
    seed,
    fromDatabase,
    isBuiltIn: isBuiltInTransferSlug(routeSlug),
    livePriceEur: live,
    updatedAt,
    hasLocaleRow,
    locale,
  }
}

export async function saveTransferSeed(
  seedInput: TransferRouteSeed,
  localeInput?: string | null,
): Promise<TransferRouteSeed> {
  const locale = normalizeLocale(localeInput)
  const seed = normalizeTransferSeed(seedInput, seedInput.slug)
  if (!seed.slug) throw new Error("Slug is required.")
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(seed.slug)) {
    throw new Error("Slug must be lowercase letters, numbers, and hyphens.")
  }
  if (!seed.destinationName.trim()) {
    throw new Error("Destination name is required.")
  }

  const cmsSlug = transferCmsSlug(seed.slug)
  const existing = await loadTransferSeedFromCms(seed.slug, locale)
  const doc = serializeTransferDocument(seed, {
    hidden: existing?.hidden ? false : false,
  })

  await prisma.pageContent.upsert({
    where: {
      slug_locale: { slug: cmsSlug, locale },
    },
    create: {
      slug: cmsSlug,
      locale,
      label: `Transfer · ${seed.destinationName}`,
      title: `Tirana Airport to ${seed.destinationName} Transfer`,
      description: seed.travelDescription.slice(0, 2000),
      ogImage: seed.heroImageUrl,
      sections: doc,
    },
    update: {
      label: `Transfer · ${seed.destinationName}`,
      title: `Tirana Airport to ${seed.destinationName} Transfer`,
      description: seed.travelDescription.slice(0, 2000),
      ogImage: seed.heroImageUrl,
      sections: doc,
    },
  })

  return seed
}

export async function createTransferSeed(input: {
  destinationName: string
  slug?: string
  zoneName?: string
  destinationId?: string
}): Promise<TransferRouteSeed> {
  const name = input.destinationName.trim()
  if (!name) throw new Error("Destination name is required.")

  const slug =
    (input.slug?.trim() ||
      `tirana-airport-to-${name
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")}`).slice(0, 80)

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("Slug must be lowercase letters, numbers, and hyphens.")
  }

  const existing = await resolveTransferSeed(slug)
  if (existing) throw new Error("That transfer route already exists.")

  const seed: TransferRouteSeed = {
    slug,
    origin: "Tirana International Airport (TIA)",
    destinationName: name,
    nameVariants: [],
    destinationId: input.destinationId?.trim() || "",
    zoneName: input.zoneName?.trim() || name,
    distanceKm: 0,
    duration: { minMinutes: 0, maxMinutes: 0, label: "" },
    catalogPriceEur: 0,
    heroImageUrl: "",
    travelDescription: `Private transfer from Tirana Airport (TIA) to ${name}. Fixed fare, flight tracking, cash on arrival.`,
    comparisonTable: [
      {
        mode: "Private transfer",
        typicalTime: "—",
        changes: "Door to door",
        priceClarity: "Fixed quote",
        highlight: true,
      },
      {
        mode: "Public bus / shared",
        typicalTime: "—",
        changes: "Often 1+",
        priceClarity: "Varies",
      },
      {
        mode: "Street taxi (terminal)",
        typicalTime: "—",
        changes: "Negotiate at curb",
        priceClarity: "Uncertain",
      },
    ],
    routeFaqs: [],
    insights: [],
    relatedSlugs: listTransferSeeds()
      .map((s) => s.slug)
      .filter((s) => s !== slug)
      .slice(0, 2),
  }

  return saveTransferSeed(seed)
}

/** Reset built-in to code defaults (delete CMS row) or hard-delete custom. */
export async function deleteOrResetTransfer(
  routeSlug: string,
): Promise<{ mode: "deleted" | "reset" }> {
  const cmsSlug = transferCmsSlug(routeSlug)
  if (isBuiltInTransferSlug(routeSlug)) {
    await prisma.pageContent.deleteMany({ where: { slug: cmsSlug } })
    return { mode: "reset" }
  }
  await prisma.pageContent.deleteMany({ where: { slug: cmsSlug } })
  return { mode: "deleted" }
}
