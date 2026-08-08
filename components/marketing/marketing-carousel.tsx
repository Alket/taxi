"use client"

import { useCallback, useEffect, useState, type ReactNode, type Ref } from "react"
import useEmblaCarousel from "embla-carousel-react"
import type { EmblaCarouselType, EmblaOptionsType } from "embla-carousel"

import { cn } from "@/lib/utils"

/**
 * Slide widths for the peeking marketing carousels.
 * Spacing uses padding-left on slides (not flex gap) so Embla measures widths
 * correctly — CSS gap + % basis often clips the last card on mobile.
 *
 * Breakpoints roughly: ~1.12 → 1.25 → 1.5 → 2.15 → 3 slides visible.
 */
export const MARKETING_CAROUSEL_SLIDE =
  "box-border min-w-0 shrink-0 grow-0 pl-4 " +
  "basis-[85%] w-[85%] max-w-[85%] " +
  "min-[480px]:basis-[78%] min-[480px]:w-[78%] min-[480px]:max-w-[78%] " +
  "sm:basis-[calc(100%/1.5)] sm:w-[calc(100%/1.5)] sm:max-w-[calc(100%/1.5)] " +
  "md:basis-[calc(100%/2.15)] md:w-[calc(100%/2.15)] md:max-w-[calc(100%/2.15)] " +
  "md:pl-5 " +
  "lg:basis-[calc(100%/3)] lg:w-[calc(100%/3)] lg:max-w-[calc(100%/3)]"

const DEFAULT_OPTIONS: EmblaOptionsType = {
  align: "start",
  containScroll: "trimSnaps",
  duration: 22,
}

export function useMarketingCarousel(options?: EmblaOptionsType) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    ...DEFAULT_OPTIONS,
    ...options,
  })
  const [canScroll, setCanScroll] = useState(false)

  const sync = useCallback((api: EmblaCarouselType) => {
    setCanScroll(api.canScrollPrev() || api.canScrollNext())
  }, [])

  useEffect(() => {
    if (!emblaApi) return
    sync(emblaApi)
    emblaApi.on("reInit", sync)
    emblaApi.on("select", sync)
    return () => {
      emblaApi.off("reInit", sync)
      emblaApi.off("select", sync)
    }
  }, [emblaApi, sync])

  const scrollPrev = useCallback(() => {
    emblaApi?.scrollPrev()
  }, [emblaApi])

  const scrollNext = useCallback(() => {
    emblaApi?.scrollNext()
  }, [emblaApi])

  return {
    emblaRef,
    emblaApi,
    canScroll,
    scrollPrev,
    scrollNext,
  }
}

export function MarketingCarousel({
  emblaRef,
  children,
  className,
  viewportClassName,
}: {
  emblaRef: Ref<HTMLDivElement>
  children: ReactNode
  className?: string
  viewportClassName?: string
}) {
  return (
    <div className={cn("overflow-hidden", viewportClassName)} ref={emblaRef}>
      <div
        className={cn(
          // Negative margin cancels the first slide's padding-left so the
          // first card lines up with the section content edge.
          // Pre-promote this track to its own GPU compositing layer so the
          // very first frame of Embla's translate3d animation is already
          // composited. Without this, mobile browsers (esp. Safari) can
          // promote the layer a frame late, which shows up as a small hitch
          // right as the slide starts moving on "next"/swipe.
          "-ml-4 flex touch-pan-y [backface-visibility:hidden] will-change-transform md:-ml-5",
          className,
        )}
      >
        {children}
      </div>
    </div>
  )
}
