import {
  destinationHeroImage,
  parseDestinationDocument,
  type DestinationDocument,
} from "@/lib/destination-document"
import type { PageContentRecord } from "@/lib/page-content-shared"

export type ApplyDestinationJsonResult = {
  page: PageContentRecord
  /** True when JSON meta.slug differed from the editor page slug (URL slug kept). */
  slugMismatch: boolean
  jsonSlug: string
  pageSlug: string
}

function destinationIdFromPageSlug(slug: string): string {
  if (!slug.startsWith("destinations/")) return slug
  return slug.slice("destinations/".length)
}

/** Export the current editor destination document (v2 or legacy sections). */
export function pageContentToDestinationDocument(
  page: PageContentRecord,
): DestinationDocument | null {
  if (!page.slug.startsWith("destinations/")) return null
  if (page.destinationDocument) return page.destinationDocument
  const id = destinationIdFromPageSlug(page.slug)
  return parseDestinationDocument(page.sections, {
    id,
    title: page.title,
    description: page.description,
    ogImage: page.ogImage,
  })
}

/**
 * Merge validated DestinationDocument JSON into an admin PageContentRecord.
 * URL / CMS slug is never changed from the JSON meta.slug.
 */
export function applyDestinationJsonToPage(
  page: PageContentRecord,
  doc: DestinationDocument,
): ApplyDestinationJsonResult {
  const pageSlug = destinationIdFromPageSlug(page.slug)
  const jsonSlug = doc.meta.slug.trim()
  const slugMismatch = Boolean(pageSlug) && jsonSlug !== pageSlug

  const locked: DestinationDocument = {
    ...doc,
    meta: {
      ...doc.meta,
      slug: pageSlug || jsonSlug,
    },
  }

  const hero = destinationHeroImage(locked)
  const title = locked.meta.title.trim().slice(0, 200) || page.title
  const description =
    locked.meta.description.trim().slice(0, 2000) || page.description

  return {
    page: {
      ...page,
      label: `Destination · ${title || pageSlug || "Untitled"}`,
      title,
      description,
      ogImage: hero || page.ogImage,
      destinationDocument: locked,
    },
    slugMismatch,
    jsonSlug,
    pageSlug: pageSlug || jsonSlug,
  }
}
