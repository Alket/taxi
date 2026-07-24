import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { TestimonialsSection } from "@/components/marketing/testimonials-section"
import {
  MarketingContainer,
  MARKETING_SECTION,
  MARKETING_SECTION_TITLE,
} from "@/components/marketing/marketing-container"
import { DESTINATIONS, getDestination } from "@/lib/destinations"
import { HashLink } from "@/components/marketing/hash-link"

type PageProps = {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return DESTINATIONS.map((d) => ({ slug: d.id }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
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

  const reviewKeyword = destination.reviewKeywords[0] ?? destination.name

  return (
    <>
      <section className="relative min-h-[42vh] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={destination.image}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-panel/90 via-brand-panel/40 to-brand-panel/20" />
        <MarketingContainer className="relative z-10 flex min-h-[42vh] flex-col justify-end py-12 text-white">
          <p className="text-xs font-extrabold tracking-widest text-brand-accent uppercase">
            {destination.region}
          </p>
          <h1 className="mt-2 font-brand text-4xl font-extrabold tracking-tight sm:text-5xl">
            {destination.name}
          </h1>
          <p className="mt-3 max-w-xl text-base text-white/85">
            {destination.description}
          </p>
          <HashLink
            href="/#book"
            className="mt-6 inline-flex h-11 w-fit items-center justify-center rounded-full bg-primary px-5 text-sm font-extrabold text-primary-foreground"
          >
            Book a transfer · from {destination.priceFrom}
          </HashLink>
        </MarketingContainer>
      </section>

      <TestimonialsSection destination={reviewKeyword} />

      <section className={MARKETING_SECTION}>
        <MarketingContainer>
          <h2 className={MARKETING_SECTION_TITLE}>More destinations</h2>
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
