/**
 * Destination CMS document v2: top-level meta + typed visual sections.
 * Stored in PageContent.sections as either this object or a legacy PageSection[].
 */

import type { Destination } from "@/lib/destinations"
import type { PageSection } from "@/lib/page-content-shared"
import {
  sectionHeading,
  sectionValue,
} from "@/lib/page-content-shared"

export const DESTINATION_DOCUMENT_FORMAT = "destination_v2" as const

export type DestinationMeta = {
  title: string
  description: string
  primaryKeyword: string
  /** Public URL segment (`/destinations/{slug}`). */
  slug: string
  canonicalUrl: string
  region: string
  badge: string
  priceFrom: string
  priceCurrency: string
  travelTime: string
  distanceKm: number | null
  updatedAt: string
}

export type DestinationAttractionItem = {
  id: string
  heading: string
  body: string
  src: string
  alt: string
}

export type DestinationFaqItem = {
  id: string
  question: string
  answer: string
}

export type DestinationHeroSection = {
  id: string
  type: "hero"
  heading: string
  body?: string
  src: string
  alt: string
}

export type DestinationRouteSection = {
  id: string
  type: "route_details"
  heading: string
  distance: string
  duration: string
  whyBook: string
}

export type DestinationAttractionsGridSection = {
  id: string
  type: "attractions_grid"
  heading: string
  items: DestinationAttractionItem[]
}

export type DestinationMoreSection = {
  id: string
  type: "more_destinations"
  heading: string
}

export type DestinationFaqSection = {
  id: string
  type: "faq_accordion"
  heading?: string
  items: DestinationFaqItem[]
}

export type DestinationSection =
  | DestinationHeroSection
  | DestinationRouteSection
  | DestinationAttractionsGridSection
  | DestinationMoreSection
  | DestinationFaqSection

export type DestinationDocumentFlags = {
  featured?: boolean
  hidden?: boolean
}

export type DestinationDocument = {
  format: typeof DESTINATION_DOCUMENT_FORMAT
  meta: DestinationMeta
  sections: DestinationSection[]
  flags?: DestinationDocumentFlags
}

export type DestinationDocumentFallbacks = {
  id?: string
  title?: string
  description?: string
  ogImage?: string
  updatedAt?: string
  label?: string
}

