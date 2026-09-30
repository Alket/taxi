import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"

import { BlogFaq } from "@/components/marketing/blog/blog-faq"
import { JsonLd } from "@/components/marketing/json-ld"
import {
  MARKETING_SECTION_TITLE,
  MarketingContainer,
} from "@/components/marketing/marketing-container"
import { getRequestLocale } from "@/lib/i18n/get-locale"
import {
  DEFAULT_LOCALE,
  localizedAlternates,
  localePath,
} from "@/lib/i18n/locales"
import { t } from "@/lib/i18n/t"
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

  const title = `Tirana Airport to ${route.destinationName} Transfer | Fixed €${route.priceEur} (Pay Cash)`
  const destLabel = routeDestinationLabel(route)
  const description = `Book a direct private transfer from Tirana Airport (TIA) to ${destLabel}. Guaranteed €${route.priceEur} flat rate, live flight tracking, €0 deposit—pay cash on arrival. Private driver Tirana Airport pickup with fixed taxi rate TIA pricing.`
  const path = `/transfers/${route.slug}`
  const alternates = localizedAlternates(path, locale)

  return {
    title,
    description,
    alternates,
    openGraph: {
      title,
      description,
      url: alternates.canonical,
      locale: locale === DEFAULT_LOCALE ? "en_US" : undefined,
      images: [
        {
          url: route.heroImageUrl,
          width: 1600,
          height: 900,
          alt: `Transfer from Tirana Airport to ${route.destinationName}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
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

  const related = await getRelatedRoutes(route.slug, 3, locale)
  const path = `/transfers/${route.slug}`
  const pageUrl = localePath(path, locale)
  const ctaHref = bookHref(route, locale)

  const homeLabel = t(locale, "nav.home") || "Home"
  const zeroDeposit = t(locale, "transfer.zeroDeposit")
  const trustItems = [
    t(locale, "transfer.payCash"),
    t(locale, "transfer.flightTracking"),
    t(locale, "transfer.meetGreet"),
  ] as const

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: homeLabel, url: localePath("/", locale) },
    {
      name: `TIA → ${route.destinationName}`,
      url: pageUrl,
    },
  ])
  const serviceJsonLd = buildServiceJsonLd({
    name: `Tirana Airport to ${routeDestinationLabel(route)} private transfer`,
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

      <header className="relative isolate -mt-24 min-h-[78vh] overflow-hidden sm:min-h-[58vh]">
        <Image
          src={route.heroImageUrl}
          alt={`Private transfer from Tirana Airport to ${route.destinationName}`}
          fill
          priority
          fetchPriority="high"
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-panel/95 via-brand-panel/50 to-brand-panel/25" />
        <MarketingContainer className="relative z-10 flex min-h-[78vh] flex-col justify-end py-12 pb-[max(3.5rem,env(safe-area-inset-bottom))] text-white sm:min-h-[58vh]">
          <nav aria-label="Breadcrumb" className="mb-3">
            <ol className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-white/80">
              <li>
                <Link href={localePath("/", locale)} className="hover:text-white">
                  {homeLabel}
                </Link>
              </li>
              <li aria-hidden className="text-white/50">
                /
              </li>
              <li aria-current="page" className="text-white">
                TIA → {route.destinationName}
              </li>
            </ol>
          </nav>

          <p className="text-xs font-extrabold tracking-widest text-white/85 uppercase">
            {t(locale, "transfer.eyebrow")}
          </p>
          <h1 className="mt-2 max-w-3xl font-brand text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
            Tirana Airport (TIA) to {route.destinationName} Transfer
          </h1>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-bold backdrop-blur-sm">
              {t(locale, "transfer.km", { km: route.distanceKm })}
            </span>
            <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-bold backdrop-blur-sm">
              {route.duration.label}
            </span>
            <span className="rounded-full bg-primary px-3 py-1 text-xs font-extrabold text-primary-foreground">
              {t(locale, "transfer.fixedRate", {
                price: route.priceEur,
                deposit: zeroDeposit,
              })}
            </span>
          </div>

          <p className="mt-4 max-w-2xl text-sm text-white/85 sm:text-base">
            {route.travelDescription}
          </p>

          <Link
            href={ctaHref}
            className="mt-6 inline-flex h-12 w-fit items-center justify-center rounded-full bg-primary px-6 text-sm font-extrabold text-primary-foreground"
          >
            {t(locale, "transfer.bookCta", { price: route.priceEur })}
          </Link>
        </MarketingContainer>
      </header>

      <section
        aria-label={t(locale, "transfer.whyBook")}
        className="border-b border-border bg-brand-surface"
      >
        <MarketingContainer className="grid gap-3 py-5 sm:grid-cols-3 sm:gap-4 sm:py-6">
          {trustItems.map((label) => (
            <p
              key={label}
              className="rounded-2xl border border-border bg-brand-page px-4 py-3 text-center text-sm font-bold text-brand"
            >
              {label}
            </p>
          ))}
        </MarketingContainer>
      </section>

      <section className="py-12 md:py-16">
        <MarketingContainer>
          <h2 className={MARKETING_SECTION_TITLE}>
            {t(locale, "transfer.compareHeading")}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {t(locale, "transfer.compareIntro", {
              destination: route.destinationName,
            })}
          </p>
          <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
              <thead className="bg-brand-surface">
                <tr>
                  <th className="px-4 py-3 font-bold text-brand">
                    {t(locale, "transfer.colOption")}
                  </th>
                  <th className="px-4 py-3 font-bold text-brand">
                    {t(locale, "transfer.colTypicalTime")}
                  </th>
                  <th className="px-4 py-3 font-bold text-brand">
                    {t(locale, "transfer.colChanges")}
                  </th>
                  <th className="px-4 py-3 font-bold text-brand">
                    {t(locale, "transfer.colPrice")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {route.comparisonTable.map((row) => (
                  <tr
                    key={row.mode}
                    className={cn(
                      "border-t border-border",
                      row.highlight && "bg-primary/5",
                    )}
                  >
                    <td className="px-4 py-3 font-semibold text-brand">
                      {row.mode}
                      {row.highlight ? (
                        <span className="ml-2 text-xs font-bold text-primary">
                          {t(locale, "transfer.recommended")}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.typicalTime}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.changes}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.priceClarity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </MarketingContainer>
      </section>

      {route.insights && route.insights.length > 0 ? (
        <section className="bg-brand-page py-12 md:py-16">
          <MarketingContainer>
            <h2 className={MARKETING_SECTION_TITLE}>
              {t(locale, "transfer.insightsHeading")}
            </h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {route.insights.map((insight) => (
                <article
                  key={insight.title}
                  className="rounded-2xl border border-border bg-brand-surface p-5"
                >
                  <h3 className="font-brand text-lg font-extrabold text-brand">
                    {insight.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {insight.body}
                  </p>
                </article>
              ))}
            </div>
          </MarketingContainer>
        </section>
      ) : null}

      <section className="py-12 md:py-16">
        <MarketingContainer>
          <BlogFaq
            items={route.routeFaqs}
            heading={t(locale, "transfer.faqHeading")}
          />
        </MarketingContainer>
      </section>

      {related.length > 0 ? (
        <section className="border-t border-border bg-brand-page py-12 md:py-16">
          <MarketingContainer>
            <h2 className={MARKETING_SECTION_TITLE}>
              {t(locale, "transfer.relatedHeading")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t(locale, "transfer.relatedText")}
            </p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={localePath(`/transfers/${item.slug}`, locale)}
                    className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-brand-surface transition-colors hover:border-primary/40"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                      <Image
                        src={item.heroImageUrl}
                        alt={`Tirana Airport to ${item.destinationName}`}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <h3 className="font-brand text-xl font-extrabold text-brand">
                        {t(locale, "transfer.relatedAnchor", {
                          destination: item.destinationName,
                        })}
                      </h3>
                      <p className="mt-1 text-xs font-semibold text-muted-foreground">
                        {t(locale, "transfer.km", { km: item.distanceKm })} ·{" "}
                        {item.duration.label} · {routeDestinationLabel(item)}
                      </p>
                      <p className="mt-3 text-sm font-extrabold text-primary">
                        {t(locale, "transfer.fixedFromCash", {
                          price: item.priceEur,
                        })}
                      </p>
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
