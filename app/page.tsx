import type { Metadata } from "next"

import { HomeLanding } from "@/components/marketing/home-landing"
import { SiteFooter } from "@/components/marketing/site-footer"
import { getRequestLocale } from "@/lib/i18n/get-locale"
import {
  pageMetadataFields,
  resolveDestinationCards,
  resolveHomeMarketingCopy,
  resolvePageContent,
} from "@/lib/page-content"

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
    }
  }
  return pageMetadataFields(page)
}

export default async function HomePage() {
  const locale = await getRequestLocale()
  const [page, destinations] = await Promise.all([
    resolvePageContent("home", locale),
    resolveDestinationCards(locale, { featuredOnly: true }),
  ])
  const copy = await resolveHomeMarketingCopy(page?.sections ?? [])
  return (
    <HomeLanding
      copy={copy}
      destinations={destinations}
      footer={<SiteFooter />}
    />
  )
}
