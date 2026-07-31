import type { Metadata } from "next"

import { CancellationPolicyView } from "@/components/marketing/cancellation-policy-view"
import { DESTINATIONS } from "@/lib/destinations"
import { getRequestLocale } from "@/lib/i18n/get-locale"
import {
  pageMetadataFields,
  resolvePageContent,
  sectionHeading,
  sectionValue,
} from "@/lib/page-content"

export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale()
  const page = await resolvePageContent("cancellation-policy", locale)
  if (!page) return { title: "Cancellation Policy" }
  return pageMetadataFields(page)
}

export default async function CancellationPolicyPage() {
  const locale = await getRequestLocale()
  const page = await resolvePageContent("cancellation-policy", locale)
  const sections = page?.sections ?? []

  const title = sectionHeading(sections, "title") || "Cancellation Policy"
  const intro =
    sectionValue(sections, "intro") ||
    "Clear rules so you know exactly what happens if a booking is cancelled."

  const blocks = [
    {
      key: "customer",
      heading:
        sectionHeading(sections, "customer.heading") || "Customer cancellations",
      text: sectionValue(sections, "customer.text"),
    },
    {
      key: "refund",
      heading:
        sectionHeading(sections, "refund.heading") ||
        "When a full refund applies",
      text: sectionValue(sections, "refund.text"),
    },
    {
      key: "how",
      heading: sectionHeading(sections, "how.heading") || "How to cancel",
      text: sectionValue(sections, "how.text"),
    },
  ].filter((b) => b.heading || b.text)

  const heroImage =
    page?.ogImage ||
    DESTINATIONS.find((d) => d.id === "tirana")?.image ||
    DESTINATIONS[0]?.image ||
    ""

  return (
    <CancellationPolicyView
      title={title}
      intro={intro}
      blocks={blocks}
      heroImage={heroImage}
      locale={locale}
    />
  )
}
