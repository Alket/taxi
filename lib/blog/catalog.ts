import { prisma } from "@/lib/db"
import type { BlogAuthor } from "@/lib/blog/types"
import { BLOG_AUTHORS } from "@/lib/blog/authors"
import { DEFAULT_LOCALE } from "@/lib/i18n/locales"
import { parseSections } from "@/lib/page-content-shared"

export const BLOG_CATALOG_SLUG = "_blog/catalog"

export type BlogCategoryRecord = {
  id: string
  label: string
}

export type BlogCatalog = {
  categories: BlogCategoryRecord[]
  authors: BlogAuthor[]
}

export const DEFAULT_BLOG_CATEGORIES: BlogCategoryRecord[] = [
  { id: "airport-transport", label: "Airport Transport" },
  { id: "destinations-routes", label: "Destinations & Routes" },
  { id: "local-tips", label: "Local Travel Tips" },
]

export const DEFAULT_BLOG_AUTHORS: BlogAuthor[] = Object.values(BLOG_AUTHORS)

export function slugifyCatalogId(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

function parseJsonArray<T>(raw: string, fallback: T[]): T[] {
  if (!raw.trim()) return fallback
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as T[]) : fallback
  } catch {
    return fallback
  }
}

function normalizeCategories(items: BlogCategoryRecord[]): BlogCategoryRecord[] {
  const seen = new Set<string>()
  const out: BlogCategoryRecord[] = []
  for (const item of items) {
    const id = slugifyCatalogId(item.id || item.label)
    const label = item.label.trim()
    if (!id || !label || seen.has(id)) continue
    seen.add(id)
    out.push({ id, label: label.slice(0, 80) })
  }
  return out.length > 0 ? out : [...DEFAULT_BLOG_CATEGORIES]
}

function normalizeAuthors(items: BlogAuthor[]): BlogAuthor[] {
  const seen = new Set<string>()
  const out: BlogAuthor[] = []
  for (const item of items) {
    const id = slugifyCatalogId(item.id || item.name)
    const name = (item.name || "").trim()
    if (!id || !name || seen.has(id)) continue
    seen.add(id)
    out.push({
      id,
      name: name.slice(0, 120),
      role: (item.role || "").trim().slice(0, 200),
      bio: (item.bio || "").trim().slice(0, 2000),
      avatar: {
        src:
          item.avatar?.src?.trim() ||
          "/marketing/logo.svg",
        alt: item.avatar?.alt?.trim() || name,
        width: item.avatar?.width || 207,
        height: item.avatar?.height || 150,
      },
    })
  }
  return out.length > 0 ? out : [...DEFAULT_BLOG_AUTHORS]
}

export function defaultBlogCatalog(): BlogCatalog {
  return {
    categories: [...DEFAULT_BLOG_CATEGORIES],
    authors: [...DEFAULT_BLOG_AUTHORS],
  }
}

export async function getBlogCatalog(): Promise<BlogCatalog> {
  const row = await prisma.pageContent.findUnique({
    where: {
      slug_locale: { slug: BLOG_CATALOG_SLUG, locale: DEFAULT_LOCALE },
    },
  })
  if (!row) return defaultBlogCatalog()

  const sections = parseSections(row.sections)
  const categoriesRaw =
    sections.find((s) => s.key === "categories")?.body ?? ""
  const authorsRaw = sections.find((s) => s.key === "authors")?.body ?? ""

  return {
    categories: normalizeCategories(
      parseJsonArray<BlogCategoryRecord>(
        categoriesRaw,
        DEFAULT_BLOG_CATEGORIES,
      ),
    ),
    authors: normalizeAuthors(
      parseJsonArray<BlogAuthor>(authorsRaw, DEFAULT_BLOG_AUTHORS),
    ),
  }
}

export async function saveBlogCatalog(
  input: BlogCatalog,
): Promise<BlogCatalog> {
  const catalog: BlogCatalog = {
    categories: normalizeCategories(input.categories),
    authors: normalizeAuthors(input.authors),
  }

  const sections = [
    {
      id: globalThis.crypto.randomUUID(),
      type: "text" as const,
      key: "categories",
      body: JSON.stringify(catalog.categories),
    },
    {
      id: globalThis.crypto.randomUUID(),
      type: "text" as const,
      key: "authors",
      body: JSON.stringify(catalog.authors),
    },
  ]

  await prisma.pageContent.upsert({
    where: {
      slug_locale: { slug: BLOG_CATALOG_SLUG, locale: DEFAULT_LOCALE },
    },
    create: {
      slug: BLOG_CATALOG_SLUG,
      locale: DEFAULT_LOCALE,
      label: "Blog catalog",
      title: "Blog categories & authors",
      description: "Internal catalog for blog taxonomy.",
      ogImage: "",
      sections,
    },
    update: {
      label: "Blog catalog",
      title: "Blog categories & authors",
      sections,
    },
  })

  return catalog
}

export function categoryLabelFromCatalog(
  catalog: BlogCatalog,
  categoryId: string,
): string {
  return (
    catalog.categories.find((c) => c.id === categoryId)?.label ||
    DEFAULT_BLOG_CATEGORIES.find((c) => c.id === categoryId)?.label ||
    categoryId
  )
}

export function authorFromCatalog(
  catalog: BlogCatalog,
  authorId: string,
): BlogAuthor {
  return (
    catalog.authors.find((a) => a.id === authorId) ||
    catalog.authors[0] ||
    DEFAULT_BLOG_AUTHORS[0]!
  )
}

export function blogCategoryLabelsMap(
  catalog: BlogCatalog,
): Record<string, string> {
  const map: Record<string, string> = { all: "All Guides" }
  for (const cat of catalog.categories) {
    map[cat.id] = cat.label
  }
  return map
}
