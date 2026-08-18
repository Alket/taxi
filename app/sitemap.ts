import type { MetadataRoute } from "next"

import { DESTINATIONS_PAGE_SIZE } from "@/components/marketing/destinations-archive"
import { getAppBaseUrl } from "@/lib/mail"
import { LOCALES, localePath } from "@/lib/i18n/locales"
import { listAdminPages, resolveDestinationCards } from "@/lib/page-content"
import { getSettings } from "@/lib/settings"

// Must re-read Admin → Settings on every request (indexing can be toggled live).
export const dynamic = "force-dynamic"

/**
 * Sitemap covering every public marketing page × locale. Search engines
 * cannot discover the localized URL variants on their own since they are
 * only reachable via a client-side language switcher, so we enumerate them
 * explicitly here.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let indexingEnabled = false
  try {
    const settings = await getSettings()
    indexingEnabled = settings.searchIndexingEnabled === true
  } catch {
    indexingEnabled = false
  }

  // Keep the sitemap empty (rather than erroring) when indexing is disabled —
  // robots.txt already disallows crawling in that case.
  if (!indexingEnabled) return []

  const baseUrl = getAppBaseUrl().replace(/\/+$/, "")
  const now = new Date()

  const entries: MetadataRoute.Sitemap = []

  function addPath(
    path: string,
    options?: {
      lastModified?: Date
      changeFrequency?: MetadataRoute.Sitemap[number]["changeFrequency"]
      priority?: number
    },
  ) {
    for (const locale of LOCALES) {
      entries.push({
        url: `${baseUrl}${localePath(path, locale)}`,
        lastModified: options?.lastModified ?? now,
        changeFrequency: options?.changeFrequency ?? "weekly",
        priority: options?.priority ?? 0.5,
      })
    }
  }

  let pages: Awaited<ReturnType<typeof listAdminPages>> = []
  try {
    pages = await listAdminPages()
  } catch {
    pages = []
  }

  for (const page of pages) {
    const updatedAt = page.updatedAt ? new Date(page.updatedAt) : now
    const isHome = page.path === "/"
    addPath(page.path, {
      lastModified: updatedAt,
      changeFrequency: isHome ? "daily" : "monthly",
      priority: isHome ? 1 : page.isDestination ? 0.8 : 0.3,
    })
  }

  // Destinations archive + pagination.
  try {
    const destinations = await resolveDestinationCards("en")
    const totalPages = Math.max(
      1,
      Math.ceil(destinations.length / DESTINATIONS_PAGE_SIZE),
    )
    addPath("/destinations", { changeFrequency: "daily", priority: 0.7 })
    for (let page = 2; page <= totalPages; page += 1) {
      addPath(`/destinations?page=${page}`, {
        changeFrequency: "weekly",
        priority: 0.4,
      })
    }
  } catch {
    addPath("/destinations", { changeFrequency: "daily", priority: 0.7 })
  }

  // Blog archive + posts.
  try {
    const { listBlogPostsFromCms } = await import("@/lib/page-content")
    addPath("/blog", { changeFrequency: "weekly", priority: 0.7 })
    for (const post of await listBlogPostsFromCms()) {
      addPath(`/blog/${post.slug}`, {
        lastModified: new Date(post.updatedAt),
        changeFrequency: "monthly",
        priority: 0.6,
      })
    }
  } catch {
    addPath("/blog", { changeFrequency: "weekly", priority: 0.7 })
  }

  // Transfer landing pages (built-in seeds + CMS-only routes).
  try {
    const { listTransferRouteSlugs } = await import("@/lib/transfers/routes")
    for (const slug of await listTransferRouteSlugs()) {
      addPath(`/transfers/${slug}`, {
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.9,
      })
    }
  } catch {
    // Omit transfers if route resolution fails; other sitemap entries still ship.
  }

  return entries
}
