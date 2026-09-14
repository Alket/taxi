import { z } from "zod"

import { prisma } from "@/lib/db"

export const DEFAULT_TRUSTPILOT_PROFILE_URL =
  "https://www.trustpilot.com/review/landedalbania.com"

export const DEFAULT_TRUSTPILOT_DISCLAIMER =
  "Selection of 5 star reviews from verified customers."

/** Max cards returned by the public carousel API. */
export const PUBLIC_TRUSTPILOT_TESTIMONIAL_LIMIT = 24

function stripControlChars(value: string): string {
  // Keep tabs/newlines for review body readability; drop other controls.
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
}

/**
 * Allow only https Trustpilot hosts.
 * Blocks javascript:, data:, http, credentials, and non-Trustpilot domains.
 */
export function isAllowedTrustpilotUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim())
    if (u.protocol !== "https:") return false
    if (u.username || u.password) return false
    const host = u.hostname.toLowerCase()
    return host === "trustpilot.com" || host.endsWith(".trustpilot.com")
  } catch {
    return false
  }
}

/** Normalize a Trustpilot URL or return null if unsafe. */
export function normalizeTrustpilotUrl(
  raw: string | null | undefined,
): string | null {
  if (!raw?.trim()) return null
  const trimmed = stripControlChars(raw.trim())
  if (!isAllowedTrustpilotUrl(trimmed)) return null
  const u = new URL(trimmed)
  u.hash = ""
  return u.toString()
}

export const trustpilotTestimonialInputSchema = z.object({
  authorName: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .transform(stripControlChars),
  title: z
    .string()
    .trim()
    .max(120)
    .optional()
    .default("")
    .transform((v) => stripControlChars(v ?? "")),
  rating: z.coerce.number().int().min(1).max(5),
  body: z
    .string()
    .trim()
    .min(1)
    .max(2000)
    .transform(stripControlChars),
  reviewedAt: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => {
      if (!v) return null
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return `${v}T12:00:00.000Z`
      const d = new Date(v)
      if (Number.isNaN(d.getTime())) return null
      return d.toISOString()
    }),
  sourceUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => (v ? stripControlChars(v) : v))
    .refine(
      (v) => !v || isAllowedTrustpilotUrl(v),
      "Source URL must be an https Trustpilot link",
    ),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
  published: z.boolean().optional().default(true),
})

export const reviewSiteDisplaySchema = z.object({
  customerReviewsVisibleOnSite: z.boolean().optional(),
  trustpilotTestimonialsVisibleOnSite: z.boolean().optional(),
  trustpilotDisplayScore: z.coerce.number().min(0).max(5).optional(),
  trustpilotDisplayCount: z.coerce
    .number()
    .int()
    .min(0)
    .max(1_000_000)
    .optional(),
  trustpilotProfileUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v === undefined ? undefined : stripControlChars(v)))
    .refine(
      (v) => v === undefined || v === "" || isAllowedTrustpilotUrl(v),
      "Profile URL must be an https Trustpilot link",
    ),
  trustpilotDisclaimer: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => (v === undefined ? undefined : stripControlChars(v))),
})

export type TrustpilotTestimonialInput = z.infer<
  typeof trustpilotTestimonialInputSchema
>

export function serializeTrustpilotTestimonial(row: {
  id: string
  authorName: string
  title: string
  rating: number
  body: string
  reviewedAt: Date | null
  sourceUrl: string | null
  sortOrder: number
  published: boolean
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: row.id,
    authorName: row.authorName,
    title: row.title ?? "",
    rating: row.rating,
    body: row.body,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    sourceUrl: normalizeTrustpilotUrl(row.sourceUrl),
    sortOrder: row.sortOrder,
    published: row.published,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** Public payload: no internal timestamps / sort / published flags. */
export function serializePublicTrustpilotTestimonial(row: {
  id: string
  authorName: string
  title: string
  rating: number
  body: string
  reviewedAt: Date | null
  sourceUrl: string | null
}) {
  return {
    id: row.id,
    authorName: row.authorName,
    title: row.title ?? "",
    rating: row.rating,
    body: row.body,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    sourceUrl: normalizeTrustpilotUrl(row.sourceUrl),
  }
}

export async function listAdminTrustpilotTestimonials() {
  return prisma.trustpilotTestimonial.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  })
}

export async function listPublishedTrustpilotTestimonials(
  limit = PUBLIC_TRUSTPILOT_TESTIMONIAL_LIMIT,
) {
  return prisma.trustpilotTestimonial.findMany({
    where: { published: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: Math.min(Math.max(1, limit), PUBLIC_TRUSTPILOT_TESTIMONIAL_LIMIT),
  })
}

export function clientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) return first.slice(0, 64)
  }
  const realIp = request.headers.get("x-real-ip")?.trim()
  if (realIp) return realIp.slice(0, 64)
  return "unknown"
}
