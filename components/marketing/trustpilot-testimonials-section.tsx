"use client"

import { useCallback, useEffect, useState } from "react"
import useSWR from "swr"
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react"
import type { EmblaCarouselType } from "embla-carousel"

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

const TP_GREEN = "#00b67a"
const TP_EMPTY = "#dcdce6"

/** Green star glyph (Trustpilot star). */
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

/** Trustpilot star boxes: one white star glyph inside each green square. */
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
    size === "sm"
      ? "size-5 rounded-[3px]"
      : size === "lg"
        ? "size-8 sm:size-9 rounded-[4px]"
        : "size-7 rounded-[3.5px]"
  const star =
    size === "sm"
      ? "size-3.5"
      : size === "lg"
        ? "size-5"
        : "size-4"

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

function TrustpilotWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <StarGlyph fill={TP_GREEN} className="size-7 shrink-0" />
      <span className="font-brand text-xl font-black tracking-tight text-brand sm:text-2xl">
        Trustpilot
      </span>
    </span>
  )
}

function formatReviewDate(dateStr: string | null) {
  if (!dateStr) return null
  const parsed = new Date(dateStr)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function reviewHeadline(item: PublicTpTestimonial) {
  const titled = item.title?.trim()
  if (titled) return titled
  const first = item.body.split(/[.!?\n]/)[0]?.trim()
  if (first && first.length <= 80) return first
  return item.body.slice(0, 60).trimEnd() + (item.body.length > 60 ? "…" : "")
}

function authorInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "T"
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase()
  return `${parts[0]!.slice(0, 1)}${parts[parts.length - 1]!.slice(0, 1)}`.toUpperCase()
}

