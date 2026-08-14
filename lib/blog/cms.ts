import type { BlogBlock, BlogCategoryId, BlogPost } from "@/lib/blog/types"
import { isBlogCategoryId } from "@/lib/blog/posts"
import type { PageContentRecord, PageSection } from "@/lib/page-content-shared"
import {
  blogIdFromSlug,
  isBlogSlug,
  sectionHeading,
  sectionValue,
} from "@/lib/page-content-shared"

function newId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID()
  }
  return `sec_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function sec(
  type: PageSection["type"],
  key: string,
  fields: Partial<PageSection> = {},
): PageSection {
  return { id: newId(), type, key, ...fields }
}

export function blogPostToSections(post: BlogPost): PageSection[] {
  const sections: PageSection[] = [
    sec("heading", "title.heading", { heading: post.title, level: 1 }),
    sec("text", "meta.category", { body: post.category }),
    sec("text", "meta.excerpt", { body: post.excerpt }),
    sec("text", "meta.quickTakeaway", { body: post.quickTakeaway }),
    sec("text", "meta.publishedAt", { body: post.publishedAt }),
    sec("text", "meta.updatedAt", { body: post.updatedAt }),
    sec("text", "meta.readTime", { body: String(post.readTimeMinutes) }),
    sec("text", "meta.authorId", { body: post.authorId }),
    sec("text", "meta.relatedDestinations", {
      body: post.relatedDestinationIds.join(", "),
    }),
    sec("image", "hero.image", {
      src: post.heroImage.src,
      alt: post.heroImage.alt,
    }),
  ]

  if (post.featured) {
    sections.push(sec("text", "_featured", { body: "featured" }))
  }

  let bodyIndex = 0
  for (const block of post.blocks) {
    bodyIndex += 1
    const key = `body.${bodyIndex}`
    switch (block.type) {
      case "paragraph":
        sections.push(sec("text", key, { body: block.text }))
        break
      case "h2":
        sections.push(sec("heading", key, { heading: block.text, level: 2 }))
        break
      case "h3":
        sections.push(sec("heading", key, { heading: block.text, level: 3 }))
        break
      case "ul":
        sections.push(
          sec("list", key, { items: block.items, listStyle: "ul" }),
        )
        break
      case "ol":
        sections.push(
          sec("list", key, { items: block.items, listStyle: "ol" }),
        )
        break
      case "callout":
        sections.push(
          sec("callout", key, {
            heading: block.title,
            body: block.text,
          }),
        )
        break
      case "table":
        sections.push(
          sec("table", key, {
            heading: block.caption,
            headers: block.headers,
            rows: block.rows,
          }),
        )
        break
      case "mid_cta":
        sections.push(sec("mid_cta", key, {}))
        break
    }
  }

  post.faq.forEach((item, i) => {
    sections.push(
      sec("faq_item", `faq.${i + 1}`, {
        question: item.question,
        answer: item.answer,
      }),
    )
  })

  return sections
}

function bodySectionsInOrder(sections: PageSection[]): PageSection[] {
  return sections
    .filter((s) => s.key.startsWith("body."))
    .sort((a, b) => {
      const na = Number(a.key.slice(5)) || 0
      const nb = Number(b.key.slice(5)) || 0
      return na - nb
    })
}

function sectionToBlock(section: PageSection): BlogBlock | null {
  switch (section.type) {
    case "text":
      return { type: "paragraph", text: section.body ?? "" }
    case "heading": {
      const level = section.level === 3 ? 3 : 2
      return {
        type: level === 3 ? "h3" : "h2",
        text: section.heading ?? "",
      }
    }
    case "list":
      return {
        type: section.listStyle === "ol" ? "ol" : "ul",
        items: section.items?.length
          ? section.items
          : (section.body ?? "")
              .split("\n")
              .map((l) => l.trim())
              .filter(Boolean),
      }
    case "callout":
      return {
        type: "callout",
        title: section.heading,
        text: section.body ?? "",
      }
    case "table":
      return {
        type: "table",
        caption: section.heading,
        headers: section.headers ?? [],
        rows: section.rows ?? [],
      }
    case "mid_cta":
      return { type: "mid_cta" }
    case "image":
      // Inline images in body aren't in BlogBlock v1 — skip.
      return null
    default:
      return null
  }
}

export function pageContentToBlogPost(page: PageContentRecord): BlogPost | null {
  if (!isBlogSlug(page.slug)) return null
  const id = blogIdFromSlug(page.slug)
  if (!id) return null

  const sections = page.sections
  if (
    sectionValue(sections, "_status").trim().toLowerCase() === "hidden"
  ) {
    return null
  }

  const categoryRaw = sectionValue(sections, "meta.category").trim()
  const category: BlogCategoryId = isBlogCategoryId(categoryRaw)
    ? categoryRaw
    : "airport-transport"

  const hero = sections.find((s) => s.key === "hero.image" && s.type === "image")
  const title =
    sectionHeading(sections, "title.heading") ||
    page.label.replace(/^Blog\s*·\s*/i, "").trim() ||
    id

  const relatedRaw = sectionValue(sections, "meta.relatedDestinations")
  const relatedDestinationIds = relatedRaw
    .split(/[,]+/)
    .map((s) => s.trim())
    .filter(Boolean)

  const blocks = bodySectionsInOrder(sections)
    .map(sectionToBlock)
    .filter((b): b is BlogBlock => Boolean(b))

  const faq = sections
    .filter((s) => s.type === "faq_item")
    .map((s) => ({
      question: s.question ?? "",
      answer: s.answer ?? "",
    }))
    .filter((f) => f.question || f.answer)

  const readTime = Number(sectionValue(sections, "meta.readTime")) || 5
  const publishedAt =
    sectionValue(sections, "meta.publishedAt").trim() ||
    (page.updatedAt ? page.updatedAt.slice(0, 10) : "2026-01-01")
  const updatedAt =
    sectionValue(sections, "meta.updatedAt").trim() || publishedAt

  return {
    slug: id,
    title,
    seoTitle: page.title || title,
    seoDescription: page.description || sectionValue(sections, "meta.excerpt"),
    excerpt: sectionValue(sections, "meta.excerpt") || page.description || "",
    category,
    publishedAt,
    updatedAt,
    readTimeMinutes: readTime,
    authorId: sectionValue(sections, "meta.authorId").trim() || "landed-team",
    heroImage: {
      src:
        hero?.src ||
        page.ogImage ||
        "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&q=80&w=1600",
      alt: hero?.alt || title,
      width: 1600,
      height: 900,
    },
    quickTakeaway: sectionValue(sections, "meta.quickTakeaway"),
    blocks,
    faq,
    relatedDestinationIds,
    featured:
      sectionValue(sections, "_featured").trim().toLowerCase() === "featured",
  }
}

export function emptyBlogSections(title: string): PageSection[] {
  const today = new Date().toISOString().slice(0, 10)
  return [
    sec("heading", "title.heading", { heading: title, level: 1 }),
    sec("text", "meta.category", { body: "airport-transport" }),
    sec("text", "meta.excerpt", { body: "" }),
    sec("text", "meta.quickTakeaway", { body: "" }),
    sec("text", "meta.publishedAt", { body: today }),
    sec("text", "meta.updatedAt", { body: today }),
    sec("text", "meta.readTime", { body: "5" }),
    sec("text", "meta.authorId", { body: "landed-team" }),
    sec("text", "meta.relatedDestinations", { body: "tirana" }),
    sec("image", "hero.image", {
      src: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&q=80&w=1600",
      alt: title,
    }),
    sec("text", "body.1", {
      body: "Write your introduction here.",
    }),
    sec("heading", "body.2", {
      heading: "Main section",
      level: 2,
    }),
    sec("text", "body.3", {
      body: "Add your guide content…",
    }),
    sec("faq_item", "faq.1", {
      question: "Sample question?",
      answer: "Sample answer.",
    }),
  ]
}

export function slugifyBlogId(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}
