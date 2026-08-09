"use client"

import { useCallback, useEffect, useState, type ReactNode, type Ref } from "react"
import useEmblaCarousel from "embla-carousel-react"
import type { EmblaCarouselType, EmblaOptionsType } from "embla-carousel"

import { cn } from "@/lib/utils"

/**
 * Embla “Slides Per View” pattern:
 * https://www.embla-carousel.com/docs/examples/predefined
 *
 * Options: align start (not center) + default containScroll trimSnaps.
 * Sizes: 1 → 2 → 3 slides (100% / 50% / calc(100%/3)).
 * Gaps: padding-left on slides + matching negative margin on the track.
 */
export const MARKETING_CAROUSEL_SLIDE =
  "box-border min-w-0 shrink-0 grow-0 " +
  "flex-[0_0_100%] pl-4 " +
  "min-[750px]:flex-[0_0_50%] min-[750px]:pl-[1.6rem] " +
  "min-[1200px]:flex-[0_0_calc(100%/3)] min-[1200px]:pl-8"

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
          "flex touch-pan-y [backface-visibility:hidden]",
          "-ml-4 min-[750px]:-ml-[1.6rem] min-[1200px]:-ml-8",
          className,
        )}
      >
        {children}
      </div>
    </div>
  )
}
