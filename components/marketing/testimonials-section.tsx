"use client"

import { useEffect } from "react"
import useSWR from "swr"
import {
  ChevronLeft,
  ChevronRight,
  MapPinIcon,
  StarIcon,
} from "lucide-react"

import {
  MarketingCarousel,
  MARKETING_CAROUSEL_SLIDE,
  useMarketingCarousel,
} from "@/components/marketing/marketing-carousel"
import {
  MarketingContainer,
  MARKETING_SECTION_TITLE,
} from "@/components/marketing/marketing-container"
import { TrustpilotTestimonialsContent } from "@/components/marketing/trustpilot-testimonials-section"
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

type PublicTpResponse = {
  visible: boolean
  summary: {
    score: number
    count: number
    profileUrl: string
  } | null
  testimonials: unknown[]
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
            "size-4",
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
    <div className="flex h-full min-h-[220px] w-full min-w-0 flex-col gap-4 rounded-3xl border border-border/80 bg-brand-surface p-6 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-brand-accent/30 hover:shadow-md sm:min-h-[240px]">
      <div className="flex items-center justify-between gap-2">
        <Stars value={review.platformRating} />
        <span className="shrink-0 rounded-full border border-brand-accent/20 bg-brand-accent/10 px-2.5 py-0.5 font-mono text-xs font-bold text-brand-accent">
          Driver {review.driverRating.toFixed(1)}
        </span>
      </div>
      {review.comment ? (
        <p className="min-w-0 flex-1 text-base leading-relaxed break-words text-brand/85">
          “{review.comment}”
        </p>
      ) : (
        <p className="min-w-0 flex-1 text-base text-brand/70">
          Rated {review.platformRating}/5 overall.
        </p>
      )}
      <div className="min-w-0 border-t border-border/60 pt-3.5 text-xs sm:text-sm">
        <p className="font-extrabold text-brand">{review.customerFirstName}</p>
        <p className="mt-0.5 flex items-center gap-1 truncate text-xs font-medium text-muted-foreground">
          <MapPinIcon className="size-3 shrink-0 text-brand-accent" aria-hidden />
          <span className="truncate">{review.dropoffAddress}</span>
        </p>
      </div>
    </div>
  )
}

function CustomerReviewsCarousel({ destination }: { destination?: string }) {
  const {
    emblaRef,
    emblaApi,
    scrollPrev,
    scrollNext,
    canScroll,
    canScrollPrev,
    canScrollNext,
  } = useMarketingCarousel()
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

  return (
    <div>
      {canScroll ? (
        <div className="mb-4 flex justify-end gap-2">
          <button
            type="button"
            aria-label="Previous reviews"
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
            aria-label="Next reviews"
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
      ) : null}

      <MarketingCarousel
        emblaRef={emblaRef}
        viewportClassName="py-3 -my-3 px-1 -mx-1"
      >
        {reviews.map((review) => (
          <div
            key={review.id}
            className={cn(
              MARKETING_CAROUSEL_SLIDE,
              "flex h-auto max-[749px]:flex-[0_0_88%]",
            )}
          >
            <ReviewCard review={review} />
          </div>
        ))}
      </MarketingCarousel>
    </div>
  )
}

export function TestimonialsSection({
  destination,
  eyebrow = "Traveller stories",
  heading,
  showCustomerReviews = true,
  showTrustpilotTestimonials = false,
}: {
  destination?: string
  eyebrow?: string
  heading?: string
  showCustomerReviews?: boolean
  showTrustpilotTestimonials?: boolean
}) {
  const params = new URLSearchParams({ limit: "6" })
  if (destination) params.set("destination", destination)

  const { data: customerData } = useSWR<{ reviews: PublicReview[] }>(
    showCustomerReviews ? `/api/reviews/public?${params.toString()}` : null,
    fetcher,
  )
  const { data: trustpilotData } = useSWR<PublicTpResponse>(
    showTrustpilotTestimonials ? "/api/trustpilot-testimonials/public" : null,
    fetcher,
  )

  const hasCustomer =
    showCustomerReviews && (customerData?.reviews?.length ?? 0) > 0
  const hasTrustpilot =
    showTrustpilotTestimonials &&
    Boolean(trustpilotData?.visible) &&
    Boolean(trustpilotData?.summary) &&
    ((trustpilotData?.testimonials?.length ?? 0) > 0 ||
      (trustpilotData?.summary?.count ?? 0) > 0)

  // While loading customer/trustpilot, keep a shell if the toggle is on so the
  // section does not flash away; hide only when we know there is nothing to show.
  const customerPending = showCustomerReviews && customerData === undefined
  const trustpilotPending =
    showTrustpilotTestimonials && trustpilotData === undefined

  if (
    !showCustomerReviews &&
    !showTrustpilotTestimonials
  ) {
    return null
  }

  if (
    !customerPending &&
    !trustpilotPending &&
    !hasCustomer &&
    !hasTrustpilot
  ) {
    return null
  }

  const title = heading || "Trusted by travellers across Albania"

  return (
    <section className="border-b border-border/60 bg-brand-surface py-14 font-brand md:py-20 lg:py-24">
      <MarketingContainer>
        <div className="mb-8 md:mb-12">
          <span className="mb-2 block text-xs font-extrabold tracking-[0.14em] text-brand-accent uppercase">
            {eyebrow}
          </span>
          <h2 className={MARKETING_SECTION_TITLE}>{title}</h2>
        </div>

        <div className="flex flex-col gap-10 md:gap-12">
          {showCustomerReviews ? (
            <CustomerReviewsCarousel destination={destination} />
          ) : null}
          {showTrustpilotTestimonials ? (
            <TrustpilotTestimonialsContent />
          ) : null}
        </div>
      </MarketingContainer>
    </section>
  )
}
