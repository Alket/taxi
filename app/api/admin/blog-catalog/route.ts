import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth"
import {
  getBlogCatalog,
  saveBlogCatalog,
  slugifyCatalogId,
} from "@/lib/blog/catalog"
import { listBlogPostsFromCms } from "@/lib/page-content"
import { revalidateAllLocales } from "@/lib/revalidate-locales"
import { revalidatePath } from "next/cache"

const categorySchema = z.object({
  id: z.string().trim().max(60).optional(),
  label: z.string().trim().min(1).max(80),
})

const authorSchema = z.object({
  id: z.string().trim().max(60).optional(),
  name: z.string().trim().min(1).max(120),
  role: z.string().trim().max(200).optional().default(""),
  bio: z.string().trim().max(2000).optional().default(""),
  avatar: z
    .object({
      src: z.string().trim().max(2000).optional().default("/marketing/logo.svg"),
      alt: z.string().trim().max(200).optional().default(""),
      width: z.number().int().positive().max(4000).optional().default(207),
      height: z.number().int().positive().max(4000).optional().default(150),
    })
    .optional(),
})

const putSchema = z.object({
  categories: z.array(categorySchema).max(40),
  authors: z.array(authorSchema).min(1).max(40),
})

export async function GET() {
  const denied = await requireAdmin()
  if (denied) return denied
  const catalog = await getBlogCatalog()
  return NextResponse.json({ catalog })
}

export async function PUT(request: Request) {
  const denied = await requireAdmin()
  if (denied) return denied

  const body = await request.json().catch(() => null)
  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid catalog." },
      { status: 400 },
    )
  }

  const categories = parsed.data.categories.map((c) => ({
    id: slugifyCatalogId(c.id || c.label),
    label: c.label,
  }))
  const authors = parsed.data.authors.map((a) => ({
    id: slugifyCatalogId(a.id || a.name),
    name: a.name,
    role: a.role || "",
    bio: a.bio || "",
    avatar: {
      src: a.avatar?.src || "/marketing/logo.svg",
      alt: a.avatar?.alt || a.name,
      width: a.avatar?.width || 207,
      height: a.avatar?.height || 150,
    },
  }))

  if (categories.some((c) => !c.id)) {
    return NextResponse.json(
      { error: "Each category needs a valid id (letters and numbers)." },
      { status: 400 },
    )
  }
  if (authors.some((a) => !a.id)) {
    return NextResponse.json(
      { error: "Each author needs a valid id (letters and numbers)." },
      { status: 400 },
    )
  }

  const previous = await getBlogCatalog()
  const nextIds = new Set(categories.map((c) => c.id))
  const removedCategoryIds = previous.categories
    .map((c) => c.id)
    .filter((id) => !nextIds.has(id))

  if (removedCategoryIds.length > 0) {
    const posts = await listBlogPostsFromCms("en")
    const inUse = removedCategoryIds.filter((id) =>
      posts.some((p) => p.category === id),
    )
    if (inUse.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete categor${inUse.length > 1 ? "ies" : "y"} still used by posts: ${inUse.join(", ")}. Reassign those posts first.`,
        },
        { status: 400 },
      )
    }
  }

  const nextAuthorIds = new Set(authors.map((a) => a.id))
  const removedAuthorIds = previous.authors
    .map((a) => a.id)
    .filter((id) => !nextAuthorIds.has(id))
  if (removedAuthorIds.length > 0) {
    const posts = await listBlogPostsFromCms("en")
    const inUse = removedAuthorIds.filter((id) =>
      posts.some((p) => p.authorId === id),
    )
    if (inUse.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete author${inUse.length > 1 ? "s" : ""} still used by posts: ${inUse.join(", ")}. Reassign those posts first.`,
        },
        { status: 400 },
      )
    }
  }

  const catalog = await saveBlogCatalog({ categories, authors })
  revalidateAllLocales("/blog")
  revalidatePath("/blog/[slug]", "page")
  revalidatePath("/admin/pages")

  return NextResponse.json({ catalog })
}
