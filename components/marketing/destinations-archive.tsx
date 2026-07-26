import Link from "next/link"
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react"

import { DestinationCard } from "@/components/marketing/destination-card"
import {
  MarketingContainer,
  MARKETING_SECTION_TITLE,
} from "@/components/marketing/marketing-container"
import { DESTINATIONS, type Destination } from "@/lib/destinations"
import { cn } from "@/lib/utils"

export const DESTINATIONS_PAGE_SIZE = 6

const ARCHIVE_HERO_FALLBACK = DESTINATIONS[0]?.image ?? ""

function pageHref(page: number) {
  return page <= 1 ? "/destinations" : `/destinations?page=${page}`
}

function Pagination({
  page,
  totalPages,
}: {
  page: number
  totalPages: number
}) {
  if (totalPages <= 1) return null

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)

  return (
    <nav
      aria-label="Destinations pages"
      className="mt-12 flex flex-col items-center gap-4 border-t border-border/70 pt-10 md:mt-16"
    >
      <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
        Page {page} of {totalPages}
      </p>
      <div className="flex items-center gap-2">
        <Link
          href={pageHref(page - 1)}
          aria-disabled={page <= 1}
          tabIndex={page <= 1 ? -1 : undefined}
          className={cn(
            "inline-flex size-10 items-center justify-center rounded-full border border-border bg-brand-surface text-brand transition-colors",
            page <= 1
              ? "pointer-events-none opacity-40"
              : "hover:bg-muted hover:text-primary",
          )}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </Link>

        <ul className="flex items-center gap-1.5">
          {pages.map((n) => {
            const active = n === page
            return (
              <li key={n}>
                <Link
                  href={pageHref(n)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex size-10 items-center justify-center rounded-full text-sm font-extrabold transition-colors",
                    active
                      ? "bg-brand-accent text-white shadow-sm"
                      : "border border-border bg-brand-surface text-brand hover:bg-muted hover:text-primary",
                  )}
                >
                  {n}
                </Link>
              </li>
            )
          })}
        </ul>

        <Link
          href={pageHref(page + 1)}
          aria-disabled={page >= totalPages}
          tabIndex={page >= totalPages ? -1 : undefined}
          className={cn(
            "inline-flex size-10 items-center justify-center rounded-full border border-border bg-brand-surface text-brand transition-colors",
            page >= totalPages
              ? "pointer-events-none opacity-40"
              : "hover:bg-muted hover:text-primary",
          )}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </nav>
  )
}

export function DestinationsArchive({
  destinations,
  page,
  totalPages,
  totalCount,
  heroImage = ARCHIVE_HERO_FALLBACK,
}: {
  destinations: Destination[]
  page: number
  totalPages: number
  totalCount: number
  heroImage?: string
}) {
  const from = totalCount === 0 ? 0 : (page - 1) * DESTINATIONS_PAGE_SIZE + 1
  const to = Math.min(page * DESTINATIONS_PAGE_SIZE, totalCount)

  return (
    <div>
      <section className="relative isolate -mt-24 h-[min(52svh,28rem)] min-h-[20rem] overflow-hidden md:h-[min(48svh,32rem)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={heroImage}
          alt=""
          className="absolute inset-0 size-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-panel via-brand-panel/55 to-brand-panel/25" />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-panel/50 via-transparent to-transparent" />

        <MarketingContainer className="relative z-10 flex h-full flex-col justify-end pb-10 pt-28 text-white md:pb-14 md:pt-32">
          <Link
            href="/#destinations"
            className="mb-5 inline-flex w-fit items-center gap-1.5 text-sm font-bold text-white/75 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-4" />
            Back to home
          </Link>
          <h1 className="font-brand text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
            Destinations
          </h1>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-white/85 md:text-lg">
            Airport transfers to Albania&apos;s most loved cities, coasts, and
            mountain escapes.
          </p>
        </MarketingContainer>
      </section>

      <MarketingContainer className="relative py-10 md:py-14 lg:py-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className={cn(MARKETING_SECTION_TITLE, "text-2xl md:text-3xl")}>
            All destinations
          </h2>
          <p className="text-sm font-semibold text-muted-foreground">
            {totalCount === 0
              ? "No destinations yet"
              : `Showing ${from}–${to} of ${totalCount}`}
          </p>
        </div>

        {destinations.length > 0 ? (
          <ul className="mt-8 grid list-none grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:mt-10 lg:grid-cols-3 lg:gap-7">
            {destinations.map((destination, index) => (
              <li key={destination.id}>
                <DestinationCard
                  destination={destination}
                  priority={index < 3}
                  className="h-full"
                />
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-12 rounded-3xl border border-dashed border-border bg-brand-surface px-6 py-16 text-center">
            <p className="text-lg font-bold text-brand">No destinations found</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Check back soon for new transfer routes across Albania.
            </p>
          </div>
        )}

        <Pagination page={page} totalPages={totalPages} />

        <div className="mt-14 flex flex-col items-start justify-between gap-4 rounded-3xl bg-brand-panel px-6 py-8 text-white sm:flex-row sm:items-center sm:px-8 md:mt-16">
          <div>
            <p className="text-lg font-extrabold tracking-tight">
              Ready to book a transfer?
            </p>
            <p className="mt-1 text-sm text-white/70">
              Choose your route and lock in a fixed price in minutes.
            </p>
          </div>
          <Link
            href="/#book"
            className="inline-flex h-11 items-center justify-center rounded-full bg-brand-accent px-6 text-sm font-extrabold text-white transition-colors hover:bg-brand-accent-hover"
          >
            Book now
          </Link>
        </div>
      </MarketingContainer>
    </div>
  )
}
