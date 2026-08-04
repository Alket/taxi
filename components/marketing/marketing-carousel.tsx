"use client"

import { useCallback, useEffect, useState, type ReactNode, type Ref } from "react"
import useEmblaCarousel from "embla-carousel-react"
import type { EmblaCarouselType, EmblaOptionsType } from "embla-carousel"

import { cn } from "@/lib/utils"

/** Matches previous Swiper breakpoints (1.12 → 1.25 → 1.5 → 2.15 → 3). */
export const MARKETING_CAROUSEL_SLIDE =
  "box-border min-w-0 shrink-0 grow-0 basis-[89%] w-[89%] max-w-[89%] min-[480px]:basis-[80%] min-[480px]:w-[80%] min-[480px]:max-w-[80%] sm:basis-[calc((100%-0.75rem)/1.5)] sm:w-[calc((100%-0.75rem)/1.5)] sm:max-w-[calc((100%-0.75rem)/1.5)] md:basis-[calc((100%-1.25rem)/2.15)] md:w-[calc((100%-1.25rem)/2.15)] md:max-w-[calc((100%-1.25rem)/2.15)] lg:basis-[calc((100%-2.5rem)/3)] lg:w-[calc((100%-2.5rem)/3)] lg:max-w-[calc((100%-2.5rem)/3)]"

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
      <div className={cn("flex touch-pan-y gap-4 md:gap-5", className)}>
        {children}
      </div>
    </div>
  )
}
