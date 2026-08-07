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

// CMS content rarely changes; ISR + on-demand revalidation (admin save →
// revalidatePath) keeps this fast without re-querying the DB on every hit.
export const revalidate = 3600

const SLUG = "privacy-policy"

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale()
  const page = await resolvePageContent(SLUG, locale)
  if (!page) return { title: "Privacy Policy" }
  return pageMetadataFields(page)
}

export default async function PrivacyPolicyPage() {
  const locale = await getRequestLocale()
  const page = await resolvePageContent(SLUG, locale)
  const sections = page?.sections ?? []

  const title = sectionHeading(sections, "title") || "Privacy Policy"
  const intro =
    sectionValue(sections, "intro") ||
    "How we collect, use, and protect your personal information."

  const blocks = [
    {
      key: "collect",
      heading: sectionHeading(sections, "collect.heading") || "What we collect",
      text: sectionValue(sections, "collect.text"),
    },
    {
      key: "use",
      heading: sectionHeading(sections, "use.heading") || "How we use your data",
      text: sectionValue(sections, "use.text"),
    },
    {
      key: "sharing",
      heading: sectionHeading(sections, "sharing.heading") || "Sharing",
      text: sectionValue(sections, "sharing.text"),
    },
    {
      key: "rights",
      heading: sectionHeading(sections, "rights.heading") || "Your rights",
      text: sectionValue(sections, "rights.text"),
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
