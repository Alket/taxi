import type { MetadataRoute } from "next"

import { DESTINATIONS_PAGE_SIZE } from "@/components/marketing/destinations-archive"
import { prisma } from "@/lib/db"
import { DESTINATION_SLUG_ALIASES } from "@/lib/destinations"
import { getAppBaseUrl } from "@/lib/mail"
import { LOCALES, localePath, type Locale } from "@/lib/i18n/locales"
import { listAdminPages, resolveDestinationCards } from "@/lib/page-content"
import { isSearchIndexingEnabled } from "@/lib/settings"

/** Stable fallback timestamp for code-seeded routes without DB edits. */
const STATIC_FALLBACK_DATE = new Date("2026-09-01T00:00:00.000Z")

/**
 * Sitemap locs must be the URL the page itself declares as canonical.
 * Alias slugs such as /destinations/saranda 308 to /destinations/sarande,
 * so they are rewritten to that final path before they are listed.
 */
function canonicalPath(path: string): string {
  const queryIndex = path.indexOf("?")
  const pathname = queryIndex === -1 ? path : path.slice(0, queryIndex)
  const query = queryIndex === -1 ? "" : path.slice(queryIndex)
  const match = pathname.match(/^\/destinations\/([^/]+)$/)
  if (!match) return path
  const slug = decodeURIComponent(match[1]).toLowerCase()
  const target = DESTINATION_SLUG_ALIASES[slug]
  if (!target || target === slug) return path
  return `/destinations/${target}${query}`
}

// Must re-read Admin → Settings on every request (indexing can be toggled live).
export const dynamic = "force-dynamic"

