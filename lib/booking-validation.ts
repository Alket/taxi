import { isPickupTooSoon, pickupLeadTimeMessage } from "@/lib/pickup-lead-time"
import {
  FLIGHT_NUMBER_RE,
  normalizeFlightNumber,
} from "@/lib/booking-details"
import type { BookingState } from "@/lib/store/booking-store"
import { VEHICLE_TYPES } from "@/lib/store/booking-store"
import type { BookingFieldId } from "@/lib/booking-field-focus"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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
    return { field: "destination", message: "Choose From and To." }
  }

  if (!state.selectedZoneId) {
    return { field: "destination", message: "Select From and To." }
  }

  if (state.direction === "zone_to_zone") {
    if (!state.selectedToZoneId) {
      return { field: "destination", message: "Select a dropoff city." }
    }
  } else if (!state.selectedAirportIata) {
    return { field: "destination", message: "Select an airport end for this trip." }
  }

  if (!state.pickup.address.trim() || !state.dropoff.address.trim()) {
    return { field: "destination", message: "Select From and To." }
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
      message: "This route isn't in our service area.",
    }
  }

  if (state.quoteStatus === "error") {
    return {
      field: "quote",
      message: state.quoteError ?? "Couldn't load prices.",
    }
  }

  if (!hasSuccessfulQuotes(state)) {
    return { field: "quote", message: "Select From and To to get a price." }
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

  if (state.direction !== "zone_to_zone") {
    const flight = state.flightNumber.trim()
    if (!flight) {
      return {
        field: "flightNumber",
        message: "Enter your flight number.",
      }
    }
    if (!FLIGHT_NUMBER_RE.test(normalizeFlightNumber(flight))) {
      return {
        field: "flightNumber",
        message: "Enter a valid flight number (e.g. LH1445 or EAF654).",
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

  if (state.bookedForOther) {
    if (!state.passengerName.trim() || state.passengerName.trim().length < 2) {
      return {
        field: "passengerName",
        message: "Enter the passenger's full name.",
      }
    }
    if (!state.passengerNoEmail) {
      if (
        !state.passengerEmail.trim() ||
        !EMAIL_RE.test(state.passengerEmail.trim())
      ) {
        return {
          field: "passengerEmail",
          message: "Enter a valid passenger email.",
        }
      }
    }
    if (
      !state.passengerPhone.trim() ||
      state.passengerPhone.replace(/\D/g, "").length < 8
    ) {
      return {
        field: "passengerPhone",
        message: "Enter a valid passenger phone number.",
      }
    }
    if (!state.bookerRelation) {
      return {
        field: "bookerRelation",
        message: "Select your relation with the passenger.",
      }
    }
  }

  return null
}
