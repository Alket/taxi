import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/locales"
import { revalidateAllLocales } from "@/lib/revalidate-locales"
import {
  DESTINATION_DOCUMENT_FORMAT,
  destinationHeroImage,
  parseDestinationDocument,
  serializeDestinationDocument,
  withDestinationHeroImage,
} from "@/lib/destination-document"
import {
  PAGE_SECTION_TYPES,
  deleteAdminPage,
  isDestinationSlug,
  pageHeroImageKey,
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
  items: z.array(z.string().max(2000)).max(100).optional(),
  headers: z.array(z.string().max(200)).max(20).optional(),
  rows: z.array(z.array(z.string().max(2000)).max(20)).max(50).optional(),
  listStyle: z.enum(["ul", "ol"]).optional(),
})

const attractionItemSchema = z.object({
  id: z.string().min(1),
  heading: z.string().max(500),
  body: z.string().max(20000),
  src: z.string().max(2000),
  alt: z.string().max(500),
})

const faqItemSchema = z.object({
  id: z.string().min(1),
  question: z.string().max(500),
  answer: z.string().max(10000),
})

const destinationSectionSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().min(1),
    type: z.literal("hero"),
    heading: z.string().max(500),
    body: z.string().max(20000).optional(),
    src: z.string().max(2000),
    alt: z.string().max(500),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("route_details"),
    heading: z.string().max(500),
    distance: z.string().max(2000),
    duration: z.string().max(2000),
    whyBook: z.string().max(20000),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("attractions_grid"),
    heading: z.string().max(500),
    items: z.array(attractionItemSchema).max(50),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("more_destinations"),
    heading: z.string().max(500),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("faq_accordion"),
    heading: z.string().max(500).optional(),
    items: z.array(faqItemSchema).max(50),
  }),
])

const destinationDocumentSchema = z.object({
  format: z.literal(DESTINATION_DOCUMENT_FORMAT),
  meta: z.object({
    title: z.string().max(500),
    description: z.string().max(2000),
    primaryKeyword: z.string().max(500),
    slug: z.string().max(120),
    canonicalUrl: z.string().max(2000),
    region: z.string().max(200),
    badge: z.string().max(120),
    priceFrom: z.string().max(120),
    priceCurrency: z.string().max(12),
    travelTime: z.string().max(120),
    distanceKm: z.number().nullable(),
    updatedAt: z.string().max(64),
  }),
  sections: z.array(destinationSectionSchema).max(20),
  flags: z
    .object({
      featured: z.boolean().optional(),
      hidden: z.boolean().optional(),
    })
    .optional(),
})

