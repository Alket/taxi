import type { Metadata } from "next"

import { JsonLd } from "@/components/marketing/json-ld"
import { HomeLanding } from "@/components/marketing/home-landing"
import { SiteFooter } from "@/components/marketing/site-footer"
import { getRequestLocale } from "@/lib/i18n/get-locale"
import { localizedAlternates } from "@/lib/i18n/locales"
import {
  pageMetadataFields,
  resolveDestinationCards,
  resolveHomeMarketingCopy,
  resolvePageContent,
} from "@/lib/page-content"
import { getSettings } from "@/lib/settings"
import {
  buildFaqPageJsonLd,
  buildLocalBusinessJsonLd,
} from "@/lib/structured-data"

/** Always read live CMS content (destination cards, homepage copy). */
export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale()
  const page = await resolvePageContent("home", locale)
  if (!page) {
    return {
      title: "Albania Transfers · Airport transfers",
      description:
        "Book reliable airport transfers across Albania. Fixed prices, vetted drivers, clear cancellation terms.",
      alternates: localizedAlternates("/", locale),
    }
  }
  return pageMetadataFields(page)
}

export default async function HomePage() {
  const locale = await getRequestLocale()
  const [page, destinations, settings] = await Promise.all([
    resolvePageContent("home", locale),
    resolveDestinationCards(locale, { featuredOnly: true }),
    getSettings().catch(() => null),
  ])
  const copy = await resolveHomeMarketingCopy(page?.sections ?? [])

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
      />
    </>
  )
}
