import { z } from "zod"

import { prisma } from "@/lib/db"
import { LOCALES, DEFAULT_LOCALE, type Locale, isLocale } from "@/lib/i18n/locales"
import {
  ensureMissingDefaultSections,
  listAdminPages,
  parseSections,
  preserveDestinationMetaKeys,
  resolvePageDefinition,
  type PageSection,
} from "@/lib/page-content"

export const PAGE_I18N_PACK_KIND = "landed-page-i18n-pack" as const
export const PAGE_I18N_PACK_VERSION = 1 as const

/** Align with admin page editor limits (`app/api/admin/pages/[...slug]/route.ts`). */
export const I18N_MAX_PAGES = 100
export const I18N_MAX_SECTIONS = 200
export const I18N_MAX_TITLE = 200
export const I18N_MAX_DESCRIPTION = 2000
export const I18N_MAX_HEADING = 500
export const I18N_MAX_BODY = 20_000
export const I18N_MAX_ALT = 500
export const I18N_MAX_QUESTION = 500
export const I18N_MAX_ANSWER = 10_000
export const I18N_MAX_SECTION_KEY = 120
export const I18N_MAX_LABEL = 200
/** ~2.5MB — enough for full pack, blocks pathological uploads. */
export const I18N_MAX_BODY_BYTES = 2_500_000

/** Internal destination meta keys — never sent to translators. */
const META_SECTION_KEYS = new Set(["_status", "_featured"])

export type SectionTextFields = {
  heading?: string
  body?: string
  alt?: string
  question?: string
  answer?: string
}

export type PageLocaleText = {
  title: string
  description: string
  /** Text fields keyed by stable section key. */
  sections: Record<string, SectionTextFields>
}

export type PageI18nPackPage = {
  slug: string
  label: string
  kind: "core" | "destination" | "blog"
  byLocale: Partial<Record<Locale, PageLocaleText>>
}

export type PageI18nPack = {
  version: typeof PAGE_I18N_PACK_VERSION
  kind: typeof PAGE_I18N_PACK_KIND
  exportedAt: string
  sourceLocale: typeof DEFAULT_LOCALE
  locales: Locale[]
  pages: PageI18nPackPage[]
}

export type PageI18nImportResult = {
  updated: number
  created: number
  skipped: number
  pages: number
  locales: number
  errors: string[]
}

const sectionTextSchema = z
  .object({
    heading: z.string().max(I18N_MAX_HEADING).optional(),
    body: z.string().max(I18N_MAX_BODY).optional(),
    alt: z.string().max(I18N_MAX_ALT).optional(),
    question: z.string().max(I18N_MAX_QUESTION).optional(),
    answer: z.string().max(I18N_MAX_ANSWER).optional(),
  })
  .strict()

const pageLocaleTextSchema = z
  .object({
    title: z.string().max(I18N_MAX_TITLE),
    description: z.string().max(I18N_MAX_DESCRIPTION),
    sections: z
      .record(z.string().max(I18N_MAX_SECTION_KEY), sectionTextSchema)
      .refine(
        (sections) => Object.keys(sections).length <= I18N_MAX_SECTIONS,
        `Each locale may include at most ${I18N_MAX_SECTIONS} sections.`,
      ),
  })
  .strict()

const packPageSchema = z
  .object({
    slug: z.string().trim().min(1).max(120),
    label: z.string().max(I18N_MAX_LABEL).optional(),
    kind: z.enum(["core", "destination", "blog"]).optional(),
    byLocale: z.record(z.string(), pageLocaleTextSchema),
  })
  .strict()

export const pageI18nPackSchema = z
  .object({
    version: z.literal(PAGE_I18N_PACK_VERSION),
    kind: z.literal(PAGE_I18N_PACK_KIND),
    exportedAt: z.string().max(64).optional(),
    sourceLocale: z.string().max(8).optional(),
    locales: z.array(z.string().max(8)).max(LOCALES.length + 2).optional(),
    pages: z.array(packPageSchema).max(I18N_MAX_PAGES),
  })
  .strict()

