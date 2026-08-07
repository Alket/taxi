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

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const locale = await getRequestLocale()
  const { page: pageParam } = await searchParams
  const path = pageParam ? `/destinations?page=${pageParam}` : "/destinations"

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

  if (requested > totalPages) {
    redirect(
      localePath(
        totalPages <= 1 ? "/destinations" : `/destinations?page=${totalPages}`,
        locale,
      ),
    )
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
