import type { Metadata } from "next"

import { LegalDocumentView } from "@/components/marketing/legal-document-view"
import { DESTINATIONS } from "@/lib/destinations"
import { getRequestLocale } from "@/lib/i18n/get-locale"
import {
  pageMetadataFields,
  resolvePageContent,
  sectionHeading,
  sectionValue,
} from "@/lib/page-content"

export const dynamic = "force-dynamic"

const SLUG = "cookies"

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale()
  const page = await resolvePageContent(SLUG, locale)
  if (!page) return { title: "Cookie Policy" }
  return pageMetadataFields(page)
}

export default async function CookiesPage() {
  const locale = await getRequestLocale()
  const page = await resolvePageContent(SLUG, locale)
  const sections = page?.sections ?? []

  const title = sectionHeading(sections, "title") || "Cookie Policy"
  const intro =
    sectionValue(sections, "intro") ||
    "How we use cookies and similar technologies on this site."

  const blocks = [
    {
      key: "what",
      heading: sectionHeading(sections, "what.heading") || "What are cookies?",
      text: sectionValue(sections, "what.text"),
    },
    {
      key: "how",
      heading: sectionHeading(sections, "how.heading") || "How we use cookies",
      text: sectionValue(sections, "how.text"),
    },
    {
      key: "manage",
      heading: sectionHeading(sections, "manage.heading") || "Managing cookies",
      text: sectionValue(sections, "manage.text"),
    },
    {
      key: "third",
      heading:
        sectionHeading(sections, "third.heading") || "Third-party cookies",
      text: sectionValue(sections, "third.text"),
    },
  ].filter((b) => b.heading || b.text)

  const heroImage =
    page?.ogImage ||
    DESTINATIONS.find((d) => d.id === "tirana")?.image ||
    DESTINATIONS[0]?.image ||
    ""

  return (
    <LegalDocumentView
      title={title}
      intro={intro}
      blocks={blocks}
      heroImage={heroImage}
      locale={locale}
    />
  )
}
