import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ArrowRightIcon,
  BanknoteIcon,
  ChevronRightIcon,
  ClockIcon,
  NavigationIcon,
  PlaneIcon,
  SparklesIcon,
} from "lucide-react"

import { BlogFaq } from "@/components/marketing/blog/blog-faq"
import { JsonLd } from "@/components/marketing/json-ld"
import {
  MARKETING_SECTION_TITLE,
  MarketingContainer,
} from "@/components/marketing/marketing-container"
import { getRequestLocale } from "@/lib/i18n/get-locale"
import {
  DEFAULT_LOCALE,
  OG_LOCALE,
  englishOnlyAlternates,
  localizedAlternates,
  localePath,
} from "@/lib/i18n/locales"
import { t } from "@/lib/i18n/t"
import { hasTransferLocaleRow } from "@/lib/transfers/cms"
import {
  getRelatedRoutes,
  getRouteData,
  routeDestinationLabel,
} from "@/lib/transfers/routes"
import { homepageBookHref } from "@/lib/booking-destination-param"
import {
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
  buildServiceJsonLd,
} from "@/lib/structured-data"
import { cn } from "@/lib/utils"
import {
  searchTitle,
  transferRouteId,
  transferSearchCopy,
} from "@/lib/seo/search-meta"

type PageProps = {
  params: Promise<{ slug: string }>
}

/**
 * Locale comes from middleware via cookies()/headers() (getRequestLocale).
 * Keep force-dynamic — same constraint as /destinations/[slug].
 */
export const dynamic = "force-dynamic"