/**
 * Sitemap covering every public marketing page × locale. Search engines
 * cannot discover the localized URL variants on their own since they are
 * only reachable via a client-side language switcher, so we enumerate them
 * explicitly here.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const indexingEnabled = await isSearchIndexingEnabled()

  // Keep the sitemap empty (rather than erroring) when indexing is disabled —
  // robots.txt already disallows crawling in that case.
  if (!indexingEnabled) return []

  const baseUrl = getAppBaseUrl().replace(/\/+$/, "")

  // Map every CMS slug → (locale → updatedAt) so we only list non-EN URLs
  // that declare themselves canonical (i.e. have a translation row when required)
  // and emit real modification timestamps instead of `new Date()`.
  const localesBySlug = new Map<string, Map<string, Date>>()
  let latestDestinationUpdate = STATIC_FALLBACK_DATE
  let latestBlogUpdate = STATIC_FALLBACK_DATE
  try {
    const rows = await prisma.pageContent.findMany({
      select: { slug: true, locale: true, updatedAt: true },
    })
    for (const row of rows) {
      let map = localesBySlug.get(row.slug)
      if (!map) {
        map = new Map()
        localesBySlug.set(row.slug, map)
      }
      map.set(row.locale, row.updatedAt)
      if (
        row.slug.startsWith("destinations/") &&
        row.updatedAt > latestDestinationUpdate
      ) {
        latestDestinationUpdate = row.updatedAt
      }
      if (
        (row.slug === "blog" || row.slug.startsWith("blog/")) &&
        row.updatedAt > latestBlogUpdate
      ) {
        latestBlogUpdate = row.updatedAt
      }
    }
  } catch {
    // Fall back to static dates if the lookup fails.
  }

  const byUrl = new Map<string, MetadataRoute.Sitemap[number]>()

  function addPath(
    path: string,
    options?: {
      lastModified?: Date
      changeFrequency?: MetadataRoute.Sitemap[number]["changeFrequency"]
      priority?: number
      /** When true, only the English URL is listed (untranslated pages). */
      englishOnly?: boolean
      /**
       * When set, non-English locales are emitted only if a translated row
       * exists for `cmsSlug` in `PageContent` (matching `englishOnlyAlternates`).
       */
      cmsSlug?: string
    },
  ) {
    const slugMap = options?.cmsSlug
      ? localesBySlug.get(options.cmsSlug)
      : undefined
    const locales: readonly Locale[] = options?.englishOnly
      ? (["en"] as const)
      : options?.cmsSlug
        ? LOCALES.filter((code) => code === "en" || Boolean(slugMap?.has(code)))
        : LOCALES
    const finalPath = canonicalPath(path)
    // Emit xhtml:link hreflang alternates strictly matching the locales listed
    // for this path so Googlebot discovers the reciprocal language cluster.
    const languages: Record<string, string> = {}
    if (locales.length > 1) {
      languages["x-default"] = `${baseUrl}${localePath(finalPath, "en")}`
      for (const code of locales) {
        languages[code] = `${baseUrl}${localePath(finalPath, code)}`
      }
    }
    for (const locale of locales) {
      const url = `${baseUrl}${localePath(finalPath, locale)}`
      const localeUpdatedAt =
        slugMap?.get(locale) ??
        slugMap?.get("en") ??
        options?.lastModified ??
        STATIC_FALLBACK_DATE
      const entry: MetadataRoute.Sitemap[number] = {
        url,
        lastModified: localeUpdatedAt,
        changeFrequency: options?.changeFrequency ?? "weekly",
        priority: options?.priority ?? 0.5,
        ...(locales.length > 1 ? { alternates: { languages } } : {}),
      }
      const previous = byUrl.get(url)
      // Blog posts are also CMS pages, so they are visited twice. Keep the
      // higher-priority copy and never emit the same loc twice.
      if (!previous || (entry.priority ?? 0) > (previous.priority ?? 0)) {
        byUrl.set(url, entry)
      }
    }
  }

  let pages: Awaited<ReturnType<typeof listAdminPages>> = []
  try {
    pages = await listAdminPages()
  } catch {
    pages = []
  }

  for (const page of pages) {
    // Blog posts are added below with their publication/update dates and 0.6 priority.
    if (page.isBlog || page.slug === "blog") continue
    const updatedAt = page.updatedAt
      ? new Date(page.updatedAt)
      : STATIC_FALLBACK_DATE
    const isHome = page.path === "/"
    addPath(page.path, {
      lastModified: updatedAt,
      changeFrequency: isHome ? "daily" : "monthly",
      priority: isHome ? 1 : page.isDestination ? 0.8 : 0.3,
      // Homepage & destination pages have localized SEO templates for all 7 locales;
      // legal pages (/terms, /privacy-policy, /cookies, /cancellation-policy) only
      // self-canonicalize on non-EN locales when a translation row exists.
      cmsSlug: isHome || page.isDestination ? undefined : page.slug,
    })
  }

  // Destinations archive + pagination.
  try {
    const destinations = await resolveDestinationCards("en")
    const totalPages = Math.max(
      1,
      Math.ceil(destinations.length / DESTINATIONS_PAGE_SIZE),
    )
    addPath("/destinations", {
      lastModified: latestDestinationUpdate,
      changeFrequency: "daily",
      priority: 0.7,
    })
    for (let page = 2; page <= totalPages; page += 1) {
      addPath(`/destinations?page=${page}`, {
        lastModified: latestDestinationUpdate,
        changeFrequency: "weekly",
        priority: 0.4,
      })
    }
  } catch {
    addPath("/destinations", {
      lastModified: latestDestinationUpdate,
      changeFrequency: "daily",
      priority: 0.7,
    })
  }

  // Blog archive + posts.
  try {
    const { listBlogPostsFromCms } = await import("@/lib/page-content")
    addPath("/blog", {
      lastModified: latestBlogUpdate,
      changeFrequency: "weekly",
      priority: 0.7,
    })
    for (const post of await listBlogPostsFromCms()) {
      addPath(`/blog/${post.slug}`, {
        cmsSlug: `blog/${post.slug}`,
        lastModified: new Date(post.updatedAt),
        changeFrequency: "monthly",
        priority: 0.6,
      })
    }
  } catch {
    addPath("/blog", {
      lastModified: latestBlogUpdate,
      changeFrequency: "weekly",
      priority: 0.7,
    })
  }

  // Transfer landing pages (built-in seeds + CMS-only routes).
  try {
    const { listTransferRouteSlugs } = await import("@/lib/transfers/routes")
    for (const slug of await listTransferRouteSlugs()) {
      addPath(`/transfers/${slug}`, {
        cmsSlug: `transfers/${slug}`,
        lastModified: STATIC_FALLBACK_DATE,
        changeFrequency: "weekly",
        priority: 0.9,
      })
    }
  } catch {
    // Omit transfers if route resolution fails; other sitemap entries still ship.
  }

  return [...byUrl.values()]
}
