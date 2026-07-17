"use client"

import * as React from "react"

import { autoSelectVehiclePatch } from "@/lib/vehicles"
import { useBookingStore } from "@/lib/store/booking-store"

/** Keeps vehicleType + quotedPrice in sync with party size and quotes. */
export function useAutoSelectVehicle(roundTripDiscountPercent = 0) {
  const quoteStatus = useBookingStore((s) => s.quoteStatus)
  const vehicleQuotes = useBookingStore((s) => s.vehicleQuotes)
  const passengerCount = useBookingStore((s) => s.passengerCount)
  const luggageCount = useBookingStore((s) => s.luggageCount)
  const isRoundTrip = useBookingStore((s) => s.isRoundTrip)
  const patch = useBookingStore((s) => s.patch)

  React.useEffect(() => {
    if (quoteStatus !== "success") return

    const next = autoSelectVehiclePatch(
      passengerCount,
      luggageCount,
      vehicleQuotes,
      isRoundTrip,
      roundTripDiscountPercent,
    )

    const state = useBookingStore.getState()
    if (
      state.vehicleType === next.vehicleType &&
      state.quotedPrice === next.quotedPrice &&
      state.quotedDistanceKm === next.quotedDistanceKm
    ) {
      return
    }

    patch(next)
  }, [
    quoteStatus,
    vehicleQuotes,
    passengerCount,
    luggageCount,
    isRoundTrip,
    roundTripDiscountPercent,
    patch,
  ])
}
