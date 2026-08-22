import { z } from "zod"

import type { BlogPost } from "@/lib/blog/types"

/** Caps aligned with admin page sectionSchema in app/api/admin/pages/[...slug]/route.ts */
const BODY_MAX = 20_000
const HEADING_MAX = 500
const SRC_MAX = 2_000
const ALT_MAX = 500
const QUESTION_MAX = 500
const ANSWER_MAX = 10_000
const LIST_ITEM_MAX = 2_000
const TABLE_HEADER_MAX = 200
const TABLE_CELL_MAX = 2_000
/** Max BlogPost JSON text size before parse (admin paste DoS guard). */
export const BLOG_JSON_TEXT_MAX = 1_500_000
/**
 * API allows max 200 sections. Blog posts need reserved meta/hero slots, so
 * body blocks + FAQ must stay under this budget or Save will reject.
 */
const META_SECTION_BUDGET = 12 // title + meta.* + hero + optional _featured
export const BLOG_JSON_MAX_BLOCKS = 150
export const BLOG_JSON_MAX_FAQ = 38 // 12 + 150 + 38 = 200

function isSafeImageSrc(src: string): boolean {
  const value = src.trim()
  if (!value) return false
  if (value.startsWith("/") && !value.startsWith("//")) return true
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

const blogImageSchema = z.object({
  src: z
    .string()
    .trim()
    .min(1)
    .max(SRC_MAX)
    .refine(isSafeImageSrc, {
      message: "heroImage.src must be https/http or a site-relative / path",
    }),
  alt: z.string().max(ALT_MAX).default(""),
  width: z.number().int().positive().max(10_000).optional().default(1600),
  height: z.number().int().positive().max(10_000).optional().default(900),
})

const blogBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("paragraph"),
    text: z.string().max(BODY_MAX),
  }),
  z.object({
    type: z.literal("h2"),
    text: z.string().max(HEADING_MAX),
  }),
  z.object({
    type: z.literal("h3"),
    text: z.string().max(HEADING_MAX),
  }),
  z.object({
    type: z.literal("ul"),
    items: z.array(z.string().max(LIST_ITEM_MAX)).max(100),
  }),
  z.object({
    type: z.literal("ol"),
    items: z.array(z.string().max(LIST_ITEM_MAX)).max(100),
  }),
  z.object({
    type: z.literal("callout"),
    title: z.string().max(HEADING_MAX).optional(),
    text: z.string().max(BODY_MAX),
  }),
  z.object({
    type: z.literal("table"),
    caption: z.string().max(HEADING_MAX).optional(),
    headers: z.array(z.string().max(TABLE_HEADER_MAX)).max(20),
    rows: z
      .array(z.array(z.string().max(TABLE_CELL_MAX)).max(20))
      .max(50),
  }),
  z.object({
    type: z.literal("mid_cta"),
  }),
])

const blogFaqSchema = z.object({
  question: z.string().trim().min(1).max(QUESTION_MAX),
  answer: z.string().trim().min(1).max(ANSWER_MAX),
})

export const blogPostJsonSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
        message: "slug must be lowercase letters, numbers, and hyphens",
      }),
    title: z.string().trim().min(1).max(HEADING_MAX),
    seoTitle: z.string().trim().min(1).max(200),
    seoDescription: z.string().trim().min(1).max(500),
    excerpt: z.string().max(BODY_MAX).default(""),
    category: z.string().trim().min(1).max(80),
    publishedAt: z.string().trim().min(1).max(40),
    updatedAt: z.string().trim().min(1).max(40),
    readTimeMinutes: z.number().int().min(1).max(120),
    authorId: z.string().trim().min(1).max(80),
    featured: z.boolean().optional(),
    heroImage: blogImageSchema,
    quickTakeaway: z.string().max(BODY_MAX).default(""),
    relatedDestinationIds: z
      .array(z.string().trim().max(60))
      .max(40)
      .default([]),
    blocks: z.array(blogBlockSchema).max(BLOG_JSON_MAX_BLOCKS),
    faq: z.array(blogFaqSchema).max(BLOG_JSON_MAX_FAQ),
  })
  .superRefine((post, ctx) => {
    // Keep under API sections.max(200): meta budget + blocks + faq.
    const sectionCount =
      META_SECTION_BUDGET + post.blocks.length + post.faq.length
    if (sectionCount > 200) {
      ctx.addIssue({
        code: "custom",
        message: `Too much content for Save (≈${sectionCount} sections; max 200). Reduce blocks or FAQ.`,
        path: ["blocks"],
      })
    }
  })

export type BlogPostJson = z.infer<typeof blogPostJsonSchema>

export function parseBlogPostJson(raw: unknown): BlogPost {
  return blogPostJsonSchema.parse(raw) as BlogPost
}

export function safeParseBlogPostJson(raw: unknown) {
  return blogPostJsonSchema.safeParse(raw)
}

/** Parse a JSON string into a BlogPost; throws with a readable message. */
export function parseBlogPostJsonText(text: string): BlogPost {
  if (text.length > BLOG_JSON_TEXT_MAX) {
    throw new Error(
      `JSON is too large (max ${Math.round(BLOG_JSON_TEXT_MAX / 1000)}KB).`,
    )
  }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error("Invalid JSON — check for missing commas or quotes.")
  }
  const result = safeParseBlogPostJson(raw)
  if (!result.success) {
    const first = result.error.issues[0]
    const path = first?.path?.length ? first.path.join(".") : "root"
    throw new Error(
      first
        ? `${path}: ${first.message}`
        : "Blog JSON failed validation.",
    )
  }
  return result.data as BlogPost
}
