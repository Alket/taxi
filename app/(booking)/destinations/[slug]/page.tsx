import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"

import { HashLink } from "@/components/marketing/hash-link"
import { DestinationAttractionsSection } from "@/components/marketing/destination-attractions-section"
import { DestinationsSection } from "@/components/marketing/destinations-section"
import { JsonLd } from "@/components/marketing/json-ld"
import { MarketingContainer } from "@/components/marketing/marketing-container"
import { TestimonialsSection } from "@/components/marketing/testimonials-section"
import { getRequestLocale } from "@/lib/i18n/get-locale"
import { localePath, localizedAlternates } from "@/lib/i18n/locales"
import { t } from "@/lib/i18n/t"
import {
  attractionsFromSections,
  pageMetadataFields,
  resolveDestination,
  resolveDestinationCards,
  resolvePageContent,
  sectionHeading,
  sectionValue,
} from "@/lib/page-content"
import {
  buildBreadcrumbJsonLd,
  buildTouristDestinationJsonLd,
} from "@/lib/structured-data"

type PageProps = {
  params: Promise<{ slug: string }>
}

/**
 * Locale comes from middleware via cookies()/headers() (getRequestLocale).
 * That makes this route dynamic — do NOT pair it with generateStaticParams /
 * ISR, or production serves a static shell that 500s when headers are read
 * (seen on /destinations/[slug] while /destinations stayed healthy).
 */
export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params
  const locale = await getRequestLocale()
  const destination = await resolveDestination(slug, locale)
  if (destination) {
    const page = await resolvePageContent(
      `destinations/${destination.id}`,
      locale,
    )
    if (page) return pageMetadataFields(page)
    return {
      title: t(locale, "destinations.airportTransfer", {
        name: destination.name,
      }),
      description: destination.description,
      alternates: localizedAlternates(
        `/destinations/${destination.slug}`,
        locale,
      ),
    }
  }
  return { title: t(locale, "nav.destinations") }
}

