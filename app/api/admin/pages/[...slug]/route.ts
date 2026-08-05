import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/locales"
import {
  PAGE_SECTION_TYPES,
  deleteAdminPage,
  parseSections,
  preserveDestinationMetaKeys,
  resolvePageContentForAdmin,
  resolvePageDefinition,
  serializePageContent,
  setDestinationFeatured,
} from "@/lib/page-content"

type RouteContext = {
  params: Promise<{ slug: string[] }>
}

const sectionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(PAGE_SECTION_TYPES),
  key: z.string().max(120),
  heading: z.string().max(500).optional(),
  body: z.string().max(20000).optional(),
  src: z.string().max(2000).optional(),
  alt: z.string().max(500).optional(),
  question: z.string().max(500).optional(),
  answer: z.string().max(10000).optional(),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  icon: z.string().max(2000).optional(),
})

const updateSchema = z.object({
  locale: z.string().optional(),
  label: z.string().trim().max(200).optional(),
  title: z.string().trim().max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  ogImage: z.string().trim().max(2000).optional(),
  sections: z.array(sectionSchema).max(200).optional(),
})

const featuredToggleSchema = z.object({
  featured: z.boolean(),
})

function slugFromParams(parts: string[]) {
  return parts.map((p) => decodeURIComponent(p)).join("/")
}

function localeFromRequest(request: Request, bodyLocale?: string): Locale {
  const url = new URL(request.url)
  const fromQuery = url.searchParams.get("locale")
  if (isLocale(fromQuery)) return fromQuery
  if (isLocale(bodyLocale)) return bodyLocale
  return DEFAULT_LOCALE
}

export async function GET(request: Request, context: RouteContext) {
  const denied = await requireAdmin()
  if (denied) return denied

  const slug = slugFromParams((await context.params).slug)
  const locale = localeFromRequest(request)
  const page = await resolvePageContentForAdmin(slug, locale)
  if (!page) {
    return NextResponse.json({ error: "Unknown page." }, { status: 404 })
  }
  return NextResponse.json({ page })
}

export async function PATCH(request: Request, context: RouteContext) {
  const denied = await requireAdmin()
  if (denied) return denied

  const slug = slugFromParams((await context.params).slug)
  const def = await resolvePageDefinition(slug)
  if (!def) {
    return NextResponse.json({ error: "Unknown page." }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))

  // Homepage feature star — admin-only, destinations only (no other fields).
  const featuredOnly =
    body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    Object.keys(body as object).length === 1 &&
    "featured" in (body as object)
  if (featuredOnly) {
    const featuredParsed = featuredToggleSchema.safeParse(body)
    if (!featuredParsed.success) {
      return NextResponse.json({ error: "Invalid featured payload." }, {
        status: 400,
      })
    }
    try {
      const result = await setDestinationFeatured(
        slug,
        featuredParsed.data.featured,
      )
      revalidatePath("/")
      revalidatePath("/destinations")
      revalidatePath("/admin/pages")
      return NextResponse.json(result)
    } catch (error) {
      return NextResponse.json(
        {
          error:
            (error as Error).message || "Could not update featured status.",
        },
        { status: 400 },
      )
    }
  }

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid page payload." }, { status: 400 })
  }

  const locale = localeFromRequest(request, parsed.data.locale)
  const existing = await prisma.pageContent.findUnique({
    where: { slug_locale: { slug, locale } },
  })
  const english =
    locale === DEFAULT_LOCALE
      ? existing
      : await prisma.pageContent.findUnique({
          where: { slug_locale: { slug, locale: DEFAULT_LOCALE } },
        })

  const previousSections = existing
    ? parseSections(existing.sections)
    : english
      ? parseSections(english.sections)
      : def.defaults.sections

  let nextSections =
    parsed.data.sections != null
      ? slug.startsWith("destinations/")
        ? preserveDestinationMetaKeys(
            parseSections(parsed.data.sections),
            previousSections,
          )
        : parseSections(parsed.data.sections)
      : previousSections

  const existingOgImage = existing?.ogImage?.trim() || ""
  const englishOgImage = english?.ogImage?.trim() || ""
  const heroSrc =
    nextSections.find((s) => s.type === "image" && s.key === "hero")?.src?.trim() ||
    ""
  const providedOgImage =
    parsed.data.ogImage !== undefined ? parsed.data.ogImage.trim() : undefined

  const preferUpload = (...candidates: string[]) => {
    const urls = candidates.filter(Boolean)
    return urls.find((url) => url.startsWith("/uploads/")) || urls[0] || ""
  }

  let nextOgImage: string
  if (slug.startsWith("destinations/")) {
    nextOgImage =
      preferUpload(
        providedOgImage ?? "",
        heroSrc,
        existingOgImage,
        englishOgImage,
      ) || def.defaults.ogImage

    let synced = false
    nextSections = nextSections.map((section) => {
      if (section.type === "image" && section.key === "hero") {
        synced = true
        return { ...section, src: nextOgImage }
      }
      return section
    })
    if (!synced && nextOgImage) {
      nextSections = [
        ...nextSections,
        {
          id: crypto.randomUUID(),
          type: "image",
          key: "hero",
          src: nextOgImage,
          alt: def.label,
        },
      ]
    }
  } else {
    nextOgImage =
      providedOgImage ??
      (existingOgImage || englishOgImage || def.defaults.ogImage)
  }

  const row = await prisma.pageContent.upsert({
    where: { slug_locale: { slug, locale } },
    create: {
      slug,
      locale,
      label: parsed.data.label?.trim() || english?.label || def.label,
      title: parsed.data.title ?? def.defaults.title,
      description: parsed.data.description ?? def.defaults.description,
      ogImage: nextOgImage,
      sections: nextSections,
    },
    update: {
      ...(parsed.data.label != null
        ? { label: parsed.data.label.trim() || def.label }
        : {}),
      ...(parsed.data.title != null ? { title: parsed.data.title } : {}),
      ...(parsed.data.description != null
        ? { description: parsed.data.description }
        : {}),
      ...(slug.startsWith("destinations/") || parsed.data.ogImage != null
        ? { ogImage: nextOgImage }
        : {}),
      sections: nextSections,
    },
  })

  revalidatePath("/")
  revalidatePath(def.path)
  if (slug.startsWith("destinations/")) {
    revalidatePath("/destinations")
    revalidatePath("/destinations/[slug]", "page")
  }

  return NextResponse.json({
    page: serializePageContent(row, { hasLocaleRow: true }),
  })
}

export async function DELETE(_request: Request, context: RouteContext) {
  const denied = await requireAdmin()
  if (denied) return denied

  const slug = slugFromParams((await context.params).slug)
  try {
    const result = await deleteAdminPage(slug)
    revalidatePath("/")
    revalidatePath("/destinations")
    revalidatePath("/destinations/[slug]", "page")
    revalidatePath("/admin/pages")
    if (slug === "home") revalidatePath("/")
    if (slug === "cancellation-policy") revalidatePath("/cancellation-policy")
    if (slug === "privacy-policy") revalidatePath("/privacy-policy")
    if (slug === "terms") revalidatePath("/terms")
    if (slug === "cookies") revalidatePath("/cookies")
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Could not delete page." },
      { status: 400 },
    )
  }
}
