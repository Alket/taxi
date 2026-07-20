"use client"

import { useRef } from "react"
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react"
import { Navigation, Pagination } from "swiper/modules"
import { Swiper, SwiperSlide } from "swiper/react"
import type { Swiper as SwiperType } from "swiper"

import {
  MarketingContainer,
  MARKETING_SECTION,
  MARKETING_SECTION_TITLE,
} from "@/components/marketing/marketing-container"
import { cn } from "@/lib/utils"

import "swiper/css"
import "swiper/css/navigation"
import "swiper/css/pagination"

type Destination = {
  id: string
  name: string
  region: string
  description: string
  badge: string
  priceFrom: string
  image: string
}

const DESTINATIONS: Destination[] = [
  {
    id: "tirana",
    name: "Tirana City Escape",
    region: "Central Albania",
    description:
      "Vibrant capital streets, cafés, and quick airport links for city stays.",
    badge: "Popular",
    priceFrom: "€25",
    image:
      "https://images.unsplash.com/photo-1600093463592-8e77ffe2476e?auto=format&fit=crop&q=80&w=800",
  },
  {
    id: "durres",
    name: "Durrës Coast",
    region: "Adriatic Coast",
    description:
      "Historic port city with sandy beaches and Roman ruins minutes from the shore.",
    badge: "Trending",
    priceFrom: "€30",
    image:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800",
  },
  {
    id: "vlore",
    name: "Vlorë Riviera",
    region: "Albanian Riviera",
    description:
      "Gateway to the south — turquoise bays, promenades, and sunset views.",
    badge: "Coastal",
    priceFrom: "€45",
    image:
      "https://images.unsplash.com/photo-1519046909924-d93b0f86d5b3?auto=format&fit=crop&q=80&w=800",
  },
  {
    id: "sarande",
    name: "Sarandë Seaside",
    region: "Southern Coast",
    description:
      "Lively seaside town facing Corfu, with crystal waters and nightlife.",
    badge: "Best Value",
    priceFrom: "€55",
    image:
      "https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?auto=format&fit=crop&q=80&w=800",
  },
  {
    id: "ksamil",
    name: "Ksamil Islands",
    region: "Butrint National Park",
    description:
      "Iconic turquoise islands and white-sand coves on the Ionian Sea.",
    badge: "Must See",
    priceFrom: "€60",
    image:
      "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&q=80&w=800",
  },
  {
    id: "berat",
    name: "Berat Heritage",
    region: "UNESCO Heritage",
    description:
      "The city of a thousand windows — Ottoman architecture and hilltop castles.",
    badge: "Culture",
    priceFrom: "€40",
    image:
      "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&q=80&w=800",
  },
  {
    id: "shkoder",
    name: "Shkodër Lakeside",
    region: "Northern Albania",
    description:
      "Lake-side charm, cycling routes, and the gateway to the Accursed Mountains.",
    badge: "Adventure",
    priceFrom: "€35",
    image:
      "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&q=80&w=800",
  },
  {
    id: "theth",
    name: "Theth Wilderness",
    region: "Albanian Alps",
    description:
      "Remote mountain valleys, traditional stone towers, and alpine hiking trails.",
    badge: "Mountains",
    priceFrom: "€70",
    image:
      "https://images.unsplash.com/photo-1464822759844-d150baec0137?auto=format&fit=crop&q=80&w=800",
  },
]

function DestinationCard({ destination }: { destination: Destination }) {
  return (
    <a
      href="#book"
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
    </a>
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
              className="hidden items-center gap-2 font-extrabold text-primary transition-colors hover:text-brand-accent-hover sm:inline-flex"
            >
              View all destinations
              <ArrowRight className="size-5" strokeWidth={2} />
            </a>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => swiperRef.current?.slidePrev()}
                aria-label="Previous slide"
                className="flex size-11 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-brand shadow-sm transition-all hover:border-border hover:bg-muted"
              >
                <ChevronLeft className="size-5" strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => swiperRef.current?.slideNext()}
                aria-label="Next slide"
                className="flex size-11 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-brand shadow-sm transition-all hover:border-border hover:bg-muted"
              >
                <ChevronRight className="size-5" strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>

        <Swiper
          modules={[Navigation, Pagination]}
          onSwiper={(swiper) => {
            swiperRef.current = swiper
          }}
          slidesPerView={1}
          spaceBetween={24}
          loop
          grabCursor
          speed={600}
          pagination={{ clickable: true }}
          breakpoints={{
            640: { slidesPerView: 2 },
            1024: { slidesPerView: 3 },
          }}
          className="destinations-slider !pb-14"
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
