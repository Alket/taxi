import type { Metadata } from "next"
import Link from "next/link"

import { FaqSection } from "@/components/marketing/faq-section"
import { MarketingContainer } from "@/components/marketing/marketing-container"
import {
  faqSections,
  pageMetadataFields,
  resolvePageContent,
  sectionHeading,
  sectionValue,
} from "@/lib/page-content"

export async function generateMetadata(): Promise<Metadata> {
  const page = await resolvePageContent("cancellation-policy")
  if (!page) return { title: "Cancellation Policy" }
  return pageMetadataFields(page)
}

export default async function CancellationPolicyPage() {
  const page = await resolvePageContent("cancellation-policy")
  const sections = page?.sections ?? []

  const eyebrow = sectionValue(sections, "eyebrow") || "Booking terms"
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

  const faqs = faqSections(sections)

  return (
    <>
      <MarketingContainer className="py-12 sm:py-16">
        <article className="mx-auto max-w-2xl">
          <p className="text-xs font-extrabold tracking-widest text-primary uppercase">
            {eyebrow}
          </p>
          <h1 className="mt-2 font-brand text-3xl font-extrabold tracking-tight text-brand sm:text-4xl">
            {title}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            {intro}
          </p>

          <div className="mt-10 flex flex-col gap-8 text-sm leading-relaxed text-brand sm:text-[0.95rem]">
            {blocks.map((block) => (
              <section key={block.key} className="flex flex-col gap-2">
                <h2 className="text-lg font-extrabold">{block.heading}</h2>
                {block.text ? (
                  <p className="whitespace-pre-line text-muted-foreground">
                    {block.text}
                  </p>
                ) : null}
              </section>
            ))}
          </div>

          <p className="mt-12 text-xs text-muted-foreground">
            <Link
              href="/"
              className="underline underline-offset-2 hover:text-brand"
            >
              ← Back to home
            </Link>
          </p>
        </article>
      </MarketingContainer>

      {faqs.length > 0 ? (
        <FaqSection items={faqs} heading="Cancellation FAQs" />
      ) : null}
    </>
  )
}