const updateSchema = z.object({
  locale: z.string().optional(),
  label: z.string().trim().max(200).optional(),
  title: z.string().trim().max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  ogImage: z.string().trim().max(2000).optional(),
  sections: z.array(sectionSchema).max(200).optional(),
  destinationDocument: destinationDocumentSchema.optional(),
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
      revalidateAllLocales("/")
      revalidateAllLocales("/destinations")
      revalidateAllLocales("/blog")
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

  const preferUpload = (...candidates: string[]) => {
    const urls = candidates.filter(Boolean)
    return urls.find((url) => url.startsWith("/uploads/")) || urls[0] || ""
  }

  const existingOgImage = existing?.ogImage?.trim() || ""
  const englishOgImage = english?.ogImage?.trim() || ""
  const providedOgImage =
    parsed.data.ogImage !== undefined ? parsed.data.ogImage.trim() : undefined

  // Destination v2 document write path
  if (isDestinationSlug(slug) && parsed.data.destinationDocument) {
    const destId = slug.slice("destinations/".length)
    const previousDoc = parseDestinationDocument(
      existing?.sections ?? english?.sections ?? def.defaults.destinationDocument,
      {
        id: destId,
        title: existing?.title || english?.title || def.defaults.title,
        description:
          existing?.description ||
          english?.description ||
          def.defaults.description,
        ogImage: existingOgImage || englishOgImage || def.defaults.ogImage,
      },
    )

    let nextDoc = serializeDestinationDocument({
      ...parsed.data.destinationDocument,
      flags: {
        featured:
          parsed.data.destinationDocument.flags?.featured ??
          previousDoc.flags?.featured,
        hidden:
          parsed.data.destinationDocument.flags?.hidden ??
          previousDoc.flags?.hidden,
      },
    })

    const heroSrc = destinationHeroImage(nextDoc)
    const nextOgImage =
      preferUpload(
        providedOgImage ?? "",
        heroSrc,
        existingOgImage,
        englishOgImage,
      ) || def.defaults.ogImage

    if (nextOgImage && nextOgImage !== heroSrc) {
      nextDoc = withDestinationHeroImage(nextDoc, nextOgImage)
    }

    const mirroredTitle =
      parsed.data.title?.trim() ||
      nextDoc.meta.title ||
      def.defaults.title
    const mirroredDescription =
      parsed.data.description?.trim() ||
      nextDoc.meta.description ||
      def.defaults.description

    // Keep meta in sync with mirrored SEO columns
    nextDoc = serializeDestinationDocument({
      ...nextDoc,
      meta: {
        ...nextDoc.meta,
        title: nextDoc.meta.title || mirroredTitle,
        description: nextDoc.meta.description || mirroredDescription,
      },
    })

    const row = await prisma.pageContent.upsert({
      where: { slug_locale: { slug, locale } },
      create: {
        slug,
        locale,
        label: parsed.data.label?.trim() || english?.label || def.label,
        title: mirroredTitle,
        description: mirroredDescription,
        ogImage: nextOgImage,
        sections: nextDoc,
      },
      update: {
        ...(parsed.data.label != null
          ? { label: parsed.data.label.trim() || def.label }
          : {}),
        title: mirroredTitle,
        description: mirroredDescription,
        ogImage: nextOgImage,
        sections: nextDoc,
      },
    })

    revalidateAllLocales("/")
    revalidateAllLocales(def.path)
    revalidateAllLocales("/destinations")
    revalidatePath("/destinations/[slug]", "page")

    return NextResponse.json({
      page: serializePageContent(row, { hasLocaleRow: true }),
    })
  }

  const previousSections = existing
    ? parseSections(existing.sections)
    : english
      ? parseSections(english.sections)
      : def.defaults.sections

  let nextSections =
    parsed.data.sections != null
      ? slug.startsWith("destinations/") || slug.startsWith("blog/")
        ? preserveDestinationMetaKeys(
            parseSections(parsed.data.sections),
            previousSections,
          )
        : parseSections(parsed.data.sections)
      : previousSections

  // Legacy destination flat save → upgrade to v2 on write
  if (isDestinationSlug(slug) && parsed.data.sections != null) {
    const destId = slug.slice("destinations/".length)
    const previousDoc = parseDestinationDocument(
      existing?.sections ?? english?.sections ?? def.defaults.destinationDocument,
      { id: destId },
    )
    let nextDoc = parseDestinationDocument(nextSections, {
      id: destId,
      title: parsed.data.title || previousDoc.meta.title,
      description: parsed.data.description || previousDoc.meta.description,
      ogImage: providedOgImage || previousDoc.meta.title,
    })
    nextDoc = serializeDestinationDocument({
      ...nextDoc,
      flags: previousDoc.flags,
    })
    const heroSrc = destinationHeroImage(nextDoc)
    const nextOgImage =
      preferUpload(
        providedOgImage ?? "",
        heroSrc,
        existingOgImage,
        englishOgImage,
      ) || def.defaults.ogImage
    if (nextOgImage) {
      nextDoc = withDestinationHeroImage(nextDoc, nextOgImage)
    }
    const mirroredTitle =
      parsed.data.title?.trim() || nextDoc.meta.title || def.defaults.title
    const mirroredDescription =
      parsed.data.description?.trim() ||
      nextDoc.meta.description ||
      def.defaults.description

    const row = await prisma.pageContent.upsert({
      where: { slug_locale: { slug, locale } },
      create: {
        slug,
        locale,
        label: parsed.data.label?.trim() || english?.label || def.label,
        title: mirroredTitle,
        description: mirroredDescription,
        ogImage: nextOgImage,
        sections: nextDoc,
      },
      update: {
        ...(parsed.data.label != null
          ? { label: parsed.data.label.trim() || def.label }
          : {}),
        title: mirroredTitle,
        description: mirroredDescription,
        ogImage: nextOgImage,
        sections: nextDoc,
      },
    })

    revalidateAllLocales("/")
    revalidateAllLocales(def.path)
    revalidateAllLocales("/destinations")
    revalidatePath("/destinations/[slug]", "page")

    return NextResponse.json({
      page: serializePageContent(row, { hasLocaleRow: true }),
    })
  }

  const heroSrc =
    nextSections.find(
      (s) =>
        s.type === "image" &&
        (s.key === "hero" || s.key === "hero.image"),
    )?.src?.trim() || ""

  let nextOgImage: string
  const heroKey = pageHeroImageKey(slug)
  if (heroKey) {
    nextOgImage =
      preferUpload(
        providedOgImage ?? "",
        heroSrc,
        existingOgImage,
        englishOgImage,
      ) || def.defaults.ogImage

    let synced = false
    nextSections = nextSections.map((section) => {
      if (section.type === "image" && section.key === heroKey) {
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
          key: heroKey,
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
      ...(heroKey || parsed.data.ogImage != null
        ? { ogImage: nextOgImage }
        : {}),
      sections: nextSections,
    },
  })

  revalidateAllLocales("/")
  revalidateAllLocales(def.path)
  if (slug.startsWith("destinations/")) {
    revalidateAllLocales("/destinations")
    revalidatePath("/destinations/[slug]", "page")
  }
  if (slug.startsWith("blog/")) {
    revalidateAllLocales("/blog")
    revalidatePath("/blog/[slug]", "page")
  }
  if (slug === "blog") {
    revalidateAllLocales("/blog")
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
    revalidateAllLocales("/")
    revalidateAllLocales("/destinations")
    revalidateAllLocales("/blog")
    revalidatePath("/destinations/[slug]", "page")
    revalidatePath("/blog/[slug]", "page")
    revalidatePath("/admin/pages")
    if (slug === "home") revalidateAllLocales("/")
    if (slug === "blog") revalidateAllLocales("/blog")
    if (slug === "cancellation-policy")
      revalidateAllLocales("/cancellation-policy")
    if (slug === "privacy-policy") revalidateAllLocales("/privacy-policy")
    if (slug === "terms") revalidateAllLocales("/terms")
    if (slug === "cookies") revalidateAllLocales("/cookies")
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Could not delete page." },
      { status: 400 },
    )
  }
}
