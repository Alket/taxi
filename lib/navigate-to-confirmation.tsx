"use client"

import { createRoot } from "react-dom/client"

import { BookingConfirmingScreen } from "@/components/booking/booking-confirming-screen"
import { markMarketingPreloaderHandoff } from "@/components/marketing/marketing-preloader"
import { bypassBookingLeaveGuard } from "@/hooks/use-booking-leave-guard"
import { useBookingStore } from "@/lib/store/booking-store"

/**
 * Show a confirming preloader, clear the draft, then hard-navigate to the
 * thank-you page. Avoids soft-nav glitches where the booking wizard flashes
 * empty after resetBooking() before confirmation paints.
 */
export function navigateToBookingConfirmation(referenceCode: string) {
  const code = referenceCode.trim().toUpperCase()
  if (!code) return

  const confirmationUrl = `/book/confirmation/${encodeURIComponent(code)}`

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
    <BookingConfirmingScreen message="Confirming your booking…" />,
  )

  useBookingStore.getState().resetBooking()

  // Hard navigate immediately — do not wait for rAF (soft-nav can win the race).
  window.location.assign(confirmationUrl)
}