function bookHref(
  route: { destinationId: string; zoneName: string; slug: string },
  locale: Awaited<ReturnType<typeof getRequestLocale>>,
) {
  const key = route.destinationId || route.zoneName || route.slug
  return localePath(homepageBookHref(key), locale)
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params
  const locale = await getRequestLocale()
  const route = await getRouteData(slug, locale)
  if (!route) {
    return { title: "Airport transfer" }
  }

  const seo = transferSearchCopy(
    transferRouteId(route.slug),
    locale,
    route.destinationName,
    route.priceEur,
  )
  const title = searchTitle(seo.heading)
  const description = seo.description
  const path = `/transfers/${route.slug}`
  const isTranslated =
    locale === DEFAULT_LOCALE ||
    (await hasTransferLocaleRow(route.slug, locale))
  const alternates = isTranslated
    ? localizedAlternates(path, locale)
    : englishOnlyAlternates(path)

  return {
    title,
    description,
    alternates,
    openGraph: {
      title: title.absolute,
      description,
      url: alternates.canonical,
      locale: OG_LOCALE[locale],
      images: [
        {
          url: route.heroImageUrl,
          width: 1600,
          height: 900,
          alt: seo.heading,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: title.absolute,
      description,
      images: [route.heroImageUrl],
    },
  }
}

export default async function TransferRoutePage({ params }: PageProps) {
  const { slug } = await params
  const locale = await getRequestLocale()
  const route = await getRouteData(slug, locale)
  if (!route) notFound()

  const seo = transferSearchCopy(
    transferRouteId(route.slug),
    locale,
    route.destinationName,
    route.priceEur,
  )
  const related = await getRelatedRoutes(route.slug, 3, locale)
  const path = `/transfers/${route.slug}`
  const pageUrl = localePath(path, locale)
  const ctaHref = bookHref(route, locale)

  const homeLabel = t(locale, "nav.home") || "Home"
  const zeroDeposit = t(locale, "transfer.zeroDeposit")
  const trustItems = [
    { label: t(locale, "transfer.payCash"), icon: BanknoteIcon },
    { label: t(locale, "transfer.flightTracking"), icon: PlaneIcon },
    { label: t(locale, "transfer.meetGreet"), icon: SparklesIcon },
  ] as const

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: homeLabel, url: localePath("/", locale) },
    {
      name: `TIA → ${route.destinationName}`,
      url: pageUrl,
    },
  ])
  const serviceJsonLd = buildServiceJsonLd({
    name: seo.heading,
    description: route.travelDescription,
    url: pageUrl,
    priceEur: route.priceEur,
  })
  const faqJsonLd = buildFaqPageJsonLd(route.routeFaqs)

  return (
    <main>
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={serviceJsonLd} />
      {faqJsonLd ? <JsonLd data={faqJsonLd} /> : null}

      {/* Hero Header */}
      <header className="relative isolate -mt-24 min-h-[max(78svh,36rem)] overflow-hidden sm:min-h-[max(60svh,32rem)] lg:min-h-[34rem]">
        <Image
          src={route.heroImageUrl}
          alt={seo.heading}
          fill
          priority
          fetchPriority="high"
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-panel via-brand-panel/75 to-brand-panel/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-panel/65 via-transparent to-transparent" />

        <MarketingContainer className="relative z-10 flex min-h-[max(78svh,36rem)] flex-col justify-end pt-36 pb-12 text-white sm:min-h-[max(60svh,32rem)] sm:pt-32 md:pb-16 lg:min-h-[34rem]">
          <nav aria-label="Breadcrumb" className="mb-3">
            <ol className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-white/80">
              <li>
                <Link href={localePath("/", locale)} className="transition-colors hover:text-white">
                  {homeLabel}
                </Link>
              </li>
              <li aria-hidden className="text-white/50">
                <ChevronRightIcon className="size-3" />
              </li>
              <li aria-current="page" className="line-clamp-1 text-white">
                TIA → {route.destinationName}
              </li>
            </ol>
          </nav>

          <p className="text-xs font-extrabold tracking-widest text-white/90 uppercase">
            {t(locale, "transfer.eyebrow")}
          </p>

          <h1 className="mt-2 max-w-4xl font-brand text-3xl font-black tracking-tight text-white sm:text-4xl md:text-5xl lg:text-6xl">
            {seo.heading}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-2 sm:gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3.5 py-1 text-xs font-bold text-white backdrop-blur-sm">
              <NavigationIcon className="size-3" />
              <span>{t(locale, "transfer.km", { km: route.distanceKm })}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3.5 py-1 text-xs font-bold text-white backdrop-blur-sm">
              <ClockIcon className="size-3" />
              <span>{route.duration.label}</span>
            </span>
            <span className="inline-flex items-center rounded-full border border-brand-accent/40 bg-brand-accent px-3.5 py-1 text-xs font-black text-white shadow-xs">
              {t(locale, "transfer.fixedRate", {
                price: route.priceEur,
                deposit: zeroDeposit,
              })}
            </span>
          </div>

          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/85 sm:text-base md:text-lg">
            {route.travelDescription}
          </p>

          <div className="mt-6">
            <Link
              href={ctaHref}
              className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand-accent px-8 text-base font-extrabold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:brightness-95 active:scale-[0.98]"
            >
              <span>{t(locale, "transfer.bookCta", { price: route.priceEur })}</span>
              <ArrowRightIcon className="size-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
            </Link>
          </div>
        </MarketingContainer>
      </header>

      {/* Trust Items Bar */}
      <section
        aria-label={t(locale, "transfer.whyBook")}
        className="border-b border-border/80 bg-brand-surface shadow-2xs"
      >
        <MarketingContainer className="grid gap-3 py-5 sm:grid-cols-3 sm:gap-4 sm:py-6">
          {trustItems.map(({ label, icon: Icon }) => (
            <div
              key={label}
              className="flex items-center justify-center gap-2.5 rounded-2xl border border-border/70 bg-brand-page/60 px-4 py-3.5 text-center text-sm font-extrabold text-brand transition-colors hover:border-brand-accent/30"
            >
              <Icon className="size-4 shrink-0 text-brand-accent" />
              <span>{label}</span>
            </div>
          ))}
        </MarketingContainer>
      </section>

      {/* Compare Narrative Section */}
      {route.compareDescription.trim() ? (
        <section className="border-b border-border/70 bg-brand-page py-10 md:py-12">
          <MarketingContainer>
            <div className="rounded-3xl border border-border/80 bg-brand-surface p-6 shadow-xs sm:p-8">
              <p className="text-base leading-relaxed text-brand/80 sm:text-lg">
                {route.compareDescription.trim()}
              </p>
            </div>
          </MarketingContainer>
        </section>
      ) : null}

      {/* Comparison Table Section */}
      <section className="py-12 md:py-16">
        <MarketingContainer>
          <div className="max-w-2xl">
            <h2 className={MARKETING_SECTION_TITLE}>
              {route.compareHeading.trim() ||
                t(locale, "transfer.compareHeading")}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-brand/75 sm:text-base">
              {t(locale, "transfer.compareIntro", {
                destination: route.destinationName,
              })}
            </p>
          </div>
          <div className="mt-8 overflow-x-auto rounded-3xl border border-border/80 bg-brand-surface shadow-xs">
            <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
              <thead className="bg-brand-panel text-white">
                <tr>
                  <th className="px-5 py-3.5 font-extrabold">
                    {t(locale, "transfer.colOption")}
                  </th>
                  <th className="px-5 py-3.5 font-extrabold">
                    {t(locale, "transfer.colTypicalTime")}
                  </th>
                  <th className="px-5 py-3.5 font-extrabold">
                    {t(locale, "transfer.colChanges")}
                  </th>
                  <th className="px-5 py-3.5 font-extrabold">
                    {t(locale, "transfer.colPrice")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {route.comparisonTable.map((row) => (
                  <tr
                    key={row.mode}
                    className={cn(
                      "border-t border-border/60 transition-colors",
                      row.highlight
                        ? "bg-brand-accent/[0.08] font-bold"
                        : "odd:bg-brand-surface even:bg-brand-page/40 text-brand/80",
                    )}
                  >
                    <td className="px-5 py-4 font-bold text-brand">
                      <span>{row.mode}</span>
                      {row.highlight ? (
                        <span className="ml-2.5 inline-flex items-center rounded-full border border-brand-accent/30 bg-brand-accent/15 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-brand-accent">
                          {t(locale, "transfer.recommended")}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-5 py-4 font-medium text-brand/80">
                      {row.typicalTime}
                    </td>
                    <td className="px-5 py-4 font-medium text-brand/80">
                      {row.changes}
                    </td>
                    <td className="px-5 py-4 font-extrabold text-brand">
                      {row.priceClarity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </MarketingContainer>
      </section>

      {/* Insights Grid */}
      {route.insights && route.insights.length > 0 ? (
        <section className="bg-brand-page py-12 md:py-16">
          <MarketingContainer>
            <h2 className={MARKETING_SECTION_TITLE}>
              {t(locale, "transfer.insightsHeading")}
            </h2>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {route.insights.map((insight) => (
                <article
                  key={insight.title}
                  className="rounded-3xl border border-border/80 bg-brand-surface p-6 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-brand-accent/30 hover:shadow-md sm:p-7"
                >
                  <h3 className="font-brand text-lg font-black text-brand sm:text-xl">
                    {insight.title}
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-brand/75 sm:text-base">
                    {insight.body}
                  </p>
                </article>
              ))}
            </div>
          </MarketingContainer>
        </section>
      ) : null}

      {/* FAQ Section */}
      <section className="py-12 md:py-16">
        <MarketingContainer>
          <BlogFaq
            items={route.routeFaqs}
            heading={t(locale, "transfer.faqHeading")}
          />
        </MarketingContainer>
      </section>

      {/* Related Transfers Section */}
      {related.length > 0 ? (
        <section className="border-t border-border/80 bg-brand-page py-12 md:py-16">
          <MarketingContainer>
            <h2 className={MARKETING_SECTION_TITLE}>
              {t(locale, "transfer.relatedHeading")}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-brand/75 sm:text-base">
              {t(locale, "transfer.relatedText")}
            </p>
            <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={localePath(`/transfers/${item.slug}`, locale)}
                    className="group flex h-full flex-col overflow-hidden rounded-3xl border border-border/80 bg-brand-surface shadow-2xs transition-all duration-300 hover:-translate-y-1 hover:border-brand-accent/30 hover:shadow-md"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                      <Image
                        src={item.heroImageUrl}
                        alt={`Tirana Airport to ${item.destinationName}`}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                      />
                      <span className="absolute top-3.5 left-3.5 rounded-full border border-white/20 bg-brand-surface/95 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-brand-accent shadow-xs backdrop-blur-sm">
                        {t(locale, "transfer.km", { km: item.distanceKm })}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col justify-between gap-3 p-5 sm:p-6">
                      <div>
                        <h3 className="font-brand text-lg font-black leading-snug tracking-tight text-brand transition-colors duration-200 group-hover:text-brand-accent sm:text-xl">
                          {t(locale, "transfer.relatedAnchor", {
                            destination: item.destinationName,
                          })}
                        </h3>
                        <p className="mt-1 text-xs font-semibold text-muted-foreground">
                          {item.duration.label} · {routeDestinationLabel(item)}
                        </p>
                      </div>
                      <div className="mt-auto border-t border-border/50 pt-3">
                        <p className="text-sm font-black text-brand-accent">
                          {t(locale, "transfer.fixedFromCash", {
                            price: item.priceEur,
                          })}
                        </p>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </MarketingContainer>
        </section>
      ) : null}
    </main>
  )
}
