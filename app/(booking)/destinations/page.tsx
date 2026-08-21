import type { Metadata } from "next"
import { redirect } from "next/navigation"

import {
  DESTINATIONS_PAGE_SIZE,
  DestinationsArchive,
} from "@/components/marketing/destinations-archive"
import { getRequestLocale } from "@/lib/i18n/get-locale"
import { localePath, localizedAlternates } from "@/lib/i18n/locales"
import { t } from "@/lib/i18n/t"
import { resolveDestinationCards } from "@/lib/page-content"

// CMS content rarely changes; ISR + on-demand revalidation (admin save →
// revalidatePath) keeps this fast without re-querying the DB on every hit.
export const revalidate = 3600

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
  const destinations = await resolveDestinationCards(locale)
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

  return {
    title: t(locale, "destinations.archiveTitle"),
    description: t(locale, "destinations.intro"),
    alternates: localizedAlternates(path, locale),
  }
}

export default async function DestinationsArchivePage({
  searchParams,
}: PageProps) {
  const locale = await getRequestLocale()
  const { page: pageParam } = await searchParams
  const destinations = await resolveDestinationCards(locale)
  const totalCount = destinations.length
  const totalPages = Math.max(1, Math.ceil(totalCount / DESTINATIONS_PAGE_SIZE))

  const parsed = Number.parseInt(pageParam ?? "1", 10)
  const requested = Number.isFinite(parsed) && parsed > 0 ? parsed : 1

  // Invalid or legacy high page numbers (e.g. ?page=3 after catalog shrank)
  // → clean archive, not another paginated URL. Also strip ?page=1.
  if (pageParam != null && (requested <= 1 || requested > totalPages)) {
    redirect(localePath("/destinations", locale))
  }

  const page = requested
  const start = (page - 1) * DESTINATIONS_PAGE_SIZE
  const pageItems = destinations.slice(start, start + DESTINATIONS_PAGE_SIZE)
  const heroImage =
    destinations.find((d) => d.image.startsWith("/uploads/"))?.image ||
    destinations[0]?.image

  return (
    <DestinationsArchive
      destinations={pageItems}
      page={page}
      totalPages={totalPages}
      totalCount={totalCount}
      heroImage={heroImage}
      locale={locale}
    />
  )
}