function ReviewCard({ item }: { item: PublicTpTestimonial }) {
  const headline = reviewHeadline(item)
  const body =
    item.body.length > 220 ? `${item.body.slice(0, 217).trimEnd()}…` : item.body
  const formattedDate = formatReviewDate(item.reviewedAt)
  const hasValidLink = Boolean(
    item.sourceUrl && isAllowedTrustpilotUrl(item.sourceUrl),
  )

  const inner = (
    <article
      className={cn(
        "group relative flex h-full min-h-[230px] w-full flex-col gap-3.5 rounded-3xl border border-border/80 bg-brand-surface p-6 shadow-xs transition-all duration-300",
        hasValidLink &&
          "hover:-translate-y-1 hover:border-[#00b67a]/40 hover:shadow-[0_18px_35px_-12px_rgba(0,182,122,0.16)]",
      )}
    >
      {/* Top Row: Trustpilot Box Stars + Verified Badge */}
      <div className="flex items-center justify-between gap-2">
        <TpBoxStars value={item.rating} size="sm" />
        <span className="inline-flex items-center gap-1 rounded-full bg-[#00b67a]/10 px-2.5 py-0.5 text-[11px] font-bold text-[#008559]">
          <CheckCircle2 className="size-3 shrink-0" aria-hidden />
          <span>Verified</span>
        </span>
      </div>

      {/* Headline */}
      <h3 className="line-clamp-1 font-brand text-base font-extrabold leading-snug tracking-tight text-brand transition-colors group-hover:text-[#008559]">
        {headline}
      </h3>

      {/* Review Body */}
      <p className="min-w-0 flex-1 text-sm leading-relaxed text-brand/75">
        {body}
      </p>

      {/* Author & Date Footer */}
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/60 pt-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-page text-[11px] font-extrabold text-brand"
          >
            {authorInitials(item.authorName)}
          </span>
          <span className="truncate text-xs font-extrabold text-brand">
            {item.authorName}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
          {formattedDate ? <span>{formattedDate}</span> : null}
          {hasValidLink ? (
            <ExternalLink
              className="size-3.5 text-muted-foreground/70 transition-colors group-hover:text-[#00b67a]"
              aria-hidden
            />
          ) : null}
        </div>
      </div>
    </article>
  )

  if (hasValidLink && item.sourceUrl) {
    return (
      <a
        href={item.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block h-full w-full rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00b67a] focus-visible:ring-offset-2"
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
    emblaApi.reInit()
    onInit(emblaApi)
    emblaApi.on("reInit", onInit)
    emblaApi.on("select", onSelect)
    return () => {
      emblaApi.off("reInit", onInit)
      emblaApi.off("select", onSelect)
    }
  }, [emblaApi, testimonials, onInit, onSelect])

  if (isLoading || !data?.visible || !data.summary) return null
  if (testimonials.length === 0 && data.summary.count <= 0) return null

  const { summary } = data
  const scoreLabel = Number(summary.score).toFixed(1)
  const countLabel = Number(summary.count).toLocaleString()
  const profileUrl = isAllowedTrustpilotUrl(summary.profileUrl)
    ? summary.profileUrl
    : null
  const ratingWord =
    summary.score >= 4.3
      ? "Excellent"
      : summary.score >= 3.8
        ? "Great"
        : "Good"

  return (
    <div
      className={cn(
        "flex flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-8",
        className,
      )}
    >
      {/* Left Column: Framed Trustpilot Summary Card */}
      <div className="flex w-full shrink-0 flex-col justify-between rounded-3xl border border-border/80 bg-brand-page/70 p-6 shadow-2xs sm:p-7 lg:w-64 xl:w-72">
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="font-brand text-xl font-black tracking-tight text-brand sm:text-2xl">
              {ratingWord}
            </span>
            <span className="rounded-full border border-[#00b67a]/30 bg-[#00b67a]/10 px-2.5 py-0.5 font-mono text-xs font-extrabold text-[#008559]">
              {scoreLabel} / 5
            </span>
          </div>

          <div className="mt-3">
            <TpBoxStars value={summary.score} size="lg" />
          </div>

          <p className="mt-3 text-sm font-medium text-brand/80">
            Based on{" "}
            <span className="font-extrabold tabular-nums text-brand underline decoration-border underline-offset-4">
              {countLabel} reviews
            </span>
          </p>

          <div className="mt-5 border-t border-border/70 pt-4">
            {profileUrl ? (
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 rounded-lg transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00b67a]"
                aria-label="View our Trustpilot profile"
              >
                <TrustpilotWordmark />
                <ExternalLink
                  className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#00b67a]"
                  aria-hidden
                />
              </a>
            ) : (
              <TrustpilotWordmark />
            )}
          </div>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-brand/65">
          {summary.disclaimer?.trim() ||
            "Selection of 5 star reviews from verified customers."}
        </p>
      </div>

      {/* Right Column: Reviews Carousel */}
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        {testimonials.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-border bg-brand-surface p-8 text-center">
            <p className="text-sm font-medium text-brand/75">
              {profileUrl ? (
                <a
                  href={profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-bold text-brand underline decoration-[#00b67a] underline-offset-4 hover:text-[#008559]"
                >
                  <span>Read our reviews on Trustpilot</span>
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              ) : (
                "No Trustpilot reviews to show yet."
              )}
            </p>
          </div>
        ) : (
          <div>
            <MarketingCarousel
              emblaRef={emblaRef}
              viewportClassName="py-3 -my-3 px-1 -mx-1"
            >
              {testimonials.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    MARKETING_CAROUSEL_SLIDE,
                    "flex h-auto max-[749px]:flex-[0_0_88%]",
                  )}
                >
                  <ReviewCard item={item} />
                </div>
              ))}
            </MarketingCarousel>

            {canScroll ? (
              <div className="mt-5 flex items-center justify-between gap-4">
                {scrollSnaps.length > 1 ? (
                  <div
                    className="flex items-center gap-1.5"
                    role="group"
                    aria-label="Trustpilot reviews pagination"
                  >
                    {scrollSnaps.map((_, idx) => {
                      const isActive = idx === selectedIndex
                      return (
                        <button
                          key={idx}
                          type="button"
                          aria-label={`Go to review slide ${idx + 1}`}
                          aria-current={isActive ? "true" : undefined}
                          onClick={() => emblaApi?.scrollTo(idx)}
                          className="group flex py-1.5 focus-visible:outline-none"
                        >
                          <span
                            className={cn(
                              "h-1.5 rounded-full transition-all duration-300",
                              isActive
                                ? "w-6 bg-[#00b67a]"
                                : "w-1.5 bg-border group-hover:bg-brand/40",
                            )}
                          />
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <span />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Previous Trustpilot reviews"
                    onClick={scrollPrev}
                    disabled={!canScrollPrev}
                    aria-disabled={!canScrollPrev}
                    className={cn(
                      "flex size-10 items-center justify-center rounded-full border border-border/80 bg-brand-surface text-brand shadow-2xs transition-all duration-200 sm:size-11",
                      "hover:-translate-y-0.5 hover:border-[#00b67a]/50 hover:text-[#008559] hover:shadow-xs active:scale-95",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00b67a] focus-visible:ring-offset-2",
                      "disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0 disabled:hover:border-border/80 disabled:hover:text-brand disabled:hover:shadow-2xs disabled:active:scale-100",
                    )}
                  >
                    <ChevronLeft className="size-5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label="Next Trustpilot reviews"
                    onClick={scrollNext}
                    disabled={!canScrollNext}
                    aria-disabled={!canScrollNext}
                    className={cn(
                      "flex size-10 items-center justify-center rounded-full border border-border/80 bg-brand-surface text-brand shadow-2xs transition-all duration-200 sm:size-11",
                      "hover:-translate-y-0.5 hover:border-[#00b67a]/50 hover:text-[#008559] hover:shadow-xs active:scale-95",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00b67a] focus-visible:ring-offset-2",
                      "disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0 disabled:hover:border-border/80 disabled:hover:text-brand disabled:hover:shadow-2xs disabled:active:scale-100",
                    )}
                  >
                    <ChevronRight className="size-5" aria-hidden />
                  </button>
                </div>
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
      className={cn(
        "border-b border-border/60 bg-brand-surface py-14 font-brand md:py-20 lg:py-24",
        className,
      )}
      aria-label="Trustpilot reviews"
    >
      <MarketingContainer>
        <TrustpilotTestimonialsContent />
      </MarketingContainer>
    </section>
  )
}
