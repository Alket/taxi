"use client"

import type { CSSProperties } from "react"
import Image from "next/image"

import { cn } from "@/lib/utils"

/** Set before client nav from the homepage hero so /book does not open a second preloader. */
export const MARKETING_PRELOADER_HANDOFF_KEY = "marketing-preloader-handoff"

/** Keep skip active long enough for React Strict Mode remounts + layout paint. */
const HANDOFF_TTL_MS = 2500

let handoffUntil = 0

export function markMarketingPreloaderHandoff() {
  handoffUntil = Date.now() + HANDOFF_TTL_MS
  try {
    sessionStorage.setItem(
      MARKETING_PRELOADER_HANDOFF_KEY,
      String(handoffUntil),
    )
  } catch {
    /* private mode / blocked storage */
  }
}

export function MarketingPreloaderMark({
  className,
  leaving = false,
  style,
}: {
  className?: string
  leaving?: boolean
  style?: CSSProperties
}) {
  return (
    <div
      className={cn(
        "marketing-preloader fixed inset-0 z-[200] flex items-center justify-center bg-brand-page",
        "transition-opacity duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
        leaving && "pointer-events-none opacity-0",
        className,
      )}
      style={style}
      aria-busy="true"
      aria-live="polite"
      role="status"
    >
      <div className="flex flex-col items-center gap-5">
        <Image
          src="/marketing/logo.svg"
          alt=""
          width={207}
          height={150}
          className="marketing-preloader-logo h-11 w-auto sm:h-12"
          priority
        />
        <span className="marketing-preloader-bar" aria-hidden />
        <span className="sr-only">Loading</span>
      </div>
    </div>
  )
}

/**
 * Full-screen branded preloader for marketing pages.
 * Disabled on initial SSR / route renders so the Hero LCP element paints on the
 * very first frame for users, Core Web Vitals, and search engine crawlers.
 * Explicit booking transitions still use `MarketingPreloaderMark` directly.
 */
export function MarketingPreloader(_props: {
  /** `home` only reacts while on the homepage; `booking` only off-home routes. */
  scope?: "all" | "home" | "booking"
}) {
  return null
}
