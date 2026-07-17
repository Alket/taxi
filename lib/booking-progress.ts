import {
  canProceedToStep,
  type BookingState,
  type BookingStep,
} from "@/lib/store/booking-store"

/** True once the customer has entered anything worth protecting from accidental leave. */
export function hasBookingProgress(state: BookingState): boolean {
  if (state.currentStep > 1) return true
  if (state.createdBookingId) return true
  if (state.pickup.address.trim() || state.dropoff.address.trim()) return true
  if (state.pickupDateTime) return true
  if (state.vehicleType) return true
  if (state.selectedAirportIata) return true
  if (
    state.customer.name.trim() ||
    state.customer.email.trim() ||
    state.customer.phone.trim()
  ) {
    return true
  }
  if (state.flightNumber.trim()) return true
  if (state.quoteStatus === "success" || state.quoteStatus === "loading") {
    return true
  }
  return false
}

export function parseBookingStep(
  value: string | null | undefined,
): BookingStep | null {
  if (!value) return null
  const n = Number.parseInt(value, 10)
  if (n === 1 || n === 2) return n
  // Legacy deep links from the old 4-step wizard.
  if (n === 3) return 1
  if (n === 4) return 2
  return null
}

/** Highest step the current draft is allowed to open. */
export function maxReachableStep(state: BookingState): BookingStep {
  if (canProceedToStep(state, 2)) return 2
  return 1
}

/** Shared class for native datetime-local fields on narrow viewports. */
export const DATETIME_LOCAL_CLASSNAME =
  "w-full min-w-0 max-w-full appearance-none [&::-webkit-calendar-picker-indicator]:mr-0.5 [&::-webkit-calendar-picker-indicator]:h-5 [&::-webkit-calendar-picker-indicator]:w-5 [&::-webkit-datetime-edit]:min-w-0"
