"use client"

import { useEffect } from "react"
import useSWR from "swr"
import { ChevronLeft, ChevronRight } from "lucide-react"

import {
  MarketingCarousel,
  MARKETING_CAROUSEL_SLIDE,
  useMarketingCarousel,
} from "@/components/marketing/marketing-carousel"
import { MarketingContainer } from "@/components/marketing/marketing-container"
import { fetcher } from "@/lib/api"
import { isAllowedTrustpilotUrl } from "@/lib/trustpilot-testimonials"
import { cn } from "@/lib/utils"

type PublicTpTestimonial = {
  id: string
  authorName: string
  title: string
  rating: number
  body: string
  reviewedAt: string | null
  sourceUrl: string | null
}

type PublicTpResponse = {
  visible: boolean
  summary: {
    score: number
    count: number
    profileUrl: string
    disclaimer: string
  } | null
  testimonials: PublicTpTestimonial[]
}

const TP_GREEN = "#00B877"
const TP_EMPTY = "#dcdce6"

/** Green star glyph (Trustpilot card stars). */
const STAR_PATH =
  "M10.3873 6.11425H16.5L11.5564 9.88587L8.50556 12.2168L11.9795 11.268L11.5564 9.88587L13.4381 16L8.49443 12.2168L3.5508 16L5.44363 9.88587L0.5 6.10253L6.61273 6.11425L8.50557 0L10.3873 6.11425Z"

function StarGlyph({
  fill,
  className,
}: {
  fill: string
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 17 16"
      className={className}
      aria-hidden
      focusable="false"
    >
      <path
        clipRule="evenodd"
        fillRule="evenodd"
        d={STAR_PATH}
        fill={fill}
      />
    </svg>
  )
}

/** Summary rating: one star glyph inside each colored square. */
function TpBoxStars({
  value,
  size = "md",
}: {
  value: number
  size?: "sm" | "md" | "lg"
}) {
  const clamped = Math.max(0, Math.min(5, value))
  const rounded = Math.round(clamped * 2) / 2
  const box =
    size === "sm" ? "size-5" : size === "lg" ? "size-9" : "size-7"
  const star =
    size === "sm" ? "size-3" : size === "lg" ? "size-5" : "size-4"

  return (
    <span
      className="inline-flex items-center gap-1"
      aria-label={`${clamped} out of 5`}
    >
      {Array.from({ length: 5 }, (_, i) => {
        const threshold = i + 1
        const full = rounded >= threshold
        const half = !full && rounded >= threshold - 0.5

        if (half) {
          return (
            <span
              key={i}
              className={cn(
                "relative inline-flex items-center justify-center overflow-hidden",
                box,
              )}
            >
              <span className="absolute inset-0 bg-[#dcdce6]" />
              <span className="absolute inset-y-0 left-0 w-1/2 bg-[#00b67a]" />
              <StarGlyph fill="#FFF" className={cn("relative z-[1]", star)} />
            </span>
          )
        }

        return (
          <span
            key={i}
            className={cn(
              "inline-flex items-center justify-center",
              box,
              full ? "bg-[#00b67a]" : "bg-[#dcdce6]",
            )}
          >
            <StarGlyph fill="#FFF" className={star} />
          </span>
        )
      })}
    </span>
  )
}

/** Card rating: green star glyphs only (no boxes). */
function TpCardStars({ value }: { value: number }) {
  const stars = Math.max(0, Math.min(5, Math.round(value)))
  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={`${stars} out of 5`}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <StarGlyph
          key={i}
          fill={i < stars ? TP_GREEN : TP_EMPTY}
          className="size-4"
        />
      ))}
    </span>
  )
}

function TrustpilotWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <StarGlyph fill={TP_GREEN} className="size-9" />
      <span className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
        Trustpilot
      </span>
    </span>
  )
}

function reviewHeadline(item: PublicTpTestimonial) {
  const titled = item.title?.trim()
  if (titled) return titled
  const first = item.body.split(/[.!?\n]/)[0]?.trim()
  if (first && first.length <= 80) return first
  return item.body.slice(0, 60).trimEnd() + (item.body.length > 60 ? "…" : "")
}