function extractSectionText(section: PageSection): SectionTextFields | null {
  if (!section.key || META_SECTION_KEYS.has(section.key)) return null
  // Structural blog meta (ids/dates) — not for translators.
  if (
    section.key.startsWith("meta.") &&
    section.key !== "meta.excerpt" &&
    section.key !== "meta.quickTakeaway"
  ) {
    return null
  }
  if (section.type === "heading") {
    return { heading: section.heading ?? "" }
  }
  if (section.type === "text") {
    return { body: section.body ?? "" }
  }
  if (section.type === "image") {
    return { alt: section.alt ?? "" }
  }
  if (section.type === "faq_item") {
    return {
      question: section.question ?? "",
      answer: section.answer ?? "",
    }
  }
  if (section.type === "attraction") {
    return {
      heading: section.heading ?? "",
      body: section.body ?? "",
      alt: section.alt ?? "",
    }
  }
  if (section.type === "callout") {
    return {
      heading: section.heading ?? "",
      body: section.body ?? "",
    }
  }
  if (section.type === "list") {
    return { body: (section.items ?? []).join("\n") }
  }
  if (section.type === "table") {
    return {
      heading: section.heading ?? "",
      body: JSON.stringify({
        headers: section.headers ?? [],
        rows: section.rows ?? [],
      }),
    }
  }
  return null
}

function sectionsToTextMap(sections: PageSection[]): Record<string, SectionTextFields> {
  const out: Record<string, SectionTextFields> = {}
  for (const section of sections) {
    const text = extractSectionText(section)
    if (!text || !section.key) continue
    out[section.key] = text
  }
  return out
}

function emptySectionFields(
  fields: SectionTextFields,
): SectionTextFields {
  return Object.fromEntries(
    Object.keys(fields).map((field) => [field, ""]),
  ) as SectionTextFields
}

/**
 * Ensure every template (EN) key is present for translators.
 * Locale rows that predate new homepage sections (uberAlt, compare, …)
 * otherwise omit those keys from export.
 */
function mergeLocaleSectionMap(
  templateMap: Record<string, SectionTextFields>,
  localeMap: Record<string, SectionTextFields>,
): Record<string, SectionTextFields> {
  const out: Record<string, SectionTextFields> = {}
  for (const [key, fields] of Object.entries(templateMap)) {
    const localeFields = localeMap[key]
    if (!localeFields) {
      out[key] = emptySectionFields(fields)
      continue
    }
    const merged: SectionTextFields = {}
    for (const field of Object.keys(fields) as (keyof SectionTextFields)[]) {
      const value = localeFields[field]
      merged[field] = typeof value === "string" ? value : ""
    }
    out[key] = merged
  }
  // Keep locale-only FAQ/attraction keys that are not in the EN template yet.
  for (const [key, fields] of Object.entries(localeMap)) {
    if (out[key]) continue
    out[key] = fields
  }
  return out
}

