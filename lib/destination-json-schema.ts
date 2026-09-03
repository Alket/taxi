import { z } from "zod"

import {
  DESTINATION_DOCUMENT_FORMAT,
  type DestinationDocument,
} from "@/lib/destination-document"

/** Caps aligned with admin destinationDocumentSchema in pages API. */
const BODY_MAX = 20_000
const HEADING_MAX = 500
const SRC_MAX = 2_000
const ALT_MAX = 500
const QUESTION_MAX = 500
const ANSWER_MAX = 10_000
const META_SHORT = 120
const META_REGION = 200
const META_DESC = 2_000
const META_SLUG = 120
const META_URL = 2_000
const META_DATE = 64
const META_CURRENCY = 12
const ID_MAX = 120
const ROUTE_FIELD_MAX = 2_000
const DISTANCE_KM_MAX = 50_000

/** Max DestinationDocument JSON text size before parse (admin paste DoS guard). */
export const DESTINATION_JSON_TEXT_MAX = 1_500_000
export const DESTINATION_JSON_MAX_SECTIONS = 20
export const DESTINATION_JSON_MAX_ATTRACTIONS = 50
export const DESTINATION_JSON_MAX_FAQ = 50

/**
 * Decode percent-encoding until stable so nested `%252f…` / deep encodings
 * cannot bypass literal `//` checks. Returns null on malformed input or if
 * decoding does not stabilize within the round limit.
 */
function fullyDecodeUriComponent(raw: string): string | null {
  let current = raw
  for (let i = 0; i < 32; i++) {
    try {
      const next = decodeURIComponent(current.replace(/\+/g, "%20"))
      if (next === current) return current
      current = next
    } catch {
      return null
    }
  }
  // Still changing after max rounds — treat as unsafe.
  return null
}

/** Site-relative `/…` path only — no `//`, schemes, backslashes, or controls. */
function isSafeSiteRelativePath(raw: string): boolean {
  const trimmed = raw.trim()
  if (!trimmed.startsWith("/")) return false
  const decoded = fullyDecodeUriComponent(trimmed)
  if (decoded == null) return false
  const path = decoded.trim()
  if (!path.startsWith("/") || path.startsWith("//")) return false
  if (path.includes("://") || path.includes("\\")) return false
  if (/[\u0000-\u001f\u007f]/.test(path)) return false
  return true
}

/** http(s) or site-relative `/…` (not `//`). Empty allowed for draft images. */
export function isSafeDestinationImageSrc(src: string): boolean {
  const value = src.trim()
  if (!value) return true
  if (value.startsWith("/")) return isSafeSiteRelativePath(value)
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

/**
 * Canonical must stay on-site: empty or a single-slash path.
 * Absolute / protocol-relative / percent-encoded `//` URLs are rejected.
 */
export function isSafeDestinationCanonicalUrl(value: string): boolean {
  const v = value.trim()
  if (!v) return true
  return isSafeSiteRelativePath(v)
}

const safeImageSrc = z
  .string()
  .max(SRC_MAX)
  .refine(isSafeDestinationImageSrc, {
    message: "must be https/http or a site-relative / path",
  })

const safeCanonicalUrl = z
  .string()
  .max(META_URL)
  .refine(isSafeDestinationCanonicalUrl, {
    message: "must be empty or a site-relative / path (no absolute URLs)",
  })

const idSchema = z.string().min(1).max(ID_MAX)

const attractionItemSchema = z.object({
  id: idSchema,
  heading: z.string().max(HEADING_MAX),
  body: z.string().max(BODY_MAX),
  src: safeImageSrc,
  alt: z.string().max(ALT_MAX),
})

const faqItemSchema = z.object({
  id: idSchema,
  question: z.string().max(QUESTION_MAX),
  answer: z.string().max(ANSWER_MAX),
})

const destinationSectionSchema = z.discriminatedUnion("type", [
  z.object({
    id: idSchema,
    type: z.literal("hero"),
    heading: z.string().max(HEADING_MAX),
    body: z.string().max(BODY_MAX).optional(),
    src: safeImageSrc,
    alt: z.string().max(ALT_MAX),
  }),
  z.object({
    id: idSchema,
    type: z.literal("route_details"),
    heading: z.string().max(HEADING_MAX),
    distance: z.string().max(ROUTE_FIELD_MAX),
    duration: z.string().max(ROUTE_FIELD_MAX),
    whyBook: z.string().max(BODY_MAX),
  }),
  z.object({
    id: idSchema,
    type: z.literal("attractions_grid"),
    heading: z.string().max(HEADING_MAX),
    items: z.array(attractionItemSchema).max(DESTINATION_JSON_MAX_ATTRACTIONS),
  }),
  z.object({
    id: idSchema,
    type: z.literal("more_destinations"),
    heading: z.string().max(HEADING_MAX),
  }),
  z.object({
    id: idSchema,
    type: z.literal("faq_accordion"),
    heading: z.string().max(HEADING_MAX).optional(),
    items: z.array(faqItemSchema).max(DESTINATION_JSON_MAX_FAQ),
  }),
])

export const destinationDocumentJsonSchema = z.object({
  format: z.literal(DESTINATION_DOCUMENT_FORMAT),
  meta: z.object({
    title: z.string().max(HEADING_MAX),
    description: z.string().max(META_DESC),
    primaryKeyword: z.string().max(HEADING_MAX),
    slug: z.string().max(META_SLUG),
    canonicalUrl: safeCanonicalUrl,
    region: z.string().max(META_REGION),
    badge: z.string().max(META_SHORT),
    priceFrom: z.string().max(META_SHORT),
    priceCurrency: z.string().max(META_CURRENCY),
    travelTime: z.string().max(META_SHORT),
    distanceKm: z
      .number()
      .finite()
      .min(0)
      .max(DISTANCE_KM_MAX)
      .nullable(),
    updatedAt: z.string().max(META_DATE),
  }),
  sections: z.array(destinationSectionSchema).max(DESTINATION_JSON_MAX_SECTIONS),
  flags: z
    .object({
      featured: z.boolean().optional(),
      hidden: z.boolean().optional(),
    })
    .optional(),
})

export type DestinationDocumentJson = z.infer<
  typeof destinationDocumentJsonSchema
>

export function parseDestinationDocumentJson(
  raw: unknown,
): DestinationDocument {
  return destinationDocumentJsonSchema.parse(raw) as DestinationDocument
}

export function safeParseDestinationDocumentJson(raw: unknown) {
  return destinationDocumentJsonSchema.safeParse(raw)
}

/** Parse a JSON string into a DestinationDocument; throws with a readable message. */
export function parseDestinationDocumentJsonText(
  text: string,
): DestinationDocument {
  if (text.length > DESTINATION_JSON_TEXT_MAX) {
    throw new Error(
      `JSON is too large (max ${Math.round(DESTINATION_JSON_TEXT_MAX / 1000)}KB).`,
    )
  }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error("Invalid JSON — check for missing commas or quotes.")
  }
  const result = safeParseDestinationDocumentJson(raw)
  if (!result.success) {
    const first = result.error.issues[0]
    const path = first?.path?.length ? first.path.join(".") : "root"
    throw new Error(
      first
        ? `${path}: ${first.message}`
        : "Destination JSON failed validation.",
    )
  }
  return result.data as DestinationDocument
}
