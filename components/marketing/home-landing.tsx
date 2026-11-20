"use client"

import { Suspense, useEffect, type ReactNode } from "react"
import Image from "next/image"

import { ComparisonSection } from "@/components/marketing/comparison-section"
import { CookieConsentBanner } from "@/components/marketing/cookie-consent-banner"
import { DestinationsSection } from "@/components/marketing/destinations-section"
import { FaqSection } from "@/components/marketing/faq-section"
import { HeroBookingCard } from "@/components/marketing/hero-booking-card"
import { MarketingContainer } from "@/components/marketing/marketing-container"
import { TrustpilotReviewCollector } from "@/components/marketing/trustpilot-review-collector"
import { MarketingPageEnter } from "@/components/marketing/marketing-page-enter"
import { MarketingPreloader } from "@/components/marketing/marketing-preloader"
import { PeaceOfMindSection } from "@/components/marketing/peace-of-mind-section"
import { SiteHeader } from "@/components/marketing/site-header"
import { TestimonialsSection } from "@/components/marketing/testimonials-section"
import { UberAltSection } from "@/components/marketing/uber-alt-section"
import { Skeleton } from "@/components/ui/skeleton"
import type { Destination } from "@/lib/destinations"
import type { HomeMarketingCopy } from "@/lib/page-content-shared"
import { scrollToHashId } from "@/lib/smooth-hash-scroll"

function HeroBookingFallback() {
  return (
    <div className="rounded-2xl bg-brand-surface p-6 shadow-xl">
      <div className="space-y-4">
        <Skeleton className="h-11 w-full rounded-full" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
        <Skeleton className="h-12 w-full rounded-xl bg-brand-accent/20" />
      </div>
    </div>
  )
}

function headingLines(text: string) {
  return text.split("\n").map((line, i, arr) => (
    <span key={`${line}-${i}`}>
      {line}
      {i < arr.length - 1 ? <br /> : null}
    </span>
  ))
}

export function HomeLanding({
  copy,
  destinations,
  footer,
  showCustomerReviews = true,
  showTrustpilotTestimonials = false,
}: {
  copy: HomeMarketingCopy
  destinations: Destination[]
  footer?: ReactNode
  showCustomerReviews?: boolean
  showTrustpilotTestimonials?: boolean
}) {
  useEffect(() => {
    const id = window.location.hash.replace(/^#/, "")
    if (!id) return
    const frame = window.requestAnimationFrame(() => {
      scrollToHashId(id, { updateUrl: false })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

  return (
    <div className="brand-frontend min-h-svh bg-white font-brand text-brand antialiased">
      <MarketingPreloader scope="home" />
      <style>{`
        @keyframes home-fade-up {
          from { opacity: 0.01; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .home-fade-up {
          animation: home-fade-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .home-fade-up-delay {
          animation: home-fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.05s both;
        }
        .home-card-enter {
          animation: home-fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.08s both;
        }
        @media (prefers-reduced-motion: reduce) {
          .home-fade-up,
          .home-fade-up-delay,
          .home-card-enter,
          .home-hero-bg {
            animation: none;
          }
        }
      `}</style>

      <SiteHeader />

      <MarketingPageEnter>
        <section className="relative isolate z-20 -mt-24 md:flex md:min-h-[calc(100svh+6rem)] md:flex-col md:justify-center">
          {/*
            Single real <h1> for the whole page, kept visually hidden: the two
            blocks below render the same heading text but only one is ever
            visible per breakpoint (mobile overlay vs. desktop grid column),
            so they use non-heading tags to avoid duplicate <h1> elements.
          */}
          <h1 className="sr-only">{copy.hero.heading.replace(/\n/g, " ")}</h1>

          {/* Mobile: shorter image + overlapping form. Desktop: full-viewport hero (6rem offsets -mt-24). */}
          <div className="home-hero-bg relative h-[65svh] min-h-[22rem] sm:h-[70svh] md:absolute md:inset-0 md:h-auto md:min-h-0">
            <Image
              src={copy.hero.image}
              alt={copy.hero.imageAlt || "Albania private airport transfer"}
              fill
              priority
              fetchPriority="high"
              sizes="100vw"
              className="object-cover object-[72%_center] md:object-[80%_center]"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,18,22,0.62)_0%,rgba(8,18,22,0.38)_45%,rgba(8,18,22,0.75)_100%)] md:bg-[linear-gradient(105deg,rgba(8,18,22,0.8)_0%,rgba(8,18,22,0.58)_45%,rgba(8,18,22,0.25)_100%)]" />

            <div className="absolute inset-0 z-10 flex flex-col justify-center px-5 pt-[calc(80px+2.5rem)] pb-12 sm:px-6 md:hidden">
              <div className="home-fade-up flex w-full flex-col items-start text-white">
                <p
                  aria-hidden
                  className="font-brand text-[1.85rem] font-extrabold leading-[1.1] tracking-tight text-balance sm:text-3xl"
                >
                  {headingLines(copy.hero.heading)}
                </p>
                <p className="home-fade-up-delay mt-3 max-w-sm text-sm leading-relaxed text-white/90 sm:text-base">
                  {copy.hero.text}
                </p>
                {copy.hero.showTrustpilot ? (
                  <TrustpilotReviewCollector className="home-fade-up-delay mt-4 -ml-4 w-fit max-w-full" />
                ) : null}
              </div>
            </div>
          </div>

          <MarketingContainer className="relative z-20 -mt-6 pb-8 md:mt-0 md:flex md:flex-1 md:items-center md:pb-12 md:pt-32 lg:pt-36">
            <div className="grid w-full gap-0 md:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)] md:items-center md:gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,26rem)] lg:gap-14">
              <div className="home-fade-up hidden max-w-3xl text-white md:block">
                <p
                  aria-hidden
                  className="font-brand text-[clamp(2.5rem,5.5vw,4.25rem)] font-extrabold leading-[1.06] tracking-tight text-white text-balance"
                >
                  {headingLines(copy.hero.heading)}
                </p>
                <p className="home-fade-up-delay mt-4 max-w-xl text-base leading-relaxed text-white/90 md:text-lg">
                  {copy.hero.text}
                </p>
                {copy.hero.showTrustpilot ? (
                  <TrustpilotReviewCollector className="home-fade-up-delay mt-8 -ml-4 w-fit max-w-full" />
                ) : null}
              </div>

              <div
                id="book"
                className="home-card-enter w-full max-w-none scroll-mt-28 justify-self-stretch md:max-w-none md:justify-self-end"
              >
                <Suspense fallback={<HeroBookingFallback />}>
                  <HeroBookingCard />
                </Suspense>
              </div>
            </div>
          </MarketingContainer>
        </section>

        <UberAltSection copy={copy.uberAlt} />

        <DestinationsSection
          heading={copy.destinations.heading}
          text={copy.destinations.text}
          destinations={destinations}
        />

        <ComparisonSection copy={copy.compare} />

        <PeaceOfMindSection copy={copy.peace} />

        {showCustomerReviews || showTrustpilotTestimonials ? (
          <TestimonialsSection
            eyebrow={copy.testimonials.eyebrow}
            heading={copy.testimonials.heading}
            showCustomerReviews={showCustomerReviews}
            showTrustpilotTestimonials={showTrustpilotTestimonials}
          />
        ) : null}

        <FaqSection items={copy.faq} />
      </MarketingPageEnter>

      {footer}
      <CookieConsentBanner />
    </div>
  )
}
