import { cache } from "react"
import type { Metadata } from "next"

import { JsonLd } from "@/components/marketing/json-ld"
import { HomeLanding } from "@/components/marketing/home-landing"
import { SiteFooter } from "@/components/marketing/site-footer"
import { getRequestLocale } from "@/lib/i18n/get-locale"
import { OG_LOCALE, canonicalOnly, localizedAlternates } from "@/lib/i18n/locales"
import {
  pageMetadataFields,
  resolveDestinationCards,
  resolveHomeMarketingCopy,
  resolvePageContent,
} from "@/lib/page-content"
import { listPublicReviews } from "@/lib/reviews"
import { getSettings } from "@/lib/settings"
import { homeSearchCopy, searchTitle } from "@/lib/seo/search-meta"
import {
  buildFaqPageJsonLd,
  buildLocalBusinessJsonLd,
} from "@/lib/structured-data"

/** Always read live CMS content (destination cards, homepage copy). */
export const dynamic = "force-dynamic"

const loadHomeContent = cache((locale: string) =>
  resolvePageContent("home", locale),
)

type PageProps = {
  searchParams: Promise<{ destination?: string }>
}

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const locale = await getRequestLocale()
  const { destination } = await searchParams
  const hasDestinationPrefill = Boolean(destination?.trim())
  const page = await loadHomeContent(locale)

  // Admin Pages → home → SEO Title/Description per language is the source of
  // truth. Code copy is only used when those fields are empty.
  const fallback = homeSearchCopy(locale)
  const description =
    page?.description?.trim() || fallback.description
  const title = searchTitle(page?.title?.trim() || fallback.heading)
  const base: Metadata = page
    ? pageMetadataFields(page)
    : {
        title,
        description,
        alternates: localizedAlternates("/", locale),
      }

  // Booking deep-links (?destination=ksamil) share homepage content.
  // Canonical stays the clean homepage. Hreflang is omitted so the query URL
  // is not announced as its own language version.
  return {
    ...base,
    title,
    description,
    openGraph: {
      ...base.openGraph,
      title: title.absolute,
      description,
      locale: OG_LOCALE[locale],
    },
    twitter: {
      ...base.twitter,
      title: title.absolute,
      description,
    },
    // Same page as the clean homepage. rel=canonical consolidates it;
    // noindex would drop the signals instead of passing them on.
    alternates: hasDestinationPrefill
      ? canonicalOnly("/", locale)
      : localizedAlternates("/", locale),
  }
}

export default async function HomePage() {
  const locale = await getRequestLocale()
  const [page, destinations, settings, initialReviews] = await Promise.all([
    loadHomeContent(locale),
    resolveDestinationCards(locale, { featuredOnly: true }),
    getSettings().catch(() => null),
    listPublicReviews({ limit: 6 }).catch(() => []),
  ])
  const copy = await resolveHomeMarketingCopy(
    page?.sections ?? [],
    page?.ogImage,
  )

  const localBusinessJsonLd = buildLocalBusinessJsonLd({
    name: settings?.companyName || "Landed Albania",
    description: page?.description,
    telephone: settings?.supportPhone || undefined,
    email: settings?.supportEmail || undefined,
    image: copy.hero.image || undefined,
  })
  const faqJsonLd = buildFaqPageJsonLd(
    copy.faq
      .filter((item) => item.question && item.answer)
      .map((item) => ({ question: item.question!, answer: item.answer! })),
  )

  return (
    <>
      <JsonLd data={localBusinessJsonLd} />
      {faqJsonLd ? <JsonLd data={faqJsonLd} /> : null}
      <HomeLanding
        copy={copy}
        destinations={destinations}
        footer={<SiteFooter />}
        showCustomerReviews={settings?.customerReviewsVisibleOnSite ?? true}
        showTrustpilotTestimonials={
          settings?.trustpilotTestimonialsVisibleOnSite ?? false
        }
        initialReviews={initialReviews}
      />
    </>
  )
}
