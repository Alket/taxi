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

import "swiper/css"

export function DestinationsSection({
  heading,
  text,
  destinations = DESTINATIONS,
}: {
  heading: string
  text: string
  destinations?: Destination[]
}) {
  const swiperRef = useRef<SwiperType | null>(null)

  return (
    <section
      id="destinations"
      className="overflow-hidden bg-white py-10 md:py-0"
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
              href="/destinations"
              className="hidden items-center gap-2 text-sm font-extrabold text-primary transition-colors hover:text-primary/80 md:inline-flex"
            >
              View all
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
            href="/destinations"
            className="inline-flex items-center gap-2 text-sm font-extrabold text-primary"
          >
            View all destinations
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </MarketingContainer>
    </section>
  )
}
