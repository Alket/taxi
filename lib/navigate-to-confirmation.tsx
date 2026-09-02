"use client"

import { createRoot } from "react-dom/client"

import { BookingConfirmingScreen } from "@/components/booking/booking-confirming-screen"
import { markMarketingPreloaderHandoff } from "@/components/marketing/marketing-preloader"
import { bypassBookingLeaveGuard } from "@/hooks/use-booking-leave-guard"
import {
  type Locale,
  isLocale,
  localeFromPathname,
  localePath,
} from "@/lib/i18n/locales"
import { t } from "@/lib/i18n/t"
import { useBookingStore } from "@/lib/store/booking-store"

function readClientLocale(): Locale {
  if (typeof document === "undefined") return "en"
  const fromPath = localeFromPathname(window.location.pathname)
  if (fromPath !== "en") return fromPath
  const match = document.cookie.match(/(?:^|; )NEXT_LOCALE=([^;]*)/)
  const cookie = match?.[1] ? decodeURIComponent(match[1]) : null
  return isLocale(cookie) ? cookie : "en"
}

/**
 * Show a confirming preloader, clear the draft, then hard-navigate to the
 * thank-you page. Avoids soft-nav glitches where the booking wizard flashes
 * empty after resetBooking() before confirmation paints.
 *
 * Trustpilot invite JWT is delivered via HttpOnly cookie from payment APIs —
 * never put it in the confirmation URL.
 */
export function navigateToBookingConfirmation(referenceCode: string) {
  const code = referenceCode.trim().toUpperCase()
  if (!code) return

  const locale = readClientLocale()
  // Keep NEXT_LOCALE so middleware doesn't force English on the confirmation URL.
  document.cookie = `NEXT_LOCALE=${encodeURIComponent(locale)}; Path=/; Max-Age=31536000; SameSite=Lax`

  const confirmationUrl = localePath(
    `/book/confirmation/${encodeURIComponent(code)}`,
    locale,
  )

  // Must run before resetBooking(): clearing startedFromHero would otherwise
  // trigger BookingShell's /#book redirect and cancel this navigation (worse
  // over slower tunnels like ngrok).
  bypassBookingLeaveGuard()

  // Skip booking-layout logo preloader on the confirmation hard load.
  markMarketingPreloaderHandoff()

  const host = document.createElement("div")
  host.setAttribute("data-booking-confirming", "true")
  document.body.appendChild(host)
  createRoot(host).render(
    <BookingConfirmingScreen
      message={t(locale, "book.confirmingBooking")}
    />,
  )

  useBookingStore.getState().resetBooking()

  // Hard navigate immediately — do not wait for rAF (soft-nav can win the race).
  window.location.assign(confirmationUrl)
}
