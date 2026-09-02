import { z } from "zod"

import type { TransferRouteSeed } from "@/lib/transfers/routes"

/** Max TransferRouteSeed JSON text size before parse (admin paste DoS guard). */
export const TRANSFER_JSON_TEXT_MAX = 500_000

const comparisonSchema = z.object({
  mode: z.string().max(200),
  typicalTime: z.string().max(120),
  changes: z.string().max(200),
  priceClarity: z.string().max(200),
  highlight: z.boolean().optional(),
})

const faqSchema = z.object({
  question: z.string().max(500),
  answer: z.string().max(8000),
})

const insightSchema = z.object({
  title: z.string().max(500),
  body: z.string().max(8000),
})

/** Same shape as admin PUT seedSchema / TransferRouteSeed. */
export const transferSeedJsonSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
      message: "slug must be lowercase letters, numbers, and hyphens",
    }),
  origin: z.string().trim().max(200),
  destinationName: z.string().trim().min(1).max(120),
  nameVariants: z.array(z.string().max(80)).max(12).default([]),
  destinationId: z.string().trim().max(60).default(""),
  zoneName: z.string().trim().max(120).default(""),
  distanceKm: z.number().min(0).max(2000),
  duration: z.object({
    minMinutes: z.number().min(0).max(24 * 60),
    maxMinutes: z.number().min(0).max(24 * 60),
    label: z.string().max(80),
  }),
  catalogPriceEur: z.number().min(0).max(10000),
  heroImageUrl: z.string().max(2000).default(""),
  travelDescription: z.string().max(8000),
  comparisonTable: z.array(comparisonSchema).max(12).default([]),
  routeFaqs: z.array(faqSchema).max(40).default([]),
  insights: z.array(insightSchema).max(20).default([]),
  relatedSlugs: z.array(z.string().max(80)).max(12).default([]),
})

export type TransferSeedJson = z.infer<typeof transferSeedJsonSchema>

/**
 * Accept either a bare TransferRouteSeed or `{ format: "transfer_v1", seed: {...} }`.
 */
export function unwrapTransferJson(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw
  const obj = raw as Record<string, unknown>
  if (
    obj.format === "transfer_v1" &&
    obj.seed != null &&
    typeof obj.seed === "object"
  ) {
    return obj.seed
  }
  return raw
}

export function safeParseTransferSeedJson(raw: unknown) {
  return transferSeedJsonSchema.safeParse(unwrapTransferJson(raw))
}

export function parseTransferSeedJson(raw: unknown): TransferRouteSeed {
  return transferSeedJsonSchema.parse(unwrapTransferJson(raw)) as TransferRouteSeed
}

/** Parse a JSON string into a TransferRouteSeed; throws with a readable message. */
export function parseTransferSeedJsonText(text: string): TransferRouteSeed {
  if (text.length > TRANSFER_JSON_TEXT_MAX) {
    throw new Error(
      `JSON is too large (max ${Math.round(TRANSFER_JSON_TEXT_MAX / 1000)}KB).`,
    )
  }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error("Invalid JSON — check for missing commas or quotes.")
  }
  const result = safeParseTransferSeedJson(raw)
  if (!result.success) {
    const first = result.error.issues[0]
    const path = first?.path?.length ? first.path.join(".") : "root"
    throw new Error(
      first ? `${path}: ${first.message}` : "Transfer JSON failed validation.",
    )
  }
  return result.data as TransferRouteSeed
}
