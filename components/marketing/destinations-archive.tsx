import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react"

import { DestinationCard } from "@/components/marketing/destination-card"
import {
  MarketingContainer,
  MARKETING_SECTION_TITLE,
} from "@/components/marketing/marketing-container"
import { DESTINATIONS, type Destination } from "@/lib/destinations"
import {
  DEFAULT_LOCALE,
  type Locale,
  localePath,
} from "@/lib/i18n/locales"
import { t } from "@/lib/i18n/t"
import { cn } from "@/lib/utils"

export const DESTINATIONS_PAGE_SIZE = 6

const ARCHIVE_HERO_FALLBACK = DESTINATIONS[0]?.image ?? ""

function pageHref(page: number, locale: Locale) {
  return localePath(
    page <= 1 ? "/destinations" : `/destinations?page=${page}`,
    locale,
  )
}

function Pagination({
  page,
  totalPages,
  locale,
}: {
  page: number
  totalPages: number
  locale: Locale
}) {
  if (totalPages <= 1) return null

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)

  return (
    <nav
      aria-label="Destinations pages"
      className="mt-12 flex flex-col items-center gap-4 border-t border-border/70 pt-10 md:mt-16"
    >
      <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
        {t(locale, "common.pageOf", { page, total: totalPages })}
      </p>
      <div className="flex items-center gap-2">
        <Link
          href={pageHref(page - 1, locale)}
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
                  href={pageHref(n, locale)}
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
          href={pageHref(page + 1, locale)}
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
  locale = DEFAULT_LOCALE,
}: {
  destinations: Destination[]
  page: number
  totalPages: number
  totalCount: number
  heroImage?: string
  locale?: Locale
}) {
  const from = totalCount === 0 ? 0 : (page - 1) * DESTINATIONS_PAGE_SIZE + 1
  const to = Math.min(page * DESTINATIONS_PAGE_SIZE, totalCount)

  return (
    <div>
      <section className="relative isolate -mt-24 h-[min(52svh,28rem)] min-h-[20rem] overflow-hidden md:h-[min(48svh,32rem)]">
        <Image
          src={heroImage}
          alt={t(locale, "nav.destinations")}
          fill
          priority
          fetchPriority="high"
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-panel via-brand-panel/55 to-brand-panel/25" />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-panel/50 via-transparent to-transparent" />

        <MarketingContainer className="relative z-10 flex h-full flex-col justify-end pb-10 pt-28 text-white md:pb-14 md:pt-32">
          <Link
            href={localePath("/", locale)}
            className="mb-5 inline-flex w-fit items-center gap-1.5 text-sm font-bold text-white/75 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-4" />
            {t(locale, "common.backHome")}
          </Link>
          <h1 className="font-brand text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
            {t(locale, "nav.destinations")}
          </h1>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-white/85 md:text-lg">
            {t(locale, "destinations.intro")}
          </p>
        </MarketingContainer>
      </section>

      <MarketingContainer className="relative py-10 md:py-14 lg:py-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className={cn(MARKETING_SECTION_TITLE, "text-2xl md:text-3xl")}>
            {t(locale, "destinations.all")}
          </h2>
          <p className="text-sm font-semibold text-muted-foreground">
            {totalCount === 0
              ? t(locale, "destinations.noneYet")
              : t(locale, "destinations.showing", {
                  from,
                  to,
                  total: totalCount,
                })}
          </p>
        </div>

        {destinations.length > 0 ? (
          <ul className="mt-8 grid list-none grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:mt-10 lg:grid-cols-3 lg:gap-7">
            {destinations.map((destination, index) => (
              <li key={destination.id}>
                <DestinationCard
                  destination={destination}
                  priority={index < 3}
                  className="h-[300px] md:h-[400px]"
                />
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-12 rounded-3xl border border-dashed border-border bg-brand-surface px-6 py-16 text-center">
            <p className="text-lg font-bold text-brand">
              {t(locale, "destinations.noneFound")}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t(locale, "destinations.noneHint")}
            </p>
          </div>
        )}

        <Pagination page={page} totalPages={totalPages} locale={locale} />

        <aside
          aria-label={t(locale, "destinations.readyTitle")}
          className="mt-14 overflow-hidden rounded-3xl border border-border bg-brand-surface md:mt-16"
        >
          <div className="flex flex-col gap-6 px-6 py-7 sm:px-8 sm:py-9 md:flex-row md:items-center md:justify-between md:gap-10">
            <div className="max-w-2xl">
              <p className="text-xs font-bold tracking-[0.14em] text-brand-accent uppercase">
                {t(locale, "destinations.readyEyebrow")}
              </p>
              <h2 className="mt-2 font-brand text-2xl font-extrabold tracking-tight text-brand md:text-3xl">
                {t(locale, "destinations.readyTitle")}
              </h2>
              <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                {t(locale, "destinations.readyText")}
              </p>
            </div>
            <Link
              href={localePath("/#book", locale)}
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-brand-accent px-7 text-sm font-extrabold text-white transition-colors hover:bg-brand-accent-hover"
            >
              {t(locale, "cta.bookTransfer")}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <div
            className="h-1.5 w-full bg-[color-mix(in_srgb,var(--brand-accent)_35%,transparent)]"
            aria-hidden
          />
        </aside>
      </MarketingContainer>
    </div>
  )
}
