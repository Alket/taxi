export type BlogCategoryId =
  | "airport-transport"
  | "destinations-routes"
  | "local-tips"

export type BlogFilterId = "all" | BlogCategoryId

export type BlogImage = {
  src: string
  alt: string
  width: number
  height: number
}

export type BlogAuthor = {
  id: string
  name: string
  role: string
  bio: string
  avatar: BlogImage
}

export type BlogFaqItem = {
  question: string
  answer: string
}

export type BlogBlock =
  | { type: "paragraph"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "callout"; title?: string; text: string }
  | {
      type: "table"
      caption?: string
      headers: string[]
      rows: string[][]
    }
  | { type: "mid_cta" }

export type BlogPost = {
  slug: string
  title: string
  seoTitle: string
  seoDescription: string
  excerpt: string
  category: BlogCategoryId
  publishedAt: string
  updatedAt: string
  readTimeMinutes: number
  authorId: string
  heroImage: BlogImage
  quickTakeaway: string
  blocks: BlogBlock[]
  faq: BlogFaqItem[]
  relatedDestinationIds: string[]
  featured?: boolean
}

export const BLOG_CATEGORY_LABELS: Record<BlogFilterId, string> = {
  all: "All Guides",
  "airport-transport": "Airport Transport",
  "destinations-routes": "Destinations & Routes",
  "local-tips": "Local Travel Tips",
}

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

export function getPostH2Headings(post: BlogPost): { id: string; text: string }[] {
  const seen = new Map<string, number>()
  const headings: { id: string; text: string }[] = []

  for (const block of post.blocks) {
    if (block.type !== "h2") continue
    const base = slugifyHeading(block.text) || "section"
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    const id = count === 0 ? base : `${base}-${count + 1}`
    headings.push({ id, text: block.text })
  }

  return headings
}
