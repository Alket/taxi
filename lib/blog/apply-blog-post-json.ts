import { blogPostToSections } from "@/lib/blog/cms"
import type { BlogPost } from "@/lib/blog/types"
import {
  blogIdFromSlug,
  type PageContentRecord,
} from "@/lib/page-content-shared"

export type ApplyBlogPostJsonResult = {
  page: PageContentRecord
  /** True when JSON slug differed from the editor page slug (URL slug kept). */
  slugMismatch: boolean
  jsonSlug: string
  pageSlug: string
}

/**
 * Merge validated BlogPost JSON into an admin PageContentRecord.
 * URL / CMS slug is never changed from the JSON slug.
 */
export function applyBlogPostJsonToPage(
  page: PageContentRecord,
  post: BlogPost,
): ApplyBlogPostJsonResult {
  const pageSlug = blogIdFromSlug(page.slug) || page.slug.replace(/^blog\//, "")
  const jsonSlug = post.slug.trim()
  const slugMismatch = Boolean(pageSlug) && jsonSlug !== pageSlug

  const locked: BlogPost = {
    ...post,
    slug: pageSlug || jsonSlug,
  }

  const sections = blogPostToSections(locked)

  return {
    page: {
      ...page,
      label: `Blog · ${locked.title}`,
      title: (locked.seoTitle || locked.title).slice(0, 70),
      description: (locked.seoDescription || locked.excerpt || "").slice(0, 160),
      ogImage: locked.heroImage.src,
      sections,
    },
    slugMismatch,
    jsonSlug,
    pageSlug: pageSlug || jsonSlug,
  }
}
