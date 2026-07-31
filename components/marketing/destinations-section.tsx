"use client"

import { useRef } from "react"
import Link from "next/link"
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react"
import { Navigation } from "swiper/modules"
import { Swiper, SwiperSlide } from "swiper/react"
import type { Swiper as SwiperType } from "swiper"

import { DestinationCard } from "@/components/marketing/destination-card"
import {
  MarketingContainer,
  MARKETING_SECTION_TITLE,
} from "@/components/marketing/marketing-container"
import { DESTINATIONS, type Destination } from "@/lib/destinations"
import { useLocale } from "@/lib/i18n/use-locale"
import { localePath } from "@/lib/i18n/locales"
import { t } from "@/lib/i18n/t"
import { cn } from "@/lib/utils"

import "swiper/css"

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
  const swiperRef = useRef<SwiperType | null>(null)
  const locale = useLocale()
  const destinationsHref = localePath("/destinations", locale)

  return (
    <section
      id="destinations"
      className={cn("overflow-hidden bg-white py-10 md:py-0", className)}
    >
      <MarketingContainer>
        <div className="mb-8 flex items-end justify-between gap-4 md:mb-12">
          <div className="min-w-0 flex-1">
            <h2 className={MARKETING_SECTION_TITLE}>{heading}</h2>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground md:mt-2 md:text-lg">
              {text}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2 md:gap-6">
            <Link
              href={destinationsHref}
              className="hidden items-center gap-2 text-sm font-extrabold text-primary transition-colors hover:text-primary/80 md:inline-flex"
            >
              {t(locale, "cta.viewAll")}
              <ArrowRight className="size-4" />
            </Link>
            <div className="flex gap-1.5 sm:gap-2">
              <button
                type="button"
                aria-label="Previous destinations"
                className="flex size-9 items-center justify-center rounded-full border border-border bg-card text-brand transition-colors hover:bg-muted sm:size-10"
                onClick={() => swiperRef.current?.slidePrev()}
              >
                <ChevronLeft className="size-4 sm:size-5" />
              </button>
              <button
                type="button"
                aria-label="Next destinations"
                className="flex size-9 items-center justify-center rounded-full border border-border bg-card text-brand transition-colors hover:bg-muted sm:size-10"
                onClick={() => swiperRef.current?.slideNext()}
              >
                <ChevronRight className="size-4 sm:size-5" />
              </button>
            </div>
          </div>
        </div>

        <Swiper
          modules={[Navigation]}
          speed={550}
          spaceBetween={16}
          slidesPerView={1.12}
          resistanceRatio={0.65}
          watchOverflow
          preventInteractionOnTransition
          grabCursor
          breakpoints={{
            480: { slidesPerView: 1.25, spaceBetween: 16 },
            640: { slidesPerView: 1.5, spaceBetween: 18 },
            768: { slidesPerView: 2.15, spaceBetween: 20 },
            1024: { slidesPerView: 3, spaceBetween: 20 },
          }}
          onSwiper={(swiper) => {
            swiperRef.current = swiper
          }}
        >
          {destinations.map((destination) => (
            <SwiperSlide key={destination.id}>
              <DestinationCard destination={destination} />
            </SwiperSlide>
          ))}
        </Swiper>

        <div className="mt-6 md:hidden">
          <Link
            href={destinationsHref}
            className="inline-flex items-center gap-2 text-sm font-extrabold text-primary"
          >
            {t(locale, "cta.viewAllDestinations")}
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </MarketingContainer>
    </section>
  )
}
