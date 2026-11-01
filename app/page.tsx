import type { Metadata } from "next"

import { JsonLd } from "@/components/marketing/json-ld"
import { HomeLanding } from "@/components/marketing/home-landing"
import { SiteFooter } from "@/components/marketing/site-footer"
import { getRequestLocale } from "@/lib/i18n/get-locale"
import { canonicalOnly, localizedAlternates } from "@/lib/i18n/locales"
import {
  pageMetadataFields,
  resolveDestinationCards,
  resolveHomeMarketingCopy,
  resolvePageContent,
} from "@/lib/page-content"
import { getSettings } from "@/lib/settings"
import { homeSearchCopy, searchTitle } from "@/lib/seo/search-meta"
import {
  buildFaqPageJsonLd,
  buildLocalBusinessJsonLd,
} from "@/lib/structured-data"

/** Always read live CMS content (destination cards, homepage copy). */
export const dynamic = "force-dynamic"

type PageProps = {
  searchParams: Promise<{ destination?: string }>
}

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const locale = await getRequestLocale()
  const { destination } = await searchParams
  const hasDestinationPrefill = Boolean(destination?.trim())
  const page = await resolvePageContent("home", locale)

  const home = homeSearchCopy(locale)
  const title = searchTitle(home.heading)
  const base: Metadata = page
    ? pageMetadataFields(page)
    : {
        title,
        description: home.description,
        alternates: localizedAlternates("/", locale),
      }

  // Booking deep-links (?destination=ksamil) share homepage content.
  // Canonical stays the clean homepage. Hreflang is omitted so the query URL
  // is not announced as its own language version.
  return {
    ...base,
    title,
    description: home.description,
    openGraph: {
      ...base.openGraph,
      title: title.absolute,
      description: home.description,
    },
    twitter: {
      ...base.twitter,
      title: title.absolute,
      description: home.description,
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
  const [page, destinations, settings] = await Promise.all([
    resolvePageContent("home", locale),
    resolveDestinationCards(locale, { featuredOnly: true }),
    getSettings().catch(() => null),
  ])
  const copy = await resolveHomeMarketingCopy(
    page?.sections ?? [],
    page?.ogImage,
  )

  const localBusinessJsonLd = buildLocalBusinessJsonLd({
    name: settings?.companyName || "Albania Transfers",
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
      />
    </>
  )
}
