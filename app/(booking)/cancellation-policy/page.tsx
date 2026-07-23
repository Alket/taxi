import type { Metadata } from "next"
import Link from "next/link"

import { MarketingContainer } from "@/components/marketing/marketing-container"

export const metadata: Metadata = {
  title: "Cancellation Policy",
  description:
    "Customer cancellations forfeit the deposit. No free-cancellation window. Full refund only if the driver fails to show or the service is not delivered.",
}

export default function CancellationPolicyPage() {
  return (
    <MarketingContainer className="py-12 sm:py-16">
      <article className="mx-auto max-w-2xl">
        <p className="text-xs font-extrabold tracking-widest text-primary uppercase">
          Booking terms
        </p>
        <h1 className="mt-2 font-brand text-3xl font-extrabold tracking-tight text-brand sm:text-4xl">
          Cancellation Policy
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
          Clear rules so you know exactly what happens if a booking is cancelled.
        </p>

        <div className="mt-10 flex flex-col gap-8 text-sm leading-relaxed text-brand sm:text-[0.95rem]">
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-extrabold">Customer cancellations</h2>
            <p className="text-muted-foreground">
              There is no free-cancellation window. If you cancel a booking for
              any reason:
            </p>
            <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
              <li>
                The deposit paid (typically 30% of the trip total) is{" "}
                <strong className="font-semibold text-brand">forfeited</strong>{" "}
                — no refund is issued.
              </li>
              <li>
                The remaining balance (typically 70%) is{" "}
                <strong className="font-semibold text-brand">
                  never charged
                </strong>
                .
              </li>
              <li>Cancellation cannot be undone once confirmed.</li>
            </ul>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-extrabold">
              When a full refund applies
            </h2>
            <p className="text-muted-foreground">
              If the driver fails to show or the service is not delivered, that
              is not treated as a customer-initiated cancellation. In those
              cases you are entitled to a{" "}
              <strong className="font-semibold text-brand">full refund</strong>{" "}
              of amounts paid. Contact support with your booking reference and
              we will resolve it.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-extrabold">How to cancel</h2>
            <p className="text-muted-foreground">
              Use{" "}
              <Link
                href="/my-booking"
                className="font-medium text-primary underline underline-offset-2"
              >
                My booking
              </Link>{" "}
              with your reference code and email, or contact support. Online
              cancellation is available until the driver has arrived.
            </p>
          </section>
        </div>

        <p className="mt-12 text-xs text-muted-foreground">
          <Link href="/" className="underline underline-offset-2 hover:text-brand">
            ← Back to home
          </Link>
        </p>
      </article>
    </MarketingContainer>
  )
}
