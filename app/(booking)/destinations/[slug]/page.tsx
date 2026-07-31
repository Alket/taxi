import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { HashLink } from "@/components/marketing/hash-link"
import { DestinationAttractionsSection } from "@/components/marketing/destination-attractions-section"
import { DestinationsSection } from "@/components/marketing/destinations-section"
import { MarketingContainer } from "@/components/marketing/marketing-container"
import { TestimonialsSection } from "@/components/marketing/testimonials-section"
import { getRequestLocale } from "@/lib/i18n/get-locale"
import { localePath } from "@/lib/i18n/locales"
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

type PageProps = {
  params: Promise<{ slug: string }>
}

/** CMS images/copy must stay fresh after admin edits. */
export const dynamic = "force-dynamic"

export async function generateStaticParams() {
  const destinations = await resolveDestinationCards()
  return destinations.map((d) => ({ slug: d.id }))
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params
  const locale = await getRequestLocale()
  const page = await resolvePageContent(`destinations/${slug}`, locale)
  if (page) return pageMetadataFields(page)
  const destination = await resolveDestination(slug, locale)
  if (!destination) return { title: "Destination" }
  return {
    title: destination.name,
    description: destination.description,
  }
}

export default async function DestinationPage({ params }: PageProps) {
  const { slug } = await params
  const locale = await getRequestLocale()
  const destination = await resolveDestination(slug, locale)
  if (!destination) notFound()

  const [page, destinationCards] = await Promise.all([
    resolvePageContent(`destinations/${slug}`, locale),
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
      url.startsWith("/uploads/"),
    ) ||
    heroSrc ||
    page?.ogImage ||
    destination.image
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

  const reviewKeyword = destination.reviewKeywords[0] ?? destination.name
  const moreDestinations = destinationCards.filter(
    (d) => d.id !== destination.id,
  )

  return (
    <>
      <section className="relative isolate -mt-24 h-[60vh] min-h-[60vh] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={imageAlt}
          className="absolute inset-0 size-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-panel/90 via-brand-panel/40 to-brand-panel/20" />
        <MarketingContainer className="relative z-10 flex h-full flex-col justify-end py-12 pb-[max(4rem,env(safe-area-inset-bottom))] text-white">
          <p className="text-xs font-extrabold tracking-widest text-white uppercase">
            {region}
          </p>
          <h1 className="mt-2 font-brand text-4xl font-extrabold tracking-tight sm:text-5xl">
            {name}
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