function ReviewCard({ item }: { item: PublicTpTestimonial }) {
  const headline = reviewHeadline(item)
  const body =
    item.body.length > 220 ? `${item.body.slice(0, 217).trimEnd()}…` : item.body

  const inner = (
    <div className="flex h-full min-h-[200px] flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-5 sm:p-6">
      <TpCardStars value={item.rating} />
      <p className="text-[15px] leading-snug font-bold text-neutral-900">
        {headline}
      </p>
      <p className="min-w-0 flex-1 text-sm leading-relaxed text-neutral-600">
        {body}
      </p>
      <p className="text-sm text-neutral-500">— {item.authorName}</p>
    </div>
  )

  if (item.sourceUrl && isAllowedTrustpilotUrl(item.sourceUrl)) {
    return (
      <a
        href={item.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block h-full transition-opacity hover:opacity-90"
      >
        {inner}
      </a>
    )
  }
  return inner
}

/** Trustpilot summary + carousel content (matches Trustpilot widget layout). */
export function TrustpilotTestimonialsContent({
  className,
}: {
  className?: string
}) {
  const { data, isLoading } = useSWR<PublicTpResponse>(
    "/api/trustpilot-testimonials/public",
    fetcher,
  )
  const {
    emblaRef,
    canScroll,
    canScrollPrev,
    canScrollNext,
    scrollPrev,
    scrollNext,
    emblaApi,
  } = useMarketingCarousel()

  const testimonials = data?.testimonials ?? []

  useEffect(() => {
    emblaApi?.reInit()
  }, [emblaApi, testimonials])

  if (isLoading || !data?.visible || !data.summary) return null
  if (testimonials.length === 0 && data.summary.count <= 0) return null

  const { summary } = data
  const scoreLabel = Number(summary.score).toFixed(1)
  const countLabel = Number(summary.count).toLocaleString()
  const profileUrl = isAllowedTrustpilotUrl(summary.profileUrl)
    ? summary.profileUrl
    : null

  return (
    <div
      className={cn(
        "flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10",
        className,
      )}
    >
      <div className="flex w-full shrink-0 flex-col lg:w-56 xl:w-64">
        {profileUrl ? (
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit flex-col gap-4 transition-opacity hover:opacity-90"
            aria-label="View our Trustpilot profile"
          >
            <TpBoxStars value={summary.score} size="lg" />
            <TrustpilotWordmark />
          </a>
        ) : (
          <div className="inline-flex w-fit flex-col gap-4">
            <TpBoxStars value={summary.score} size="lg" />
            <TrustpilotWordmark />
          </div>
        )}
        <p className="mt-2 text-sm text-neutral-700">
          TrustScore{" "}
          <span className="font-bold tabular-nums text-neutral-900">
            {scoreLabel}
          </span>
          <span className="text-neutral-400"> | </span>
          <span className="tabular-nums">{countLabel}</span> reviews
        </p>
        <p className="mt-3 text-xs leading-relaxed text-neutral-400">
          {summary.disclaimer?.trim() ||
            "Selection of 5 star reviews from verified customers."}
        </p>
      </div>

      <div className="min-w-0 flex-1">
        {testimonials.length === 0 ? (
          <p className="text-sm text-neutral-500">
            {profileUrl ? (
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-neutral-800 underline-offset-4 hover:underline"
              >
                Read our reviews on Trustpilot
              </a>
            ) : (
              "No Trustpilot reviews to show yet."
            )}
          </p>
        ) : (
          <div>
            <MarketingCarousel emblaRef={emblaRef}>
              {testimonials.map((item) => (
                <div
                  key={item.id}
                  className={cn(MARKETING_CAROUSEL_SLIDE, "flex h-auto")}
                >
                  <ReviewCard item={item} />
                </div>
              ))}
            </MarketingCarousel>

            {canScroll ? (
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  aria-label="Previous Trustpilot reviews"
                  onClick={scrollPrev}
                  disabled={!canScrollPrev}
                  className="flex size-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-default disabled:opacity-35"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Next Trustpilot reviews"
                  onClick={scrollNext}
                  disabled={!canScrollNext}
                  className="flex size-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-default disabled:opacity-35"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

/** Standalone section (legacy); prefer embedding via TestimonialsSection. */
export function TrustpilotTestimonialsSection({
  className,
}: {
  className?: string
}) {
  return (
    <section
      className={cn("bg-white py-10 md:py-24", className)}
      aria-label="Trustpilot reviews"
    >
      <MarketingContainer>
        <TrustpilotTestimonialsContent />
      </MarketingContainer>
    </section>
  )
}
