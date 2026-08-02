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

const SLUG = "terms"

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale()
  const page = await resolvePageContent(SLUG, locale)
  if (!page) return { title: "Terms & Conditions" }
  return pageMetadataFields(page)
}

export default async function TermsPage() {
  const locale = await getRequestLocale()
  const page = await resolvePageContent(SLUG, locale)
  const sections = page?.sections ?? []

  const title = sectionHeading(sections, "title") || "Terms & Conditions"
  const intro =
    sectionValue(sections, "intro") ||
    "The rules that apply when you book and travel with us."

  const blocks = [
    {
      key: "service",
      heading: sectionHeading(sections, "service.heading") || "Our service",
      text: sectionValue(sections, "service.text"),
    },
    {
      key: "bookings",
      heading: sectionHeading(sections, "bookings.heading") || "Bookings",
      text: sectionValue(sections, "bookings.text"),
    },
    {
      key: "payments",
      heading: sectionHeading(sections, "payments.heading") || "Payments",
      text: sectionValue(sections, "payments.text"),
    },
    {
      key: "liability",
      heading: sectionHeading(sections, "liability.heading") || "Liability",
      text: sectionValue(sections, "liability.text"),
    },
    {
      key: "contact",
      heading: sectionHeading(sections, "contact.heading") || "Contact",
      text: sectionValue(sections, "contact.text"),
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
