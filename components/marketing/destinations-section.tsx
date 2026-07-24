"use client"

import { useRef } from "react"
import Link from "next/link"
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react"
import { Navigation, Pagination } from "swiper/modules"
import { Swiper, SwiperSlide } from "swiper/react"
import type { Swiper as SwiperType } from "swiper"

import {
  MarketingContainer,
  MARKETING_SECTION,
  MARKETING_SECTION_TITLE,
} from "@/components/marketing/marketing-container"
import { DESTINATIONS, type Destination } from "@/lib/destinations"
import { cn } from "@/lib/utils"

import "swiper/css"
import "swiper/css/navigation"
import "swiper/css/pagination"

function DestinationCard({ destination }: { destination: Destination }) {
  return (
    <Link
      href={`/destinations/${destination.id}`}
      className="group relative flex h-[420px] flex-col overflow-hidden rounded-3xl border border-border bg-muted shadow-sm transition-all duration-300 hover:shadow-xl"
    >
      <div className="absolute inset-0 bg-muted transition-transform duration-500 group-hover:scale-105">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={destination.image}
          alt={destination.name}
          className="size-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-panel/85 via-brand-panel/20 to-transparent" />
      </div>

      <div className="relative z-10 flex items-start justify-between p-6">
        <span className="rounded-full bg-card/90 px-3 py-1 text-xs font-extrabold text-brand backdrop-blur-md">
          {destination.badge}
        </span>
        <span className="rounded-full bg-primary px-3 py-1 text-xs font-extrabold text-primary-foreground">
          From {destination.priceFrom}
        </span>
      </div>

      <div className="relative z-10 mt-auto p-6 text-white">
        <p className="mb-1 text-xs font-extrabold tracking-wider text-brand-accent uppercase">
          {destination.region}
        </p>
        <h3 className="mb-2 text-2xl font-extrabold">{destination.name}</h3>
        <p className="line-clamp-2 text-sm text-white/85">
          {destination.description}
        </p>
      </div>
    </Link>
  )
}

export function DestinationsSection() {
  const swiperRef = useRef<SwiperType | null>(null)

  return (
    <section id="destinations" className={cn(MARKETING_SECTION, "overflow-hidden")}>
      <MarketingContainer>
        <div className="mb-12 flex flex-col justify-between md:flex-row md:items-end">
          <div>
            <h2 className={MARKETING_SECTION_TITLE}>
              Featured Destinations
            </h2>
            <p className="mt-2 max-w-xl text-base text-muted-foreground sm:text-lg">
              Discover our most popular hand-picked locations for your next
              unforgettable journey.
            </p>
          </div>

          <div className="mt-6 flex items-center gap-6 md:mt-0">
            <a
              href="#book"
              className="hidden items-center gap-2 text-sm font-extrabold text-primary transition-colors hover:text-primary/80 md:inline-flex"
            >
              View all
              <ArrowRight className="size-4" />
            </a>
            <div className="flex gap-2">
              <button
                type="button"
                aria-label="Previous destinations"
                className="flex size-10 items-center justify-center rounded-full border border-border bg-card text-brand transition-colors hover:bg-muted"
                onClick={() => swiperRef.current?.slidePrev()}
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                aria-label="Next destinations"
                className="flex size-10 items-center justify-center rounded-full border border-border bg-card text-brand transition-colors hover:bg-muted"
                onClick={() => swiperRef.current?.slideNext()}
              >
                <ChevronRight className="size-5" />
              </button>
            </div>
          </div>
        </div>

        <Swiper
          modules={[Navigation, Pagination]}
          spaceBetween={20}
          slidesPerView={1.15}
          breakpoints={{
            640: { slidesPerView: 1.5 },
            768: { slidesPerView: 2.2 },
            1024: { slidesPerView: 3 },
          }}
          onSwiper={(swiper) => {
            swiperRef.current = swiper
          }}
          className="!overflow-visible"
        >
          {DESTINATIONS.map((destination) => (
            <SwiperSlide key={destination.id}>
              <DestinationCard destination={destination} />
            </SwiperSlide>
          ))}
        </Swiper>
      </MarketingContainer>
    </section>
  )
}
