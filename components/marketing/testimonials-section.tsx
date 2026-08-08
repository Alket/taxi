"use client"

import { useEffect } from "react"
import useSWR from "swr"
import { ChevronLeft, ChevronRight, StarIcon } from "lucide-react"

import {
  MarketingCarousel,
  MARKETING_CAROUSEL_SLIDE,
  useMarketingCarousel,
} from "@/components/marketing/marketing-carousel"
import {
  MarketingContainer,
  MARKETING_SECTION_TITLE,
} from "@/components/marketing/marketing-container"
import { fetcher } from "@/lib/api"
import { cn } from "@/lib/utils"

type PublicReview = {
  id: string
  driverName: string
  driverRating: number
  platformRating: number
  comment: string | null
  customerFirstName: string
  routeLabel: string
  dropoffAddress: string
}

function Stars({ value }: { value: number }) {
  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={`${value} out of 5`}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <StarIcon
          key={i}
          className={cn(
            "size-3.5",
            i < Math.round(value)
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground/30",
          )}
        />
      ))}
    </span>
  )
}

function ReviewCard({ review }: { review: PublicReview }) {
  return (
    <div className="flex h-full min-h-[220px] w-full min-w-0 flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:min-h-[240px] sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <Stars value={review.platformRating} />
        <span className="shrink-0 text-xs text-muted-foreground">
          Driver {review.driverRating.toFixed(1)}
        </span>
      </div>
      {review.comment ? (
        <p className="min-w-0 flex-1 text-sm leading-relaxed break-words text-brand sm:text-base">
          “{review.comment}”
        </p>
      ) : (
        <p className="min-w-0 flex-1 text-sm text-muted-foreground sm:text-base">
          Rated {review.platformRating}/5 overall.
        </p>
      )}
      <div className="min-w-0 border-t pt-3 text-xs text-muted-foreground sm:text-sm">
        <p className="font-semibold text-brand">{review.customerFirstName}</p>
        <p className="mt-0.5 truncate">{review.dropoffAddress}</p>
      </div>
    </div>
  )
}

export function TestimonialsSection({
  destination,
  eyebrow = "Traveller stories",
  heading,
}: {
  destination?: string
  eyebrow?: string
  heading?: string
}) {
  const { emblaRef, emblaApi, scrollPrev, scrollNext, canScroll } =
    useMarketingCarousel()
  const params = new URLSearchParams({ limit: "6" })
  if (destination) params.set("destination", destination)
  const { data } = useSWR<{ reviews: PublicReview[] }>(
    `/api/reviews/public?${params.toString()}`,
    fetcher,
  )
  const reviews = data?.reviews ?? []

  useEffect(() => {
    emblaApi?.reInit()
  }, [emblaApi, reviews])

  if (reviews.length === 0) return null

  const title =
    heading ||
    (destination
      ? "Guest reviews"
      : "Trusted by travellers across Albania")

  return (
    <section className="bg-white py-10 md:py-24">
      <MarketingContainer>
        <div className="mb-8 flex items-end justify-between gap-4 md:mb-12">
          <div className="min-w-0 flex-1">
            <span className="mb-2 block text-xs font-extrabold tracking-widest text-primary uppercase sm:mb-3">
              {eyebrow}
            </span>
            <h2 className={MARKETING_SECTION_TITLE}>{title}</h2>
          </div>

          {canScroll ? (
            <div className="flex shrink-0 gap-1.5 sm:gap-2">
              <button
                type="button"
                aria-label="Previous reviews"
                className="flex size-9 items-center justify-center rounded-full border border-border bg-card text-brand transition-colors hover:bg-muted sm:size-10"
                onClick={scrollPrev}
              >
                <ChevronLeft className="size-4 sm:size-5" />
              </button>
              <button
                type="button"
                aria-label="Next reviews"
                className="flex size-9 items-center justify-center rounded-full border border-border bg-card text-brand transition-colors hover:bg-muted sm:size-10"
                onClick={scrollNext}
              >
                <ChevronRight className="size-4 sm:size-5" />
              </button>
            </div>
          ) : null}
        </div>

        <MarketingCarousel emblaRef={emblaRef}>
          {reviews.map((review) => (
            <div
              key={review.id}
              className={cn(MARKETING_CAROUSEL_SLIDE, "flex h-auto")}
            >
              <ReviewCard review={review} />
            </div>
          ))}
        </MarketingCarousel>
      </MarketingContainer>
    </section>
  )
}
