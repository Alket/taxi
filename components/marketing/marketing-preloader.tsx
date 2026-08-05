"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import Image from "next/image"
import { usePathname } from "next/navigation"

import { stripLocalePrefix } from "@/lib/i18n/locales"
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

function isMarketingPreloaderHandoffActive() {
  const now = Date.now()
  if (handoffUntil > now) return true
  try {
    const raw = sessionStorage.getItem(MARKETING_PRELOADER_HANDOFF_KEY)
    if (!raw) return false
    const until = Number(raw)
    if (Number.isFinite(until) && until > now) {
      handoffUntil = until
      return true
    }
    sessionStorage.removeItem(MARKETING_PRELOADER_HANDOFF_KEY)
  } catch {
    /* ignore */
  }
  return false
}

function clearMarketingPreloaderHandoff() {
  handoffUntil = 0
  try {
    sessionStorage.removeItem(MARKETING_PRELOADER_HANDOFF_KEY)
  } catch {
    /* ignore */
  }
}

function isHomePathname(pathname: string) {
  return stripLocalePrefix(pathname) === "/"
}

function isBookingConfirmationPath(pathname: string) {
  return stripLocalePrefix(pathname).startsWith("/book/confirmation")
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
 * Shows on first visit and briefly on route changes within the same scope.
 */
export function MarketingPreloader({
  scope = "all",
}: {
  /** `home` only reacts while on the homepage; `booking` only off-home routes. */
  scope?: "all" | "home" | "booking"
}) {
  const pathname = usePathname()
  const [visible, setVisible] = useState(() => {
    // Path-based skips must match SSR and client to avoid hydration mismatch.
    if (scope === "booking" && isBookingConfirmationPath(pathname)) return false
    if (scope === "home" && !isHomePathname(pathname)) return false
    if (scope === "booking" && isHomePathname(pathname)) return false
    // Handoff uses sessionStorage — client-only; keep SSR/client aligned by
    // defaulting visible and letting the effect hide after mount when handoff.
    if (typeof window !== "undefined") {
      if (scope === "booking" && isMarketingPreloaderHandoffActive()) return false
    }
    return true
  })
  const [leaving, setLeaving] = useState(false)
  const isFirst = useRef(
    scope === "booking" && isBookingConfirmationPath(pathname)
      ? false
      : typeof window === "undefined"
        ? true
        : !(scope === "booking" && isMarketingPreloaderHandoffActive()),
  )
  const timers = useRef<number[]>([])

  useEffect(() => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []

    const onHome = isHomePathname(pathname)
    if (scope === "home" && !onHome) {
      setVisible(false)
      setLeaving(false)
      return
    }
    if (scope === "booking" && onHome) {
      setVisible(false)
      setLeaving(false)
      return
    }

    // Confirmation uses BookingConfirmingScreen / loading.tsx only — no logo stack.
    if (scope === "booking" && isBookingConfirmationPath(pathname)) {
      isFirst.current = false
      setVisible(false)
      setLeaving(false)
      return
    }

    // Hero → /book already shows a branded cover; don't stack a second one.
    if (isMarketingPreloaderHandoffActive()) {
      isFirst.current = false
      setVisible(false)
      setLeaving(false)
      const clearId = window.setTimeout(
        clearMarketingPreloaderHandoff,
        Math.max(0, handoffUntil - Date.now()),
      )
      timers.current = [clearId]
      return () => {
        timers.current.forEach((id) => window.clearTimeout(id))
        timers.current = []
      }
    }

    setVisible(true)
    setLeaving(false)

    const holdMs = isFirst.current ? 700 : 320
    isFirst.current = false

    const leaveId = window.setTimeout(() => setLeaving(true), holdMs)
    const hideId = window.setTimeout(() => setVisible(false), holdMs + 420)
    timers.current = [leaveId, hideId]

    return () => {
      timers.current.forEach((id) => window.clearTimeout(id))
      timers.current = []
    }
  }, [pathname, scope])

  if (!visible) return null

  return <MarketingPreloaderMark leaving={leaving} />
}
