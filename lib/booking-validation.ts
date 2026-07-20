import { isPickupTooSoon, pickupLeadTimeMessage } from "@/lib/pickup-lead-time"
import type { BookingLocation, BookingState } from "@/lib/store/booking-store"
import { VEHICLE_TYPES } from "@/lib/store/booking-store"
import type { BookingFieldId } from "@/lib/booking-field-focus"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function hasLocation(location: BookingLocation) {
  return (
    location.address.trim().length > 0 &&
    location.lat !== null &&
    location.lng !== null &&
    Number.isFinite(location.lat) &&
    Number.isFinite(location.lng)
  )
}

function hasSuccessfulQuotes(state: BookingState) {
  if (state.quoteStatus !== "success") return false
  return VEHICLE_TYPES.some((type) => {
    const quote = state.vehicleQuotes[type]
    return quote != null && quote.price >= 0
  })
}

/** First missing/invalid field on step 1, in top-to-bottom order. */
export function getFirstInvalidBookingField(
  state: BookingState,
): { field: BookingFieldId; message: string } | null {
  if (!state.direction) {
    return { field: "destination", message: "Choose a transfer direction." }
  }

  const airportEnd =
    state.direction === "airport_to_dest" ? state.pickup : state.dropoff
  const destinationEnd =
    state.direction === "airport_to_dest" ? state.dropoff : state.pickup

  if (!state.selectedAirportIata || !hasLocation(airportEnd)) {
    return { field: "destination", message: "Select an airport." }
  }

  if (!state.selectedZoneId || !destinationEnd.address.trim()) {
    return { field: "destination", message: "Select a destination." }
  }

  if (!state.pickupDateTime) {
    return { field: "pickupDateTime", message: "Select pickup date & time." }
  }

  if (isPickupTooSoon(state.pickupDateTime)) {
    return { field: "pickupDateTime", message: pickupLeadTimeMessage() }
  }

  if (state.quoteStatus === "loading") {
    return { field: "quote", message: "Prices are still loading." }
  }

  if (state.quoteStatus === "uncovered") {
    return {
      field: "quote",
      message: "This destination isn't in our service area.",
    }
  }

  if (state.quoteStatus === "error") {
    return {
      field: "quote",
      message: state.quoteError ?? "Couldn't load prices.",
    }
  }

  if (!hasSuccessfulQuotes(state)) {
    return { field: "quote", message: "Select a destination to get a price." }
  }

  if (state.vehicleType === null || state.quotedPrice === null || state.quotedPrice < 0) {
    return { field: "quote", message: "Waiting for your trip price." }
  }

  if (state.isRoundTrip && !state.returnDateTime) {
    return { field: "returnDateTime", message: "Select a return date & time." }
  }

  if (state.isRoundTrip && state.returnDateTime && state.pickupDateTime) {
    const pickupMs = new Date(state.pickupDateTime).getTime()
    const returnMs = new Date(state.returnDateTime).getTime()
    if (
      !Number.isNaN(pickupMs) &&
      !Number.isNaN(returnMs) &&
      returnMs <= pickupMs
    ) {
      return {
        field: "returnDateTime",
        message: "Return date must be after your pickup.",
      }
    }
  }

  const flight = state.flightNumber.trim()
  if (flight) {
    const normalized = flight.replace(/[\s-]/g, "").toUpperCase()
    if (!/^[A-Z]{2}\d{1,4}$/.test(normalized)) {
      return {
        field: "flightNumber",
        message: "Enter a valid flight number (e.g. LH1445).",
      }
    }
  }

  const { name, email, phone } = state.customer
  if (!name.trim() || name.trim().length < 2) {
    return { field: "name", message: "Enter your full name." }
  }
  if (!email.trim() || !EMAIL_RE.test(email.trim())) {
    return { field: "email", message: "Enter a valid email address." }
  }
  if (!phone.trim() || phone.replace(/\D/g, "").length < 8) {
    return { field: "phone", message: "Enter a valid phone number." }
  }

  return null
}
