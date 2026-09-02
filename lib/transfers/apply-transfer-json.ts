import type { TransferRouteSeed } from "@/lib/transfers/routes"

export type ApplyTransferJsonResult = {
  seed: TransferRouteSeed
  /** True when JSON slug differed from the editor URL slug (URL slug kept). */
  slugMismatch: boolean
  jsonSlug: string
  pageSlug: string
}

/**
 * Merge validated TransferRouteSeed JSON into the editor seed.
 * URL / CMS route slug is never changed from the JSON slug.
 */
export function applyTransferJsonToSeed(
  currentSlug: string,
  json: TransferRouteSeed,
): ApplyTransferJsonResult {
  const pageSlug = currentSlug.trim()
  const jsonSlug = json.slug.trim()
  const slugMismatch = Boolean(pageSlug) && jsonSlug !== pageSlug

  return {
    seed: {
      ...json,
      slug: pageSlug || jsonSlug,
    },
    slugMismatch,
    jsonSlug,
    pageSlug: pageSlug || jsonSlug,
  }
}
