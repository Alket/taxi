import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  PAGE_SECTION_TYPES,
  getPageDefinition,
  parseSections,
  resolvePageContent,
  serializePageContent,
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
  label: z.string().trim().max(200).optional(),
  title: z.string().trim().max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  ogImage: z.string().trim().max(2000).optional(),
  sections: z.array(sectionSchema).max(200).optional(),
})

function slugFromParams(parts: string[]) {
  return parts.map((p) => decodeURIComponent(p)).join("/")
}

export async function GET(_request: Request, context: RouteContext) {
  const denied = await requireAdmin()
  if (denied) return denied

  const slug = slugFromParams((await context.params).slug)
  const page = await resolvePageContent(slug)
  if (!page) {
    return NextResponse.json({ error: "Unknown page." }, { status: 404 })
  }
  return NextResponse.json({ page })
}

export async function PATCH(request: Request, context: RouteContext) {
  const denied = await requireAdmin()
  if (denied) return denied

  const slug = slugFromParams((await context.params).slug)
  const def = getPageDefinition(slug)
  if (!def) {
    return NextResponse.json({ error: "Unknown page." }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid page payload." }, { status: 400 })
  }

  const existing = await prisma.pageContent.findUnique({ where: { slug } })
  let nextSections =
    parsed.data.sections != null
      ? parseSections(parsed.data.sections)
      : existing
        ? parseSections(existing.sections)
        : def.defaults.sections

  const existingOgImage = existing?.ogImage?.trim() || ""
  const heroSrc =
    nextSections.find((s) => s.type === "image" && s.key === "hero")?.src?.trim() ||
    ""
  const providedOgImage =
    parsed.data.ogImage !== undefined ? parsed.data.ogImage.trim() : undefined

  // Prefer /uploads/ so a text-only save cannot replace a card/hero upload with a
  // stock Unsplash value still sitting in the admin form.
  const preferUpload = (...candidates: string[]) => {
    const urls = candidates.filter(Boolean)
    return urls.find((url) => url.startsWith("/uploads/")) || urls[0] || ""
  }

  let nextOgImage: string
  if (slug.startsWith("destinations/")) {
    nextOgImage =
      preferUpload(providedOgImage ?? "", heroSrc, existingOgImage) ||
      def.defaults.ogImage

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
      providedOgImage ?? (existingOgImage || def.defaults.ogImage)
  }

  const row = await prisma.pageContent.upsert({
    where: { slug },
    create: {
      slug,
      label: parsed.data.label?.trim() || def.label,
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

  // Homepage carousel + destination detail pages read this content.
  revalidatePath("/")
  revalidatePath(def.path)
  if (slug.startsWith("destinations/")) {
    revalidatePath("/destinations/[slug]", "page")
  }

  return NextResponse.json({ page: serializePageContent(row) })
}