function applyTextToSections(
  template: PageSection[],
  textByKey: Record<string, SectionTextFields> | undefined,
): PageSection[] {
  if (!textByKey) {
    return template.map((section) => ({ ...section }))
  }

  const used = new Set<string>()
  const next = template.map((base) => {
    if (!base.key || META_SECTION_KEYS.has(base.key)) return { ...base }
    const text = textByKey[base.key]
    if (!text) return { ...base }
    used.add(base.key)

    if (base.type === "heading") {
      return { ...base, heading: text.heading ?? "" }
    }
    if (base.type === "text") {
      return { ...base, body: text.body ?? "" }
    }
    if (base.type === "image") {
      return { ...base, alt: text.alt ?? base.alt ?? "" }
    }
    if (base.type === "faq_item") {
      return {
        ...base,
        question: text.question ?? "",
        answer: text.answer ?? "",
      }
    }
    if (base.type === "attraction") {
      return {
        ...base,
        heading: text.heading ?? "",
        body: text.body ?? "",
        alt: text.alt ?? base.alt ?? "",
      }
    }
    if (base.type === "callout") {
      return {
        ...base,
        heading: text.heading ?? "",
        body: text.body ?? "",
      }
    }
    if (base.type === "list") {
      return {
        ...base,
        items: (text.body ?? "")
          .split("\n")
          .map((line) => line.trimEnd())
          .filter((line, i, arr) => line.length > 0 || i < arr.length - 1),
      }
    }
    if (base.type === "table") {
      let headers = base.headers ?? []
      let rows = base.rows ?? []
      if (text.body?.trim()) {
        try {
          const parsed = JSON.parse(text.body) as {
            headers?: string[]
            rows?: string[][]
          }
          if (Array.isArray(parsed.headers)) headers = parsed.headers
          if (Array.isArray(parsed.rows)) rows = parsed.rows
        } catch {
          // keep template structure if translators corrupt JSON
        }
      }
      return {
        ...base,
        heading: text.heading ?? "",
        headers,
        rows,
      }
    }
    return { ...base }
  })

  // Append FAQ / attraction / blog body keys present in the pack but missing
  // from the template (e.g. locale added an extra FAQ, or body block count grew).
  for (const [key, text] of Object.entries(textByKey)) {
    if (next.length >= I18N_MAX_SECTIONS) break
    if (used.has(key) || META_SECTION_KEYS.has(key)) continue
    if (text.question != null || text.answer != null) {
      next.push({
        id: globalThis.crypto.randomUUID(),
        type: "faq_item",
        key,
        question: text.question ?? "",
        answer: text.answer ?? "",
      })
      continue
    }
    if (
      text.heading != null &&
      text.body != null &&
      key.startsWith("attraction")
    ) {
      next.push({
        id: globalThis.crypto.randomUUID(),
        type: "attraction",
        key,
        heading: text.heading ?? "",
        body: text.body ?? "",
        alt: text.alt ?? "",
      })
      continue
    }
    if (key.startsWith("body.")) {
      // Infer block type from which text fields the pack provided.
      if (text.heading != null && text.body != null) {
        // Callout (title + body) or table JSON in body — prefer callout unless JSON.
        const trimmed = (text.body ?? "").trim()
        if (trimmed.startsWith("{") && trimmed.includes("headers")) {
          let headers: string[] = []
          let rows: string[][] = []
          try {
            const parsed = JSON.parse(trimmed) as {
              headers?: string[]
              rows?: string[][]
            }
            if (Array.isArray(parsed.headers)) headers = parsed.headers
            if (Array.isArray(parsed.rows)) rows = parsed.rows
          } catch {
            /* keep empty */
          }
          next.push({
            id: globalThis.crypto.randomUUID(),
            type: "table",
            key,
            heading: text.heading ?? "",
            headers,
            rows,
          })
        } else {
          next.push({
            id: globalThis.crypto.randomUUID(),
            type: "callout",
            key,
            heading: text.heading ?? "",
            body: text.body ?? "",
          })
        }
        continue
      }
      if (text.heading != null) {
        next.push({
          id: globalThis.crypto.randomUUID(),
          type: "heading",
          key,
          heading: text.heading ?? "",
          level: 2,
        })
        continue
      }
      if (text.body != null) {
        next.push({
          id: globalThis.crypto.randomUUID(),
          type: "text",
          key,
          body: text.body ?? "",
        })
        continue
      }
      if (text.alt != null) {
        next.push({
          id: globalThis.crypto.randomUUID(),
          type: "image",
          key,
          src: "",
          alt: text.alt ?? "",
        })
      }
    }
  }

  if (next.length > I18N_MAX_SECTIONS) {
    throw new Error(
      `Page exceeds the maximum of ${I18N_MAX_SECTIONS} sections after import.`,
    )
  }

  return next
}

async function resolveEnglishTemplate(slug: string): Promise<{
  label: string
  title: string
  description: string
  ogImage: string
  sections: PageSection[]
} | null> {
  // Prefer the EN DB row (admin source of truth), then built-in / custom
  // page definitions. Avoid public resolvePageContent() so soft-hidden
  // posts in a pack can still import, and core pages like `blog` always
  // resolve from defaults when no row exists yet.
  const def = await resolvePageDefinition(slug)
  const english = await prisma.pageContent.findUnique({
    where: { slug_locale: { slug, locale: DEFAULT_LOCALE } },
  })

  if (english) {
    const defaults = def?.defaults.sections ?? []
    return {
      label: english.label || def?.label || slug,
      title: english.title || def?.defaults.title || "",
      description: english.description || def?.defaults.description || "",
      ogImage: english.ogImage || def?.defaults.ogImage || "",
      sections: defaults.length
        ? ensureMissingDefaultSections(parseSections(english.sections), defaults)
        : parseSections(english.sections),
    }
  }

  if (!def) return null
  return {
    label: def.label,
    title: def.defaults.title,
    description: def.defaults.description,
    ogImage: def.defaults.ogImage,
    sections: def.defaults.sections,
  }
}

/**
 * Build a translation pack for core pages, destinations, blog archive, and blog posts.
 * Text only — image URLs / icons / meta flags stay in the DB template.
 */
