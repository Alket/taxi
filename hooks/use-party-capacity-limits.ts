"use client"

import * as React from "react"
import useSWR from "swr"

import { fetcher } from "@/lib/api"
import { useBookingStore } from "@/lib/store/booking-store"
import {
  clampPartyToLimits,
  DEFAULT_VEHICLE_CAPACITIES,
  normalizeVehicleCapacities,
  partyStepperLimits,
  type VehicleCapacityConfig,
} from "@/lib/vehicles"

type BookingConfigCapacities = {
  vehicleCapacities?: VehicleCapacityConfig
}

/**
 * Marketing / booking stepper ceilings from admin Rules.
 * Also clamps the store if a persisted party exceeds the current max.
 */
export function usePartyCapacityLimits() {
  const { data: config } = useSWR<BookingConfigCapacities>(
    "/api/booking/config",
    fetcher,
  )
  const passengerCount = useBookingStore((s) => s.passengerCount)
  const luggageCount = useBookingStore((s) => s.luggageCount)
  const patch = useBookingStore((s) => s.patch)

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

  const limits = React.useMemo(
    () => partyStepperLimits(capacities),
    [capacities],
  )

  React.useEffect(() => {
    const next = clampPartyToLimits(passengerCount, luggageCount, limits)
    if (
      next.passengerCount !== passengerCount ||
      next.luggageCount !== luggageCount
    ) {
      patch(next)
    }
  }, [limits, passengerCount, luggageCount, patch])

  return { ...limits, capacities, ready: Boolean(config) }
}
