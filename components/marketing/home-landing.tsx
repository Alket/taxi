"use client"

import { Suspense, useEffect } from "react"

import { DestinationsSection } from "@/components/marketing/destinations-section"
import { HeroBookingCard } from "@/components/marketing/hero-booking-card"
import { MarketingContainer } from "@/components/marketing/marketing-container"
import { PeaceOfMindSection } from "@/components/marketing/peace-of-mind-section"
import { SafetyPrioritySection } from "@/components/marketing/safety-priority-section"
import { SiteFooter } from "@/components/marketing/site-footer"
import { SiteHeader } from "@/components/marketing/site-header"
import { TestimonialsSection } from "@/components/marketing/testimonials-section"
import { WhyBookSection } from "@/components/marketing/why-book-section"
import { Skeleton } from "@/components/ui/skeleton"
import { scrollToHashId } from "@/lib/smooth-hash-scroll"

function HeroBookingFallback() {
  return (
    <div className="rounded-2xl bg-brand-surface p-6 shadow-xl">
      <Skeleton className="h-80 w-full" />
    </div>
  )
}

export function HomeLanding() {
  useEffect(() => {
    const id = window.location.hash.replace(/^#/, "")
    if (!id) return
    // Wait a frame so sticky header / section layout settle before scrolling
    const frame = window.requestAnimationFrame(() => {
      scrollToHashId(id, { updateUrl: false })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

  return (
    <div className="brand-frontend min-h-svh bg-white font-brand text-brand antialiased">
      <style>{`
        @keyframes home-fade-up {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes home-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .home-fade-up {
          animation: home-fade-up 0.75s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .home-fade-up-delay {
          animation: home-fade-up 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.1s both;
        }
        .home-card-enter {
          animation: home-fade-up 0.85s cubic-bezier(0.22, 1, 0.36, 1) 0.15s both;
        }
        .home-hero-bg {
          animation: home-fade-in 1.2s ease both;
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

      <section className="relative isolate -mt-24 md:h-[100vh]">
        {/* Hero image: ~58svh on mobile, full section on desktop */}
        <div className="home-hero-bg relative h-[58svh] md:absolute md:inset-0 md:h-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://www.welcomepickups.com/wp-content/themes/welcomepickups_new/images/conversion-v2/hero_photo_desktop_2.jpg"
            alt=""
            className="h-full w-full object-cover object-[72%_center] md:object-[80%_center]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,18,22,0.55)_0%,rgba(8,18,22,0.35)_45%,rgba(8,18,22,0.55)_100%)] md:bg-[linear-gradient(105deg,rgba(8,18,22,0.78)_0%,rgba(8,18,22,0.55)_42%,rgba(8,18,22,0.28)_100%)]" />

          {/* Mobile title on the image */}
          <div className="absolute inset-0 z-10 flex flex-col justify-center px-5 pt-24 md:hidden">
            <div className="home-fade-up text-white">
              <h1 className="text-[2.35rem] font-extrabold leading-[1.05] tracking-tight text-balance">
                Arrive. Discover.
                <br />
                Experience.
              </h1>
              <p className="home-fade-up-delay mt-3 max-w-sm text-[15px] leading-snug text-white/90">
                Personalised airport transfers designed for travel across Albania.
              </p>
            </div>
          </div>
        </div>

        {/* Content: overlapping form on mobile; side-by-side on desktop */}
        <MarketingContainer className="relative z-20 -mt-16 pb-8 md:mt-0 md:flex md:h-full md:items-center md:pb-8 md:pt-28">
          <div className="grid w-full gap-0 md:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)] md:items-center md:gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(22rem,26rem)]">
            <div className="home-fade-up hidden max-w-xl text-white md:block">
              <h1 className="text-[clamp(2.6rem,7vw,4.25rem)] font-bold leading-[1.05] tracking-tight text-balance">
                Arrive. Discover.
                <br />
                Experience.
              </h1>
              <p className="home-fade-up-delay mt-4 max-w-md text-base leading-relaxed text-white/85 md:text-lg">
                Personalised airport transfers designed for travel across Albania.
              </p>
            </div>

            <div
              id="book"
              className="home-card-enter w-full max-w-none justify-self-stretch md:max-w-none md:justify-self-end"
            >
              <Suspense fallback={<HeroBookingFallback />}>
                <HeroBookingCard />
              </Suspense>
            </div>
          </div>
        </MarketingContainer>
      </section>

      <WhyBookSection />

      <DestinationsSection />

      <TestimonialsSection />

      <PeaceOfMindSection />

      <SafetyPrioritySection />

      <SiteFooter />
    </div>
  )
}