export async function exportPageI18nPack(): Promise<PageI18nPack> {
  const listed = await listAdminPages()
  const pages: PageI18nPackPage[] = []

  for (const item of listed) {
    const template = await resolveEnglishTemplate(item.slug)
    if (!template) continue

    const byLocale: Partial<Record<Locale, PageLocaleText>> = {}
    const templateSections = sectionsToTextMap(template.sections)

    for (const locale of LOCALES) {
      if (locale === DEFAULT_LOCALE) {
        byLocale[locale] = {
          title: template.title,
          description: template.description,
          sections: templateSections,
        }
        continue
      }

      const row = await prisma.pageContent.findUnique({
        where: { slug_locale: { slug: item.slug, locale } },
      })
      if (row) {
        byLocale[locale] = {
          title: row.title,
          description: row.description,
          sections: mergeLocaleSectionMap(
            templateSections,
            sectionsToTextMap(parseSections(row.sections)),
          ),
        }
      } else {
        // Empty shell with the same keys so translators know what to fill.
        const emptySections: Record<string, SectionTextFields> = {}
        for (const [key, fields] of Object.entries(templateSections)) {
          emptySections[key] = emptySectionFields(fields)
        }
        byLocale[locale] = {
          title: "",
          description: "",
          sections: emptySections,
        }
      }
    }

    pages.push({
      slug: item.slug,
      label: item.label,
      kind: item.isBlog
        ? "blog"
        : item.slug === "blog"
          ? "blog"
          : item.isDestination
            ? "destination"
            : "core",
      byLocale,
    })
  }

  return {
    version: PAGE_I18N_PACK_VERSION,
    kind: PAGE_I18N_PACK_KIND,
    exportedAt: new Date().toISOString(),
    sourceLocale: DEFAULT_LOCALE,
    locales: [...LOCALES],
    pages,
  }
}

function formatZodError(error: z.ZodError): string {
  const issue = error.issues[0]
  if (!issue) return "Invalid translation pack."
  const path = issue.path.length > 0 ? issue.path.join(".") : "pack"
  return `${path}: ${issue.message}`
}

/**
 * Apply a translation pack. Structure/images come from English (or existing
 * locale row); only title/description/text fields are overwritten.
 */
export async function importPageI18nPack(
  raw: unknown,
  options?: { locales?: Locale[] },
): Promise<PageI18nImportResult> {
  const parsed = pageI18nPackSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(formatZodError(parsed.error))
  }
  const pack = parsed.data

  const allowedLocales = new Set(
    (options?.locales?.length ? options.locales : LOCALES).filter(isLocale),
  )

  let created = 0
  let updated = 0
  let skipped = 0
  const errors: string[] = []
  const touchedLocales = new Set<Locale>()

  for (const page of pack.pages) {
    const template = await resolveEnglishTemplate(page.slug)
    if (!template) {
      errors.push(`Unknown page slug: ${page.slug}`)
      skipped += 1
      continue
    }

    const byLocale = page.byLocale || {}
    for (const [localeKey, localeText] of Object.entries(byLocale)) {
      if (!isLocale(localeKey) || !allowedLocales.has(localeKey)) {
        skipped += 1
        continue
      }

      const locale = localeKey as Locale
      const existing = await prisma.pageContent.findUnique({
        where: { slug_locale: { slug: page.slug, locale } },
      })

      const structureBase = ensureMissingDefaultSections(
        existing ? parseSections(existing.sections) : template.sections,
        template.sections,
      )

      let nextSections: PageSection[]
      try {
        nextSections = applyTextToSections(
          structureBase,
          localeText.sections || {},
        )
      } catch (error) {
        errors.push(`${page.slug}/${locale}: ${(error as Error).message}`)
        skipped += 1
        continue
      }

      if (
        page.slug.startsWith("destinations/") ||
        page.slug.startsWith("blog/")
      ) {
        const previous = existing
          ? parseSections(existing.sections)
          : template.sections
        nextSections = preserveDestinationMetaKeys(nextSections, previous)
      }

      if (nextSections.length > I18N_MAX_SECTIONS) {
        errors.push(
          `${page.slug}/${locale}: exceeds ${I18N_MAX_SECTIONS} sections.`,
        )
        skipped += 1
        continue
      }

      const nextTitle = localeText.title
      const nextDescription = localeText.description

      // Skip completely empty non-EN rows (no point creating blank shells).
      const hasText =
        nextTitle.trim() ||
        nextDescription.trim() ||
        Object.values(localeText.sections || {}).some((fields) =>
          Object.values(fields).some((v) => typeof v === "string" && v.trim()),
        )
      if (!hasText && locale !== DEFAULT_LOCALE && !existing) {
        skipped += 1
        continue
      }

      const ogImage = existing?.ogImage || template.ogImage || ""
      const label = existing?.label || template.label || page.label || page.slug

      if (existing) {
        await prisma.pageContent.update({
          where: { id: existing.id },
          data: {
            title: nextTitle,
            description: nextDescription,
            sections: nextSections,
          },
        })
        updated += 1
      } else {
        await prisma.pageContent.create({
          data: {
            slug: page.slug,
            locale,
            label,
            title: nextTitle,
            description: nextDescription,
            ogImage,
            sections: nextSections,
          },
        })
        created += 1
      }
      touchedLocales.add(locale)
    }
  }

  return {
    updated,
    created,
    skipped,
    pages: pack.pages.length,
    locales: touchedLocales.size,
    errors,
  }
}
