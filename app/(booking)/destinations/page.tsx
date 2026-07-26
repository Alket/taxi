import type { Metadata } from "next"
import { redirect } from "next/navigation"

import {
  DESTINATIONS_PAGE_SIZE,
  DestinationsArchive,
} from "@/components/marketing/destinations-archive"
import { resolveDestinationCards } from "@/lib/page-content"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Destinations",
  description:
    "Browse airport transfer destinations across Albania — cities, coasts, and mountain escapes with fixed prices.",
}

type PageProps = {
  searchParams: Promise<{ page?: string }>
}

export default async function DestinationsArchivePage({
  searchParams,
}: PageProps) {
  const { page: pageParam } = await searchParams
  const destinations = await resolveDestinationCards()
  const totalCount = destinations.length
  const totalPages = Math.max(1, Math.ceil(totalCount / DESTINATIONS_PAGE_SIZE))

  const parsed = Number.parseInt(pageParam ?? "1", 10)
  const requested = Number.isFinite(parsed) && parsed > 0 ? parsed : 1

  if (requested > totalPages) {
    redirect(totalPages <= 1 ? "/destinations" : `/destinations?page=${totalPages}`)
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
    />
  )
}
