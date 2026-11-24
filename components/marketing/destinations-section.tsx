"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react"
import type { EmblaCarouselType } from "embla-carousel"

import { DestinationCard } from "@/components/marketing/destination-card"
import {
  MarketingCarousel,
  MARKETING_CAROUSEL_SLIDE,
  useMarketingCarousel,
} from "@/components/marketing/marketing-carousel"
import {
  MarketingContainer,
  MARKETING_SECTION_TITLE,
} from "@/components/marketing/marketing-container"
import { DESTINATIONS, type Destination } from "@/lib/destinations"
import { useLocale } from "@/lib/i18n/use-locale"
import { localePath } from "@/lib/i18n/locales"
import { t } from "@/lib/i18n/t"
import { cn } from "@/lib/utils"

export function DestinationsSection({
  heading,
  text,
  destinations = DESTINATIONS,
  className,
}: {
  heading: string
  text: string
  destinations?: Destination[]
  className?: string
}) {
  const {
    emblaRef,
    emblaApi,
    scrollPrev,
    scrollNext,
    canScrollPrev,
    canScrollNext,
  } = useMarketingCarousel()
  const locale = useLocale()
  const destinationsHref = localePath("/destinations", locale)

  const [selectedIndex, setSelectedIndex] = useState(0)
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([])

  const onSelect = useCallback((api: EmblaCarouselType) => {
    setSelectedIndex(api.selectedScrollSnap())
  }, [])

  const onInit = useCallback((api: EmblaCarouselType) => {
    setScrollSnaps(api.scrollSnapList())
    setSelectedIndex(api.selectedScrollSnap())
  }, [])

  useEffect(() => {
    if (!emblaApi) return
    onInit(emblaApi)
    emblaApi.on("reInit", onInit)
    emblaApi.on("select", onSelect)
    return () => {
      emblaApi.off("reInit", onInit)
      emblaApi.off("select", onSelect)
    }
  }, [emblaApi, onInit, onSelect])

  return (
    <section
      id="destinations"
      className={cn(
        "scroll-mt-24 overflow-x-clip border-b border-border/60 bg-brand-page py-14 font-brand md:py-20 lg:py-24",
        className,
      )}
    >
      <MarketingContainer>
        <div className="mb-8 flex flex-col justify-between gap-6 sm:flex-row sm:items-end md:mb-12">
          <div className="min-w-0 flex-1">
            <h2 className={MARKETING_SECTION_TITLE}>{heading}</h2>
            {text ? (
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-brand/80 dark:text-muted-foreground md:text-lg">
                {text}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end md:gap-4">
            <Link
              href={destinationsHref}
              className="group hidden h-11 items-center gap-2 rounded-full border border-border/80 bg-brand-surface px-5 text-sm font-extrabold text-brand shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-accent/40 hover:bg-brand-accent/5 hover:text-brand-accent active:scale-[0.98] md:inline-flex"
            >
              <span>{t(locale, "cta.viewAll")}</span>
              <ArrowRight
                className="size-4 text-brand-accent transition-transform duration-200 group-hover:translate-x-1"
                aria-hidden
              />
            </Link>

            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Previous destination slides"
                disabled={!canScrollPrev}
                aria-disabled={!canScrollPrev}
                className={cn(
                  "flex size-10 items-center justify-center rounded-full border border-border/80 bg-brand-surface text-brand shadow-2xs transition-all duration-200 sm:size-11",
                  "hover:-translate-y-0.5 hover:border-brand-accent/40 hover:text-brand-accent hover:shadow-xs active:scale-95",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2",
                  "disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0 disabled:hover:border-border/80 disabled:hover:text-brand disabled:hover:shadow-2xs disabled:active:scale-100",
                )}
                onClick={scrollPrev}
              >
                <ChevronLeft className="size-5" aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Next destination slides"
                disabled={!canScrollNext}
                aria-disabled={!canScrollNext}
                className={cn(
                  "flex size-10 items-center justify-center rounded-full border border-border/80 bg-brand-surface text-brand shadow-2xs transition-all duration-200 sm:size-11",
                  "hover:-translate-y-0.5 hover:border-brand-accent/40 hover:text-brand-accent hover:shadow-xs active:scale-95",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2",
                  "disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0 disabled:hover:border-border/80 disabled:hover:text-brand disabled:hover:shadow-2xs disabled:active:scale-100",
                )}
                onClick={scrollNext}
              >
                <ChevronRight className="size-5" aria-hidden />
              </button>
            </div>
          </div>
        </div>

        <MarketingCarousel
          emblaRef={emblaRef}
          viewportClassName="py-4 -my-4 px-1 -mx-1"
        >
          {destinations.map((destination) => (
            <div
              key={destination.id}
              className={cn(
                MARKETING_CAROUSEL_SLIDE,
                "flex h-auto max-[749px]:flex-[0_0_88%]",
              )}
            >
              <DestinationCard destination={destination} />
            </div>
          ))}
        </MarketingCarousel>

        {scrollSnaps.length > 1 ? (
          <div
            className="mt-6 flex items-center justify-center gap-2"
            role="group"
            aria-label="Carousel pagination"
          >
            {scrollSnaps.map((_, idx) => {
              const isActive = idx === selectedIndex
              return (
                <button
                  key={idx}
                  type="button"
                  aria-label={`Go to slide ${idx + 1}`}
                  aria-current={isActive ? "true" : undefined}
                  onClick={() => emblaApi?.scrollTo(idx)}
                  className="group flex py-2 focus-visible:outline-none"
                >
                  <span
                    className={cn(
                      "h-2 rounded-full transition-all duration-300",
                      isActive
                        ? "w-7 bg-brand-accent"
                        : "w-2 bg-border group-hover:bg-brand/40",
                    )}
                  />
                </button>
              )
            })}
          </div>
        ) : null}

        <div className="mt-6 flex justify-center md:hidden">
          <Link
            href={destinationsHref}
            className="group inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-border/80 bg-brand-surface px-6 py-3.5 text-sm font-extrabold text-brand shadow-xs transition-all duration-200 hover:border-brand-accent/40 hover:text-brand-accent active:scale-[0.98]"
          >
            <span>{t(locale, "cta.viewAllDestinations")}</span>
            <ArrowRight
              className="size-4 text-brand-accent transition-transform duration-200 group-hover:translate-x-1"
              aria-hidden
            />
          </Link>
        </div>
      </MarketingContainer>
    </section>
  )
}
