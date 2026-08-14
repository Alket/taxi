import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth"
import {
  createBlogPage,
  createDestinationPage,
  listAdminPages,
} from "@/lib/page-content"
import { revalidateAllLocales } from "@/lib/revalidate-locales"

const destinationSchema = z.object({
  type: z.literal("destination").optional(),
  name: z.string().trim().min(1).max(120),
  id: z.string().trim().max(60).optional(),
  region: z.string().trim().max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  badge: z.string().trim().max(60).optional(),
  priceFrom: z.string().trim().max(40).optional(),
  image: z.string().trim().max(2000).optional(),
  travelTime: z.string().trim().max(60).optional(),
  primaryKeyword: z.string().trim().max(120).optional(),
})

const blogSchema = z.object({
  type: z.literal("blog"),
  title: z.string().trim().min(1).max(200),
  slug: z.string().trim().max(80).optional(),
})

export async function GET() {
  const denied = await requireAdmin()
  if (denied) return denied

  const pages = await listAdminPages()
  return NextResponse.json({ pages })
}

/** Create a destination or blog marketing page. */
export async function POST(request: Request) {
  const denied = await requireAdmin()
  if (denied) return denied

  const body = await request.json().catch(() => ({}))

  if (
    body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    (body as { type?: string }).type === "blog"
  ) {
    const parsed = blogSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Provide a blog post title." },
        { status: 400 },
      )
    }
    try {
      const page = await createBlogPage(parsed.data)
      revalidateAllLocales("/blog")
      revalidatePath("/blog/[slug]", "page")
      revalidatePath("/admin/pages")
      return NextResponse.json({ page }, { status: 201 })
    } catch (error) {
      return NextResponse.json(
        { error: (error as Error).message || "Could not create blog post." },
        { status: 400 },
      )
    }
  }

  const parsed = destinationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Provide at least a destination name." },
      { status: 400 },
    )
  }

  try {
    const { type: _type, ...data } = parsed.data
    const page = await createDestinationPage(data)
    revalidateAllLocales("/")
    revalidateAllLocales("/destinations")
    revalidatePath("/destinations/[slug]", "page")
    revalidatePath("/admin/pages")
    return NextResponse.json({ page }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Could not create destination." },
      { status: 400 },
    )
  }
}
