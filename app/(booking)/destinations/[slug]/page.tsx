import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound, permanentRedirect } from "next/navigation"
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  ClockIcon,
  NavigationIcon,
} from "lucide-react"

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
import { getSettings } from "@/lib/settings"
import { destinationSearchCopy, searchTitle } from "@/lib/seo/search-meta"
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
      // Canonical must be this locale's own URL. The CMS value is the English
      // path and is copied onto every translation, which made hreflang and
      // rel=canonical disagree.
      const alternates = localizedAlternates(
        `/destinations/${publicSlug}`,
        locale,
      )
      const seo = destinationSearchCopy(destination.id, locale)
      const title = searchTitle(
        seo?.heading || page.title || document.meta.title || "Airport transfer",
      )
      const description = seo?.description || page.description || meta.description
      return {
        ...meta,
        title,
        description,
        alternates,
        twitter: {
          ...meta.twitter,
          title: title.absolute,
          description,
        },
        openGraph: {
          ...meta.openGraph,
          title: title.absolute,
          description,
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
    const seo = destinationSearchCopy(destination.id, locale)
    const title = searchTitle(
      seo?.heading ||
        t(locale, "destinations.airportTransfer", { name: destination.name }),
    )
    return {
      title,
      description: seo?.description || destination.description,
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
    permanentRedirect(localePath(`/destinations/${aliasTarget}`, locale))
  }

  const destination = await resolveDestination(slug, locale)
  if (!destination) notFound()

  const [resolved, destinationCards, settings] = await Promise.all([
    resolveDestinationPage(destination.id, locale),
    resolveDestinationCards(locale),
    getSettings().catch(() => null),
  ])
  if (!resolved) notFound()

  const showCustomerReviews = settings?.customerReviewsVisibleOnSite ?? true
  const showTrustpilotTestimonials =
    settings?.trustpilotTestimonialsVisibleOnSite ?? false

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
  // H1 matches the search title so Google does not replace it with a
  // different heading. The route phrase is the page's main title.
  const seoHeading = destinationSearchCopy(destination.id, locale)?.heading
  const pageHeading =
    seoHeading ||
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
                className="relative isolate -mt-24 min-h-[max(72svh,34rem)] overflow-hidden sm:min-h-[max(60svh,30rem)] lg:min-h-[34rem]"
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
                <div className="absolute inset-0 bg-gradient-to-t from-brand-panel via-brand-panel/75 to-brand-panel/40" />
                <div className="absolute inset-0 bg-gradient-to-r from-brand-panel/65 via-transparent to-transparent" />
                <MarketingContainer className="relative z-10 flex min-h-[max(72svh,34rem)] flex-col justify-end pt-36 pb-12 text-white sm:min-h-[max(60svh,30rem)] sm:pt-32 md:pb-16 lg:min-h-[34rem]">
                  <nav aria-label="Breadcrumb" className="mb-3">
                    <ol className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-white/80">
                      <li>
                        <Link
                          href={localePath("/", locale)}
                          className="transition-colors hover:text-white"
                        >
                          {homeLabel}
                        </Link>
                      </li>
                      <li aria-hidden className="text-white/50">
                        <ChevronRightIcon className="size-3" />
                      </li>
                      <li>
                        <Link
                          href={localePath("/destinations", locale)}
                          className="transition-colors hover:text-white"
                        >
                          {destinationsLabel}
                        </Link>
                      </li>
                      <li aria-hidden className="text-white/50">
                        <ChevronRightIcon className="size-3" />
                      </li>
                      <li aria-current="page" className="line-clamp-1 text-white">
                        {pageHeading}
                      </li>
                    </ol>
                  </nav>

                  <p className="text-xs font-extrabold tracking-widest text-white/90 uppercase">
                    {region}
                  </p>

                  <h1 className="mt-2 max-w-4xl font-brand text-3xl font-black tracking-tight text-white sm:text-4xl md:text-5xl lg:text-6xl">
                    {pageHeading}
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/85 sm:text-base md:text-lg">
                    {description}
                  </p>

                  <div className="mt-6 flex flex-wrap items-center gap-4">
                    <HashLink
                      href={localePath(
                        `/?destination=${encodeURIComponent(destination.id)}#book`,
                        locale,
                      )}
                      className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand-accent px-8 text-base font-extrabold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:brightness-95 active:scale-[0.98]"
                    >
                      <span>{t(locale, "cta.bookTransferFrom", { price: priceFrom })}</span>
                      <ArrowRightIcon className="size-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
                    </HashLink>
                  </div>

                  {transferLink ? (
                    <p className="mt-4 max-w-xl text-sm text-white/90">
                      <Link
                        href={localePath(
                          `/transfers/${transferLink.transferSlug}`,
                          locale,
                        )}
                        className="group inline-flex items-center gap-1.5 font-bold text-white underline decoration-white/50 underline-offset-4 transition-colors hover:text-white hover:decoration-white"
                      >
                        <span>{transferLink.anchor}</span>
                        <ArrowRightIcon className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                      </Link>
                    </p>
                  ) : null}
                </MarketingContainer>
              </section>
            )
          case "route_details":
            if (!hasRouteContent) return null
            return (
              <section key={section.id} className="py-12 md:py-16">
                <MarketingContainer>
                  <div className="max-w-2xl">
                    <h2 className="font-brand text-2xl font-black tracking-tight text-brand sm:text-3xl">
                      {routeHeading}
                    </h2>
                  </div>
                  <div className="mt-6 grid gap-6 sm:grid-cols-2">
                    {routeDistance || routeDuration ? (
                      <dl className="grid gap-4 rounded-3xl border border-border/80 bg-brand-surface p-6 shadow-xs sm:grid-cols-2 sm:p-7">
                        {routeDistance ? (
                          <div className="flex items-start gap-3">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand-accent/10 text-brand-accent shadow-2xs">
                              <NavigationIcon className="size-5" aria-hidden />
                            </span>
                            <div>
                              <dt className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                                {t(locale, "destinations.distance")}
                              </dt>
                              <dd className="mt-1 font-mono text-base font-extrabold text-brand sm:text-lg">
                                {routeDistance}
                              </dd>
                            </div>
                          </div>
                        ) : null}
                        {routeDuration ? (
                          <div className="flex items-start gap-3">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand-accent/10 text-brand-accent shadow-2xs">
                              <ClockIcon className="size-5" aria-hidden />
                            </span>
                            <div>
                              <dt className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                                {t(locale, "destinations.travelTime")}
                              </dt>
                              <dd className="mt-1 font-mono text-base font-extrabold text-brand sm:text-lg">
                                {routeDuration}
                              </dd>
                            </div>
                          </div>
                        ) : null}
                      </dl>
                    ) : null}
                    {routeWhyBook ? (
                      <div className="flex flex-col justify-center rounded-3xl border border-brand-accent/25 bg-brand-surface p-6 shadow-xs sm:col-span-1 sm:p-7">
                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-brand-accent">
                          <CheckCircle2Icon className="size-4" aria-hidden />
                          <span>{t(locale, "destinations.readyEyebrow")}</span>
                        </div>
                        <p className="mt-2 text-sm font-medium leading-relaxed text-brand/80 sm:text-base">
                          {routeWhyBook}
                        </p>
                      </div>
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
                {showCustomerReviews || showTrustpilotTestimonials ? (
                  <TestimonialsSection
                    destination={reviewKeyword}
                    showCustomerReviews={showCustomerReviews}
                    showTrustpilotTestimonials={showTrustpilotTestimonials}
                  />
                ) : null}
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
