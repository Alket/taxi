import { cache } from "react"
import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"

import {
  DESTINATIONS_PAGE_SIZE,
  DestinationsArchive,
} from "@/components/marketing/destinations-archive"
import { JsonLd } from "@/components/marketing/json-ld"
import { getRequestLocale } from "@/lib/i18n/get-locale"
import {
  OG_LOCALE,
  canonicalOnly,
  localePath,
  localizedAlternates,
} from "@/lib/i18n/locales"
import { t } from "@/lib/i18n/t"
import { getAppBaseUrl } from "@/lib/mail"
import { resolveDestinationCards } from "@/lib/page-content"
import { searchTitle } from "@/lib/seo/search-meta"
import { buildBreadcrumbJsonLd } from "@/lib/structured-data"

/**
 * Locale comes from middleware via cookies()/headers() (getRequestLocale).
 * Keep force-dynamic — same constraint as /destinations/[slug].
 */
export const dynamic = "force-dynamic"

const loadDestinationCards = cache((locale: string) =>
  resolveDestinationCards(locale),
)

type PageProps = {
  searchParams: Promise<{ page?: string }>
}

function destinationsArchivePath(page: number) {
  return page <= 1 ? "/destinations" : `/destinations?page=${page}`
}

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const locale = await getRequestLocale()
  const { page: pageParam } = await searchParams
  const destinations = await loadDestinationCards(locale)
  const totalPages = Math.max(
    1,
    Math.ceil(destinations.length / DESTINATIONS_PAGE_SIZE),
  )
  const parsed = Number.parseInt(pageParam ?? "1", 10)
  const requested = Number.isFinite(parsed) && parsed > 0 ? parsed : 1
  // Out-of-range / page=1 → canonical on the clean archive URL (matches redirect).
  const page =
    requested > totalPages || requested <= 1 ? 1 : requested
  const path = destinationsArchivePath(page)
  const isIndexablePage =
    pageParam == null || (requested > 1 && requested <= totalPages)

  const title = searchTitle(
    page > 1
      ? t(locale, "destinations.archivePageTitle", { page })
      : t(locale, "destinations.archiveTitle"),
  )
  const description =
    page > 1
      ? t(locale, "destinations.pageDescription", { page })
      : t(locale, "destinations.intro")
  const alternates = isIndexablePage
    ? localizedAlternates(path, locale)
    : canonicalOnly("/destinations", locale)
  const heroImage =
    destinations.find((d) => d.image.startsWith("/uploads/"))?.image ||
    destinations[0]?.image

  return {
    title,
    description,
    alternates,
    openGraph: {
      title: title.absolute,
      description,
      url: alternates.canonical,
      locale: OG_LOCALE[locale],
      type: "website",
      ...(heroImage
        ? {
            images: [
              {
                url: heroImage,
                width: 1200,
                height: 630,
                alt: title.absolute,
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: title.absolute,
      description,
      ...(heroImage ? { images: [heroImage] } : {}),
    },
  }
}

export default async function DestinationsArchivePage({
  searchParams,
}: PageProps) {
  const locale = await getRequestLocale()
  const { page: pageParam } = await searchParams
  const destinations = await loadDestinationCards(locale)
  const totalCount = destinations.length
  const totalPages = Math.max(1, Math.ceil(totalCount / DESTINATIONS_PAGE_SIZE))

  const parsed = Number.parseInt(pageParam ?? "1", 10)
  const requested = Number.isFinite(parsed) && parsed > 0 ? parsed : 1

  // Invalid or legacy high page numbers (e.g. ?page=3 after catalog shrank)
  // → clean archive, not another paginated URL. Also strip ?page=1.
  if (pageParam != null && (requested <= 1 || requested > totalPages)) {
    permanentRedirect(localePath("/destinations", locale))
  }

  const page = requested
  const start = (page - 1) * DESTINATIONS_PAGE_SIZE
  const pageItems = destinations.slice(start, start + DESTINATIONS_PAGE_SIZE)
  const heroImage =
    destinations.find((d) => d.image.startsWith("/uploads/"))?.image ||
    destinations[0]?.image

  const base = getAppBaseUrl().replace(/\/+$/, "")
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: t(locale, "nav.home") || "Home", url: localePath("/", locale) },
    {
      name: t(locale, "nav.destinations") || "Destinations",
      url: localePath("/destinations", locale),
    },
  ])
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    numberOfItems: pageItems.length,
    itemListElement: pageItems.map((dest, idx) => ({
      "@type": "ListItem",
      position: start + idx + 1,
      name: dest.name,
      url: `${base}${localePath(`/destinations/${dest.slug}`, locale)}`,
    })),
  }

  return (
    <>
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={itemListJsonLd} />
      <DestinationsArchive
        destinations={pageItems}
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        heroImage={heroImage}
        locale={locale}
      />
    </>
  )
}
