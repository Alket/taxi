"use client"

import { useRef } from "react"
import Link from "next/link"
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react"
import { Navigation } from "swiper/modules"
import { Swiper, SwiperSlide } from "swiper/react"
import type { Swiper as SwiperType } from "swiper"

import {
  MarketingContainer,
  MARKETING_SECTION_TITLE,
} from "@/components/marketing/marketing-container"
import { DESTINATIONS, type Destination } from "@/lib/destinations"

import "swiper/css"

function DestinationCard({ destination }: { destination: Destination }) {
  return (
    <Link
      href={`/destinations/${destination.id}`}
      className="group relative flex h-[400px] flex-col overflow-hidden rounded-2xl border border-border bg-muted shadow-sm transition-shadow duration-300 hover:shadow-xl sm:rounded-3xl md:h-[420px]"
    >
      <div className="absolute inset-0 bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={destination.image}
          alt={destination.name}
          className="size-full object-cover transition-transform duration-500 [@media(hover:hover)]:group-hover:scale-105"
          loading="lazy"
          draggable={false}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-panel/90 via-brand-panel/25 to-transparent" />
      </div>

      <div className="relative z-10 flex items-start justify-between gap-2 p-4 sm:p-6">
        <span className="rounded-full bg-card/90 px-2.5 py-1 text-[11px] font-extrabold text-brand backdrop-blur-md sm:px-3 sm:text-xs">
          {destination.badge}
        </span>
        <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-extrabold text-primary-foreground sm:px-3 sm:text-xs">
          From {destination.priceFrom}
        </span>
      </div>

      <div className="relative z-10 mt-auto p-4 text-white sm:p-6">
        <p className="mb-1 text-[11px] font-extrabold tracking-wider text-brand-accent uppercase sm:text-xs">
          {destination.region}
        </p>
        <h3 className="mb-1.5 text-2xl font-extrabold md:mb-2">
          {destination.name}
        </h3>
        <p className="line-clamp-2 text-sm leading-snug text-white/85">
          {destination.description}
        </p>
      </div>
    </Link>
  )
}

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
            <a
              href="#book"
              className="hidden items-center gap-2 text-sm font-extrabold text-primary transition-colors hover:text-primary/80 md:inline-flex"
            >
              View all
              <ArrowRight className="size-4" />
            </a>
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
      </MarketingContainer>
    </section>
  )
}
