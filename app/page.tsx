import type { Metadata } from "next"

import { HomeLanding } from "@/components/marketing/home-landing"
import {
  homeCopyFromSections,
  pageMetadataFields,
  resolveDestinationCards,
  resolvePageContent,
} from "@/lib/page-content"

/** Always read live CMS content (destination cards, homepage copy). */
export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  const page = await resolvePageContent("home")
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
  const [page, destinations] = await Promise.all([
    resolvePageContent("home"),
    resolveDestinationCards(),
  ])
  const copy = homeCopyFromSections(page?.sections ?? [])
  return <HomeLanding copy={copy} destinations={destinations} />
}
