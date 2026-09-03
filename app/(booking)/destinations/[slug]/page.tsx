import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"

import { HashLink } from "@/components/marketing/hash-link"
import { BlogFaq } from "@/components/marketing/blog/blog-faq"
import { DestinationAttractionsSection } from "@/components/marketing/destination-attractions-section"
import { DestinationsSection } from "@/components/marketing/destinations-section"
import { JsonLd } from "@/components/marketing/json-ld"
import { MarketingContainer } from "@/components/marketing/marketing-container"
import { TestimonialsSection } from "@/components/marketing/testimonials-section"
import {
  getDestinationAttractionsGrid,
  getDestinationFaqs,
  getDestinationHero,
  getDestinationMore,
  getDestinationRoute,
} from "@/lib/destination-document"
import { isSafeDestinationCanonicalUrl } from "@/lib/destination-json-schema"
import { DESTINATION_SLUG_ALIASES } from "@/lib/destinations"
import { getRequestLocale } from "@/lib/i18n/get-locale"
import { localePath, localizedAlternates } from "@/lib/i18n/locales"
import { t } from "@/lib/i18n/t"
import {
  pageMetadataFields,
  resolveDestination,
  resolveDestinationCards,
  resolveDestinationPage,
} from "@/lib/page-content"
import { resolveDestinationTransferLink } from "@/lib/transfers/routes"
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
  const aliasTarget = DESTINATION_SLUG_ALIASES[slug.toLowerCase()]
  if (aliasTarget && aliasTarget !== slug) {
    return {}
  }
  const locale = await getRequestLocale()
  const destination = await resolveDestination(slug, locale)
  if (destination) {
    const resolved = await resolveDestinationPage(destination.id, locale)
    if (resolved) {
      const { page, document } = resolved
      const hero = getDestinationHero(document)
      const meta = pageMetadataFields(page)
      const publicSlug = document.meta.slug || destination.slug
      const cmsCanonical = document.meta.canonicalUrl?.trim() ?? ""
      // Absolute CMS canonicals are ignored (SEO hijack). Relative paths only.
      const canonicalPath =
        cmsCanonical && isSafeDestinationCanonicalUrl(cmsCanonical)
          ? cmsCanonical
          : localePath(`/destinations/${publicSlug}`, locale)
      return {
        ...meta,
        title: page.title || document.meta.title || meta.title,
        description:
          page.description || document.meta.description || meta.description,
        alternates: {
          ...meta.alternates,
          // Prefer relative canonical; never emit absolute external URLs from CMS.
          canonical: canonicalPath.startsWith("http")
            ? undefined
            : canonicalPath,
          languages: localizedAlternates(
            `/destinations/${publicSlug}`,
            locale,
          ).languages,
        },
        openGraph: {
          ...meta.openGraph,
          images: [
            {
              url: hero?.src || page.ogImage || destination.image,
              width: 1200,
              height: 630,
              alt: hero?.alt || document.meta.title || page.title,
            },
          ],
        },
      }
    }
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

  const aliasTarget = DESTINATION_SLUG_ALIASES[slug.toLowerCase()]
  if (aliasTarget && aliasTarget !== slug) {
    redirect(localePath(`/destinations/${aliasTarget}`, locale))
  }

  const destination = await resolveDestination(slug, locale)
  if (!destination) notFound()

  const [resolved, destinationCards] = await Promise.all([
    resolveDestinationPage(destination.id, locale),
    resolveDestinationCards(locale),
  ])
  if (!resolved) notFound()

  const { document } = resolved
  const meta = document.meta
  const hero = getDestinationHero(document)
  const route = getDestinationRoute(document)
  const attractionsGrid = getDestinationAttractionsGrid(document)
  const more = getDestinationMore(document)
  const faqs = getDestinationFaqs(document)

  const name = meta.title || destination.name
  const region = meta.region || destination.region
  const description = meta.description || destination.description
  const image =
    [hero?.src, resolved.page.ogImage, destination.image].find((url) =>
      Boolean(url && url.startsWith("/uploads/")),
    ) ||
    hero?.src ||
    resolved.page.ogImage ||
    destination.image ||
    "/marketing/logo.svg"
  const imageAlt = hero?.alt || name
  const priceFrom = meta.priceFrom || destination.priceFrom
  // Same label as hero <h1> (CMS Hero Heading, with i18n fallback).
  const pageHeading =
    hero?.heading?.trim() ||
    t(locale, "destinations.airportTransfer", { name })
  const moreHeading =
    more?.heading || t(locale, "destinations.moreHeading")
  const attractionsHeading =
    attractionsGrid?.heading || t(locale, "destinations.attractionsHeading")
  const attractions = (attractionsGrid?.items ?? [])
    .filter((item) => item.heading || item.body || item.src)
    .map((item) => ({
      id: item.id,
      title: item.heading,
      description: item.body,
      image: item.src,
      imageAlt: item.alt || item.heading,
    }))

  const routeHeading =
    route?.heading || t(locale, "destinations.gettingTo", { name })
  const routeDistance = route?.distance ?? ""
  const routeDuration = route?.duration ?? ""
  const routeWhyBook = route?.whyBook ?? ""
  const hasRouteContent = Boolean(
    routeDistance || routeDuration || routeWhyBook,
  )

  const reviewKeyword = destination.reviewKeywords[0] ?? destination.name
  const moreDestinations = destinationCards.filter(
    (d) => d.id !== destination.id,
  )
  const publicSlug = meta.slug || destination.slug

  const destinationsLabel = t(locale, "nav.destinations") || "Destinations"
  const homeLabel = t(locale, "nav.home") || "Home"
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: homeLabel, url: localePath("/", locale) },
    { name: destinationsLabel, url: localePath("/destinations", locale) },
    {
      name: pageHeading,
      url: localePath(`/destinations/${publicSlug}`, locale),
    },
  ])
  const touristDestinationJsonLd = buildTouristDestinationJsonLd({
    name,
    description,
    image,
    url: localePath(`/destinations/${publicSlug}`, locale),
    attractions: attractions.map((a) => ({
      name: a.title,
      description: a.description,
      image: a.image,
    })),
  })

  const faqItems =
    faqs?.items
      .filter((item) => item.question.trim() || item.answer.trim())
      .map((item) => ({
        question: item.question,
        answer: item.answer,
      })) ?? []

  const transferLink = resolveDestinationTransferLink(destination.id, meta)

  return (
    <>
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={touristDestinationJsonLd} />
      {document.sections.map((section) => {
        switch (section.type) {
          case "hero":
            return (
              <section
                key={section.id}
                className="relative isolate -mt-24 h-[70vh] min-h-[70vh] overflow-hidden sm:h-[60vh] sm:min-h-[60vh]"
              >
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
                        <Link
                          href={localePath("/", locale)}
                          className="hover:text-white"
                        >
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
                        {pageHeading}
                      </li>
                    </ol>
                  </nav>
                  <p className="text-xs font-extrabold tracking-widest text-white uppercase">
                    {region}
                  </p>
                  <h1 className="mt-2 font-brand text-4xl font-extrabold tracking-tight sm:text-5xl">
                    {pageHeading}
                  </h1>
                  <p className="mt-3 max-w-xl text-base text-white/85">
                    {description}
                  </p>
                  <HashLink
                    href={localePath(
                      `/?destination=${encodeURIComponent(destination.id)}#book`,
                      locale,
                    )}
                    className="mt-6 inline-flex h-11 w-fit items-center justify-center rounded-full bg-primary px-5 text-sm font-extrabold text-primary-foreground"
                  >
                    {t(locale, "cta.bookTransferFrom", { price: priceFrom })}
                  </HashLink>
                  {transferLink ? (
                    <p className="mt-3 max-w-xl text-sm text-white/85">
                      <Link
                        href={localePath(
                          `/transfers/${transferLink.transferSlug}`,
                          locale,
                        )}
                        className="font-semibold text-white underline underline-offset-2 hover:text-white/90"
                      >
                        {transferLink.anchor}
                      </Link>
                    </p>
                  ) : null}
                </MarketingContainer>
              </section>
            )
          case "route_details":
            if (!hasRouteContent) return null
            return (
              <section key={section.id} className="py-8 md:py-10">
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
            )
          case "attractions_grid":
            return (
              <div key={section.id}>
                <DestinationAttractionsSection
                  heading={attractionsHeading}
                  attractions={attractions}
                />
                <TestimonialsSection destination={reviewKeyword} />
              </div>
            )
          case "more_destinations":
            if (moreDestinations.length === 0) return null
            return (
              <DestinationsSection
                key={section.id}
                heading={moreHeading}
                text={t(locale, "destinations.moreText")}
                destinations={moreDestinations}
                className="py-16 md:py-24"
              />
            )
          case "faq_accordion":
            if (faqItems.length === 0) return null
            return (
              <MarketingContainer key={section.id} className="py-12 md:py-16">
                <BlogFaq items={faqItems} />
              </MarketingContainer>
            )
          default:
            return null
        }
      })}
    </>
  )
}
