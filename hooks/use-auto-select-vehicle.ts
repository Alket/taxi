"use client"

import * as React from "react"
import useSWR from "swr"

import { fetcher } from "@/lib/api"
import {
  autoSelectVehiclePatch,
  DEFAULT_VEHICLE_CAPACITIES,
  normalizeVehicleCapacities,
  type VehicleCapacityConfig,
} from "@/lib/vehicles"
import { useBookingStore } from "@/lib/store/booking-store"

type BookingConfigCapacities = {
  vehicleCapacities?: VehicleCapacityConfig
}

/** Keeps vehicleType + quotedPrice in sync with party size and quotes. */
export function useAutoSelectVehicle(roundTripDiscountPercent = 0) {
  const { data: config } = useSWR<BookingConfigCapacities>(
    "/api/booking/config",
    fetcher,
  )
  const capacities = React.useMemo(
    () =>
      normalizeVehicleCapacities(
        config?.vehicleCapacities ?? DEFAULT_VEHICLE_CAPACITIES,
      ),
    [
      config?.vehicleCapacities?.sedan?.seats,
      config?.vehicleCapacities?.sedan?.luggage,
      config?.vehicleCapacities?.minivan?.seats,
      config?.vehicleCapacities?.minivan?.luggage,
    ],
  )

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
      capacities,
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
    capacities,
    patch,
  ])
}