export default async function DestinationPage({ params }: PageProps) {
  const { slug } = await params
  const locale = await getRequestLocale()
  const destination = await resolveDestination(slug, locale)
  if (!destination) notFound()

  const [page, destinationCards] = await Promise.all([
    resolvePageContent(`destinations/${destination.id}`, locale),
    resolveDestinationCards(locale),
  ])
  const sections = page?.sections ?? []

  const name = sectionHeading(sections, "title") || destination.name
  const region = sectionValue(sections, "region") || destination.region
  const description =
    sectionValue(sections, "description") || destination.description
  const heroSrc = sectionValue(sections, "hero", "src")
  const image =
    [heroSrc, page?.ogImage ?? "", destination.image].find((url) =>
      Boolean(url && url.startsWith("/uploads/")),
    ) ||
    heroSrc ||
    page?.ogImage ||
    destination.image ||
    "/marketing/logo.svg"
  const imageAlt = sectionValue(sections, "hero", "alt") || name
  const priceFrom =
    sectionValue(sections, "priceFrom") || destination.priceFrom
  const moreHeading =
    sectionHeading(sections, "more.heading") ||
    t(locale, "destinations.moreHeading")
  const attractionsHeading =
    sectionHeading(sections, "attractions.heading") ||
    t(locale, "destinations.attractionsHeading")
  const attractions = attractionsFromSections(sections)

  const routeHeading =
    sectionHeading(sections, "route.heading") ||
    t(locale, "destinations.gettingTo", { name })
  const routeDistance = sectionValue(sections, "route.distance")
  const routeDuration = sectionValue(sections, "route.duration")
  const routeWhyBook = sectionValue(sections, "route.whyBook")
  const hasRouteContent = Boolean(
    routeDistance || routeDuration || routeWhyBook,
  )

  const reviewKeyword = destination.reviewKeywords[0] ?? destination.name
  const moreDestinations = destinationCards.filter(
    (d) => d.id !== destination.id,
  )
  const publicSlug = destination.slug

  const destinationsLabel = t(locale, "nav.destinations") || "Destinations"
  const homeLabel = t(locale, "nav.home") || "Home"
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: homeLabel, url: localePath("/", locale) },
    { name: destinationsLabel, url: localePath("/destinations", locale) },
    { name, url: localePath(`/destinations/${publicSlug}`, locale) },
  ])
  const touristDestinationJsonLd = buildTouristDestinationJsonLd({
    name,
    description,
    image,
    url: localePath(`/destinations/${publicSlug}`, locale),
  })

  return (
    <>
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={touristDestinationJsonLd} />
      <section className="relative isolate -mt-24 h-[60vh] min-h-[60vh] overflow-hidden">
        <Image
          src={image}
          alt={imageAlt}
          fill
          priority
          fetchPriority="high"
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-panel/90 via-brand-panel/40 to-brand-panel/20" />
        <MarketingContainer className="relative z-10 flex h-full flex-col justify-end py-12 pb-[max(4rem,env(safe-area-inset-bottom))] text-white">
          <nav aria-label="Breadcrumb" className="mb-2">
            <ol className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-white/80">
              <li>
                <Link href={localePath("/", locale)} className="hover:text-white">
                  {homeLabel}
                </Link>
              </li>
              <li aria-hidden className="text-white/50">
                /
              </li>
              <li>
                <Link
                  href={localePath("/destinations", locale)}
                  className="hover:text-white"
                >
                  {destinationsLabel}
                </Link>
              </li>
              <li aria-hidden className="text-white/50">
                /
              </li>
              <li aria-current="page" className="text-white">
                {name}
              </li>
            </ol>
          </nav>
          <p className="text-xs font-extrabold tracking-widest text-white uppercase">
            {region}
          </p>
          <h1 className="mt-2 font-brand text-4xl font-extrabold tracking-tight sm:text-5xl">
            {t(locale, "destinations.airportTransfer", { name })}
          </h1>
          <p className="mt-3 max-w-xl text-base text-white/85">{description}</p>
          <HashLink
            href={localePath("/#book", locale)}
            className="mt-6 inline-flex h-11 w-fit items-center justify-center rounded-full bg-primary px-5 text-sm font-extrabold text-primary-foreground"
          >
            {t(locale, "cta.bookTransferFrom", { price: priceFrom })}
          </HashLink>
        </MarketingContainer>
      </section>

      {hasRouteContent ? (
        <section className="py-12 md:py-16">
          <MarketingContainer>
            <h2 className="font-brand text-2xl font-extrabold tracking-tight text-brand sm:text-3xl">
              {routeHeading}
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {routeDistance || routeDuration ? (
                <dl className="grid gap-3 rounded-2xl border border-border bg-brand-surface p-5 sm:grid-cols-2">
                  {routeDistance ? (
                    <div>
                      <dt className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                        {t(locale, "destinations.distance")}
                      </dt>
                      <dd className="mt-1 text-sm font-semibold text-brand">
                        {routeDistance}
                      </dd>
                    </div>
                  ) : null}
                  {routeDuration ? (
                    <div>
                      <dt className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                        {t(locale, "destinations.travelTime")}
                      </dt>
                      <dd className="mt-1 text-sm font-semibold text-brand">
                        {routeDuration}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}
              {routeWhyBook ? (
                <p className="rounded-2xl border border-border bg-brand-surface p-5 text-sm leading-relaxed text-muted-foreground sm:col-span-1">
                  {routeWhyBook}
                </p>
              ) : null}
            </div>
          </MarketingContainer>
        </section>
      ) : null}

      <DestinationAttractionsSection
        heading={attractionsHeading}
        attractions={attractions}
      />

      <TestimonialsSection destination={reviewKeyword} />

      {moreDestinations.length > 0 ? (
        <DestinationsSection
          heading={moreHeading}
          text={t(locale, "destinations.moreText")}
          destinations={moreDestinations}
          className="py-16 md:py-24"
        />
      ) : null}
    </>
  )
}
