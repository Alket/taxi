"use client"

import * as React from "react"
import useSWR from "swr"

import { fetcher } from "@/lib/api"
import { useBookingStore } from "@/lib/store/booking-store"
import type { VehicleType } from "@/lib/types"
import {
  clampPartyToLimits,
  DEFAULT_VEHICLE_CAPACITIES,
  getEnabledVehicleTypes,
  normalizeVehicleCapacities,
  partyStepperLimits,
  VEHICLE_TYPE_VALUES,
  type VehicleCapacityConfig,
} from "@/lib/vehicles"

type BookingConfigCapacities = {
  vehicleCapacities?: VehicleCapacityConfig
  enabledVehicleTypes?: VehicleType[]
  sedanEnabled?: boolean
  minivanEnabled?: boolean
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

  const enabledTypes = React.useMemo(() => {
    if (config?.enabledVehicleTypes?.length) {
      return config.enabledVehicleTypes.filter((type): type is VehicleType =>
        (VEHICLE_TYPE_VALUES as readonly string[]).includes(type),
      )
    }
    return getEnabledVehicleTypes({
      sedanEnabled: config?.sedanEnabled,
      minivanEnabled: config?.minivanEnabled,
    })
  }, [
    config?.enabledVehicleTypes,
    config?.sedanEnabled,
    config?.minivanEnabled,
  ])

  const limits = React.useMemo(
    () => partyStepperLimits(capacities, enabledTypes),
    [capacities, enabledTypes],
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

  return {
    ...limits,
    capacities,
    enabledTypes,
    ready: Boolean(config),
  }
}
