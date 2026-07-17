"use client"

import { createRoot } from "react-dom/client"

import { BookingConfirmingScreen } from "@/components/booking/booking-confirming-screen"
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

  bypassBookingLeaveGuard()
  useBookingStore.getState().resetBooking()

  const host = document.createElement("div")
  host.setAttribute("data-booking-confirming", "true")
  document.body.appendChild(host)
  createRoot(host).render(
    <BookingConfirmingScreen message="Confirming your booking…" />,
  )

  // Paint the overlay, then leave the wizard entirely.
  window.requestAnimationFrame(() => {
    window.location.assign(`/book/confirmation/${encodeURIComponent(code)}`)
  })
}
