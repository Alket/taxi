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

/** Max DestinationDocument JSON text size before parse (admin paste DoS guard). */
export const DESTINATION_JSON_TEXT_MAX = 1_500_000
export const DESTINATION_JSON_MAX_SECTIONS = 20
export const DESTINATION_JSON_MAX_ATTRACTIONS = 50
export const DESTINATION_JSON_MAX_FAQ = 50

const attractionItemSchema = z.object({
  id: z.string().min(1),
  heading: z.string().max(HEADING_MAX),
  body: z.string().max(BODY_MAX),
  src: z.string().max(SRC_MAX),
  alt: z.string().max(ALT_MAX),
})

const faqItemSchema = z.object({
  id: z.string().min(1),
  question: z.string().max(QUESTION_MAX),
  answer: z.string().max(ANSWER_MAX),
})

const destinationSectionSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().min(1),
    type: z.literal("hero"),
    heading: z.string().max(HEADING_MAX),
    body: z.string().max(BODY_MAX).optional(),
    src: z.string().max(SRC_MAX),
    alt: z.string().max(ALT_MAX),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("route_details"),
    heading: z.string().max(HEADING_MAX),
    distance: z.string().max(BODY_MAX),
    duration: z.string().max(BODY_MAX),
    whyBook: z.string().max(BODY_MAX),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("attractions_grid"),
    heading: z.string().max(HEADING_MAX),
    items: z.array(attractionItemSchema).max(DESTINATION_JSON_MAX_ATTRACTIONS),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("more_destinations"),
    heading: z.string().max(HEADING_MAX),
  }),
  z.object({
    id: z.string().min(1),
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
    canonicalUrl: z.string().max(META_URL),
    region: z.string().max(META_REGION),
    badge: z.string().max(META_SHORT),
    priceFrom: z.string().max(META_SHORT),
    priceCurrency: z.string().max(META_CURRENCY),
    travelTime: z.string().max(META_SHORT),
    distanceKm: z.number().nullable(),
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
