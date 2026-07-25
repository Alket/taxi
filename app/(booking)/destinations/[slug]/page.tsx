import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { HashLink } from "@/components/marketing/hash-link"
import {
  MarketingContainer,
  MARKETING_SECTION_TITLE,
} from "@/components/marketing/marketing-container"
import { TestimonialsSection } from "@/components/marketing/testimonials-section"
import { DESTINATIONS, getDestination } from "@/lib/destinations"
import {
  pageMetadataFields,
  resolvePageContent,
  sectionHeading,
  sectionValue,
} from "@/lib/page-content"

type PageProps = {
  params: Promise<{ slug: string }>
}

/** CMS images/copy must stay fresh after admin edits. */
export const dynamic = "force-dynamic"

export function generateStaticParams() {
  return DESTINATIONS.map((d) => ({ slug: d.id }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const page = await resolvePageContent(`destinations/${slug}`)
  if (page) return pageMetadataFields(page)
  const destination = getDestination(slug)
  if (!destination) return { title: "Destination" }
  return {
    title: destination.name,
    description: destination.description,
  }
}

export default async function DestinationPage({ params }: PageProps) {
  const { slug } = await params
  const destination = getDestination(slug)
  if (!destination) notFound()

  const page = await resolvePageContent(`destinations/${slug}`)
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
    sectionHeading(sections, "more.heading") || "More destinations"

  const reviewKeyword = destination.reviewKeywords[0] ?? destination.name

  return (
    <>
      <section className="relative isolate -mt-24 h-[100dvh] min-h-[100svh] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={imageAlt}
          className="absolute inset-0 size-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-panel/90 via-brand-panel/40 to-brand-panel/20" />
        <MarketingContainer className="relative z-10 flex h-full min-h-[100svh] flex-col justify-end py-12 pb-[max(4rem,env(safe-area-inset-bottom))] text-white">
          <p className="text-xs font-extrabold tracking-widest text-brand-accent uppercase">
            {region}
          </p>
          <h1 className="mt-2 font-brand text-4xl font-extrabold tracking-tight sm:text-5xl">
            {name}
          </h1>
          <p className="mt-3 max-w-xl text-base text-white/85">{description}</p>
          <HashLink
            href="/#book"
            className="mt-6 inline-flex h-11 w-fit items-center justify-center rounded-full bg-primary px-5 text-sm font-extrabold text-primary-foreground"
          >
            Book a transfer · from {priceFrom}
          </HashLink>
        </MarketingContainer>
      </section>

      <TestimonialsSection destination={reviewKeyword} />

      <section className="bg-white py-16 md:py-24">
        <MarketingContainer>
          <h2 className={MARKETING_SECTION_TITLE}>{moreHeading}</h2>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {DESTINATIONS.filter((d) => d.id !== destination.id).map((d) => (
              <li key={d.id}>
                <Link
                  href={`/destinations/${d.id}`}
                  className="block rounded-xl border bg-card px-4 py-3 text-sm font-semibold transition-colors hover:border-primary hover:text-primary"
                >
                  {d.name}
                </Link>
              </li>
            ))}
          </ul>
        </MarketingContainer>
      </section>
    </>
  )
}