function newId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID()
  }
  return `dst_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback
}

function asNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/** Extract leading kilometers from strings like "17 km from…" or "≈ 145 km…". */
export function parseDistanceKm(distanceText: string): number | null {
  const match = distanceText.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*km/i)
  if (!match?.[1]) return null
  const n = Number(match[1])
  return Number.isFinite(n) ? n : null
}

export function isDestinationDocumentV2(data: unknown): data is DestinationDocument {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false
  const obj = data as Record<string, unknown>
  return (
    obj.format === DESTINATION_DOCUMENT_FORMAT &&
    obj.meta != null &&
    typeof obj.meta === "object" &&
    Array.isArray(obj.sections)
  )
}

function normalizeAttractionItem(
  item: Partial<DestinationAttractionItem> & Record<string, unknown>,
): DestinationAttractionItem {
  return {
    id: asString(item.id) || newId(),
    heading: asString(item.heading),
    body: asString(item.body),
    src: asString(item.src),
    alt: asString(item.alt),
  }
}

function normalizeFaqItem(
  item: Partial<DestinationFaqItem> & Record<string, unknown>,
): DestinationFaqItem {
  return {
    id: asString(item.id) || newId(),
    question: asString(item.question),
    answer: asString(item.answer),
  }
}

function normalizeSection(raw: unknown): DestinationSection | null {
  if (!raw || typeof raw !== "object") return null
  const s = raw as Record<string, unknown>
  const id = asString(s.id) || newId()
  const type = asString(s.type)

  switch (type) {
    case "hero":
      return {
        id,
        type: "hero",
        heading: asString(s.heading),
        body: asString(s.body) || undefined,
        src: asString(s.src),
        alt: asString(s.alt),
      }
    case "route_details":
      return {
        id,
        type: "route_details",
        heading: asString(s.heading),
        distance: asString(s.distance),
        duration: asString(s.duration),
        whyBook: asString(s.whyBook),
      }
    case "attractions_grid":
      return {
        id,
        type: "attractions_grid",
        heading: asString(s.heading) || "Top attractions",
        items: Array.isArray(s.items)
          ? s.items
              .filter((i) => i && typeof i === "object")
              .map((i) =>
                normalizeAttractionItem(
                  i as Partial<DestinationAttractionItem> &
                    Record<string, unknown>,
                ),
              )
          : [],
      }
    case "more_destinations":
      return {
        id,
        type: "more_destinations",
        heading: asString(s.heading) || "More destinations",
      }
    case "faq_accordion":
      return {
        id,
        type: "faq_accordion",
        heading: asString(s.heading) || undefined,
        items: Array.isArray(s.items)
          ? s.items
              .filter((i) => i && typeof i === "object")
              .map((i) =>
                normalizeFaqItem(
                  i as Partial<DestinationFaqItem> & Record<string, unknown>,
                ),
              )
          : [],
      }
    default:
      return null
  }
}

function normalizeMeta(
  raw: unknown,
  fallbacks: DestinationDocumentFallbacks = {},
): DestinationMeta {
  const m =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}
  const title =
    asString(m.title) ||
    asString(fallbacks.title) ||
    asString(fallbacks.label) ||
    asString(fallbacks.id) ||
    ""
  const slug =
    asString(m.slug) ||
    asString(fallbacks.id) ||
    ""
  return {
    title,
    description: asString(m.description) || asString(fallbacks.description),
    primaryKeyword: asString(m.primaryKeyword),
    slug,
    canonicalUrl: asString(m.canonicalUrl),
    region: asString(m.region),
    badge: asString(m.badge) || "New",
    priceFrom: asString(m.priceFrom) || "€—",
    priceCurrency: asString(m.priceCurrency) || "EUR",
    travelTime: asString(m.travelTime),
    distanceKm: asNumberOrNull(m.distanceKm),
    updatedAt: asString(m.updatedAt) || asString(fallbacks.updatedAt),
  }
}

export function emptyDestinationDocument(
  fallbacks: DestinationDocumentFallbacks = {},
): DestinationDocument {
  const id = asString(fallbacks.id) || "destination"
  const title = asString(fallbacks.title) || id
  return {
    format: DESTINATION_DOCUMENT_FORMAT,
    meta: normalizeMeta(
      {
        title,
        description: fallbacks.description,
        slug: id,
        priceCurrency: "EUR",
      },
      fallbacks,
    ),
    sections: [
      {
        id: newId(),
        type: "hero",
        heading: title,
        body: asString(fallbacks.description),
        src: asString(fallbacks.ogImage),
        alt: title,
      },
      {
        id: newId(),
        type: "route_details",
        heading: `Getting to ${title}`,
        distance: "",
        duration: "",
        whyBook: "",
      },
      {
        id: newId(),
        type: "attractions_grid",
        heading: "Top attractions",
        items: [],
      },
      {
        id: newId(),
        type: "more_destinations",
        heading: "More destinations",
      },
    ],
    flags: {},
  }
}

/**
 * Convert legacy flat PageSection[] (title, urlSlug, hero, attraction.N, …)
 * into a DestinationDocument.
 */
export function legacyDestinationSectionsToDocument(
  legacySections: PageSection[],
  pageRow: DestinationDocumentFallbacks & {
    featured?: boolean
    hidden?: boolean
  } = {},
): DestinationDocument {
  const id = asString(pageRow.id)
  const title =
    sectionHeading(legacySections, "title") ||
    asString(pageRow.title) ||
    id
  const description =
    sectionValue(legacySections, "description") ||
    asString(pageRow.description)
  const slugRaw = sectionValue(legacySections, "urlSlug").trim() || id
  const distance = sectionValue(legacySections, "route.distance")
  const heroSrc =
    sectionValue(legacySections, "hero", "src") || asString(pageRow.ogImage)
  const heroAlt = sectionValue(legacySections, "hero", "alt") || title

  const attractions = legacySections
    .filter((s) => s.type === "attraction")
    .map((s) =>
      normalizeAttractionItem({
        id: s.id,
        heading: s.heading,
        body: s.body,
        src: s.src,
        alt: s.alt,
      }),
    )
    .filter((a) => a.heading || a.body || a.src)

  const faqs = legacySections
    .filter((s) => s.type === "faq_item")
    .map((s) =>
      normalizeFaqItem({
        id: s.id,
        question: s.question,
        answer: s.answer,
      }),
    )
    .filter((f) => f.question || f.answer)

  const featured =
    pageRow.featured ??
    sectionValue(legacySections, "_featured").trim().toLowerCase() ===
      "featured"
  const hidden =
    pageRow.hidden ??
    sectionValue(legacySections, "_status").trim().toLowerCase() === "hidden"

  const sections: DestinationSection[] = [
    {
      id: newId(),
      type: "hero",
      heading: title,
      body: description || undefined,
      src: heroSrc,
      alt: heroAlt,
    },
    {
      id: newId(),
      type: "route_details",
      heading:
        sectionHeading(legacySections, "route.heading") ||
        `Getting to ${title}`,
      distance,
      duration: sectionValue(legacySections, "route.duration"),
      whyBook: sectionValue(legacySections, "route.whyBook"),
    },
    {
      id: newId(),
      type: "attractions_grid",
      heading:
        sectionHeading(legacySections, "attractions.heading") ||
        "Top attractions",
      items: attractions,
    },
    {
      id: newId(),
      type: "more_destinations",
      heading:
        sectionHeading(legacySections, "more.heading") || "More destinations",
    },
  ]

  if (faqs.length > 0) {
    sections.push({
      id: newId(),
      type: "faq_accordion",
      heading: "FAQ",
      items: faqs,
    })
  }

  return {
    format: DESTINATION_DOCUMENT_FORMAT,
    meta: {
      title,
      description,
      primaryKeyword: sectionValue(legacySections, "primaryKeyword"),
      slug: slugRaw,
      canonicalUrl: "",
      region: sectionValue(legacySections, "region"),
      badge: sectionValue(legacySections, "badge") || "New",
      priceFrom: sectionValue(legacySections, "priceFrom") || "€—",
      priceCurrency: "EUR",
      travelTime: sectionValue(legacySections, "travelTime"),
      distanceKm: parseDistanceKm(distance),
      updatedAt: asString(pageRow.updatedAt),
    },
    sections,
    flags: { featured, hidden },
  }
}

export function parseDestinationDocument(
  raw: unknown,
  fallbacks: DestinationDocumentFallbacks = {},
): DestinationDocument {
  if (isDestinationDocumentV2(raw)) {
    const flags =
      raw.flags && typeof raw.flags === "object"
        ? {
            featured: Boolean(
              (raw.flags as DestinationDocumentFlags).featured,
            ),
            hidden: Boolean((raw.flags as DestinationDocumentFlags).hidden),
          }
        : {}
    return {
      format: DESTINATION_DOCUMENT_FORMAT,
      meta: normalizeMeta(raw.meta, fallbacks),
      sections: raw.sections
        .map(normalizeSection)
        .filter((s): s is DestinationSection => Boolean(s)),
      flags,
    }
  }

  if (Array.isArray(raw)) {
    return legacyDestinationSectionsToDocument(raw as PageSection[], fallbacks)
  }

  return emptyDestinationDocument(fallbacks)
}

/** Persistable JSON for PageContent.sections (v2 object). */
export function serializeDestinationDocument(
  doc: DestinationDocument,
): DestinationDocument {
  const normalized = parseDestinationDocument(doc, {
    id: doc.meta.slug,
    title: doc.meta.title,
    description: doc.meta.description,
    updatedAt: doc.meta.updatedAt,
  })
  return {
    format: DESTINATION_DOCUMENT_FORMAT,
    meta: {
      ...normalized.meta,
      priceCurrency: normalized.meta.priceCurrency || "EUR",
    },
    sections: normalized.sections,
    flags: {
      featured: Boolean(normalized.flags?.featured),
      hidden: Boolean(normalized.flags?.hidden),
    },
  }
}

export function destinationMetaToCardFields(
  meta: DestinationMeta,
  extras?: { id?: string; image?: string; imageAlt?: string },
): Pick<
  Destination,
  | "name"
  | "slug"
  | "region"
  | "description"
  | "badge"
  | "priceFrom"
  | "travelTime"
  | "primaryKeyword"
  | "image"
  | "imageAlt"
> {
  const image =
    extras?.image ||
    ""
  return {
    name: meta.title,
    slug: meta.slug || extras?.id || "",
    region: meta.region,
    description: meta.description,
    badge: meta.badge || "New",
    priceFrom: meta.priceFrom || "€—",
    travelTime: meta.travelTime,
    primaryKeyword: meta.primaryKeyword,
    image,
    imageAlt: extras?.imageAlt || meta.title,
  }
}

export function getDestinationHero(
  doc: DestinationDocument,
): DestinationHeroSection | undefined {
  return doc.sections.find((s): s is DestinationHeroSection => s.type === "hero")
}

export function getDestinationRoute(
  doc: DestinationDocument,
): DestinationRouteSection | undefined {
  return doc.sections.find(
    (s): s is DestinationRouteSection => s.type === "route_details",
  )
}

export function getDestinationAttractionsGrid(
  doc: DestinationDocument,
): DestinationAttractionsGridSection | undefined {
  return doc.sections.find(
    (s): s is DestinationAttractionsGridSection => s.type === "attractions_grid",
  )
}

export function getDestinationMore(
  doc: DestinationDocument,
): DestinationMoreSection | undefined {
  return doc.sections.find(
    (s): s is DestinationMoreSection => s.type === "more_destinations",
  )
}

export function getDestinationFaqs(
  doc: DestinationDocument,
): DestinationFaqSection | undefined {
  return doc.sections.find(
    (s): s is DestinationFaqSection => s.type === "faq_accordion",
  )
}

export function isDestinationDocumentHidden(doc: DestinationDocument): boolean {
  return Boolean(doc.flags?.hidden)
}

export function isDestinationDocumentFeatured(
  doc: DestinationDocument,
): boolean {
  return Boolean(doc.flags?.featured)
}

/** Featured/hidden from raw DB JSON (v2 or legacy array). */
export function destinationStorageIsHidden(raw: unknown): boolean {
  if (isDestinationDocumentV2(raw)) return isDestinationDocumentHidden(raw)
  if (Array.isArray(raw)) {
    return (
      sectionValue(raw as PageSection[], "_status").trim().toLowerCase() ===
      "hidden"
    )
  }
  return false
}

export function destinationStorageIsFeatured(raw: unknown): boolean {
  if (isDestinationDocumentV2(raw)) return isDestinationDocumentFeatured(raw)
  if (Array.isArray(raw)) {
    return (
      sectionValue(raw as PageSection[], "_featured").trim().toLowerCase() ===
      "featured"
    )
  }
  return false
}

export function withDestinationFeatured(
  doc: DestinationDocument,
  featured: boolean,
): DestinationDocument {
  return {
    ...doc,
    flags: { ...doc.flags, featured },
  }
}

export function withDestinationHidden(
  doc: DestinationDocument,
  hidden: boolean,
): DestinationDocument {
  return {
    ...doc,
    flags: { ...doc.flags, hidden },
  }
}

/** Build a v2 document from built-in Destination seed + route info. */
export function destinationDocumentFromSeed(
  dest: Destination,
  route?: { distance: string; duration: string; whyBook: string },
): DestinationDocument {
  return {
    format: DESTINATION_DOCUMENT_FORMAT,
    meta: {
      title: dest.name,
      description: dest.description,
      primaryKeyword: dest.primaryKeyword || "",
      slug: dest.slug || dest.id,
      canonicalUrl: "",
      region: dest.region,
      badge: dest.badge,
      priceFrom: dest.priceFrom,
      priceCurrency: "EUR",
      travelTime: dest.travelTime || "",
      distanceKm: route ? parseDistanceKm(route.distance) : null,
      updatedAt: "",
    },
    sections: [
      {
        id: newId(),
        type: "hero",
        heading: dest.name,
        body: dest.description,
        src: dest.image,
        alt: dest.name,
      },
      {
        id: newId(),
        type: "route_details",
        heading: `Getting to ${dest.name}`,
        distance: route?.distance ?? "",
        duration: route?.duration ?? "",
        whyBook: route?.whyBook ?? "",
      },
      {
        id: newId(),
        type: "attractions_grid",
        heading: "Top attractions",
        items: [],
      },
      {
        id: newId(),
        type: "more_destinations",
        heading: "More destinations",
      },
    ],
    flags: {},
  }
}

export type DestinationTextFields = {
  heading?: string
  body?: string
  alt?: string
  question?: string
  answer?: string
}

/**
 * Flatten document text for i18n packs (stable keys; images/flags omitted).
 */
export function destinationDocumentToTextMap(
  doc: DestinationDocument,
): Record<string, DestinationTextFields> {
  const out: Record<string, DestinationTextFields> = {
    "meta.region": { body: doc.meta.region },
    "meta.badge": { body: doc.meta.badge },
    // priceFrom is EN-canonical (not localized via i18n packs).
    "meta.travelTime": { body: doc.meta.travelTime },
    "meta.primaryKeyword": { body: doc.meta.primaryKeyword },
  }

  for (const section of doc.sections) {
    switch (section.type) {
      case "hero":
        out[`section.${section.id}.hero`] = {
          heading: section.heading,
          body: section.body ?? "",
          alt: section.alt,
        }
        break
      case "route_details":
        out[`section.${section.id}.route`] = {
          heading: section.heading,
          body: [section.distance, section.duration, section.whyBook].join(
            "\n---\n",
          ),
        }
        break
      case "attractions_grid":
        out[`section.${section.id}.attractions`] = {
          heading: section.heading,
        }
        for (const item of section.items) {
          out[`attraction.${item.id}`] = {
            heading: item.heading,
            body: item.body,
            alt: item.alt,
          }
        }
        break
      case "more_destinations":
        out[`section.${section.id}.more`] = { heading: section.heading }
        break
      case "faq_accordion":
        out[`section.${section.id}.faq`] = {
          heading: section.heading ?? "",
        }
        for (const item of section.items) {
          out[`faq.${item.id}`] = {
            question: item.question,
            answer: item.answer,
          }
        }
        break
    }
  }
  return out
}

function splitRouteBody(body: string): {
  distance: string
  duration: string
  whyBook: string
} {
  const parts = body.split("\n---\n")
  return {
    distance: parts[0] ?? "",
    duration: parts[1] ?? "",
    whyBook: parts[2] ?? "",
  }
}

/** Apply translator text onto an EN structure document (keeps images/ids). */
export function applyTextMapToDestinationDocument(
  template: DestinationDocument,
  textByKey: Record<string, DestinationTextFields> | undefined,
): DestinationDocument {
  if (!textByKey) {
    return serializeDestinationDocument(template)
  }

  const meta = { ...template.meta }
  const region = textByKey["meta.region"]?.body
  const badge = textByKey["meta.badge"]?.body
  const travelTime = textByKey["meta.travelTime"]?.body
  const primaryKeyword = textByKey["meta.primaryKeyword"]?.body
  if (typeof region === "string") meta.region = region
  if (typeof badge === "string") meta.badge = badge
  // priceFrom stays on the EN template — fares are not translated.
  if (typeof travelTime === "string") meta.travelTime = travelTime
  if (typeof primaryKeyword === "string") meta.primaryKeyword = primaryKeyword

  const sections = template.sections.map((section) => {
    switch (section.type) {
      case "hero": {
        const text = textByKey[`section.${section.id}.hero`]
        if (!text) return section
        return {
          ...section,
          heading: text.heading ?? "",
          body: text.body ?? "",
          alt: text.alt ?? section.alt,
        }
      }
      case "route_details": {
        const text = textByKey[`section.${section.id}.route`]
        if (!text) return section
        const route = splitRouteBody(text.body ?? "")
        return {
          ...section,
          heading: text.heading ?? "",
          distance: route.distance,
          duration: route.duration,
          whyBook: route.whyBook,
        }
      }
      case "attractions_grid": {
        const headingText = textByKey[`section.${section.id}.attractions`]
        return {
          ...section,
          heading: headingText?.heading ?? section.heading,
          items: section.items.map((item) => {
            const text = textByKey[`attraction.${item.id}`]
            if (!text) return item
            return {
              ...item,
              heading: text.heading ?? "",
              body: text.body ?? "",
              alt: text.alt ?? item.alt,
            }
          }),
        }
      }
      case "more_destinations": {
        const text = textByKey[`section.${section.id}.more`]
        if (!text) return section
        return { ...section, heading: text.heading ?? "" }
      }
      case "faq_accordion": {
        const headingText = textByKey[`section.${section.id}.faq`]
        return {
          ...section,
          heading: headingText?.heading ?? section.heading,
          items: section.items.map((item) => {
            const text = textByKey[`faq.${item.id}`]
            if (!text) return item
            return {
              ...item,
              question: text.question ?? "",
              answer: text.answer ?? "",
            }
          }),
        }
      }
      default:
        return section
    }
  })

  return serializeDestinationDocument({
    ...template,
    meta,
    sections,
  })
}

/**
 * Merge localized destination document onto English base.
 * Structure/images from base; text from localized when present.
 */
export function mergeDestinationDocuments(
  localized: DestinationDocument,
  base: DestinationDocument,
): DestinationDocument {
  const textMap = destinationDocumentToTextMap(localized)
  // Prefer localized meta SEO when set
  const merged = applyTextMapToDestinationDocument(base, textMap)
  return {
    ...merged,
    meta: {
      ...merged.meta,
      title: localized.meta.title.trim() || base.meta.title,
      description: localized.meta.description.trim() || base.meta.description,
      // Slug / price / currency / distanceKm stay on EN (canonical).
      slug: base.meta.slug,
      priceFrom: base.meta.priceFrom,
      priceCurrency: base.meta.priceCurrency || "EUR",
      distanceKm: base.meta.distanceKm,
      canonicalUrl: base.meta.canonicalUrl,
      updatedAt: localized.meta.updatedAt || base.meta.updatedAt,
    },
    flags: base.flags,
  }
}

/** Blank translator shell: same structure as EN, empty text fields. */
export function blankDestinationDocumentForLocale(
  base: DestinationDocument,
): DestinationDocument {
  const empty = applyTextMapToDestinationDocument(
    base,
    Object.fromEntries(
      Object.entries(destinationDocumentToTextMap(base)).map(([key, fields]) => [
        key,
        Object.fromEntries(
          Object.keys(fields).map((field) => [field, ""]),
        ) as DestinationTextFields,
      ]),
    ),
  )
  return {
    ...empty,
    meta: {
      ...empty.meta,
      title: "",
      description: "",
      slug: base.meta.slug,
      priceCurrency: base.meta.priceCurrency,
      distanceKm: base.meta.distanceKm,
      canonicalUrl: base.meta.canonicalUrl,
    },
    flags: base.flags,
  }
}

export function destinationHeroImage(doc: DestinationDocument): string {
  return getDestinationHero(doc)?.src?.trim() || ""
}

export function withDestinationHeroImage(
  doc: DestinationDocument,
  src: string,
  alt?: string,
): DestinationDocument {
  return {
    ...doc,
    sections: doc.sections.map((section) =>
      section.type === "hero"
        ? {
            ...section,
            src,
            ...(alt != null ? { alt } : {}),
          }
        : section,
    ),
  }
}
