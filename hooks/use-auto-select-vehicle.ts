"use client"

import * as React from "react"
import useSWR from "swr"

import { fetcher } from "@/lib/api"
import {
  autoSelectVehiclePatch,
  DEFAULT_VEHICLE_CAPACITIES,
  getEnabledVehicleTypes,
  normalizeVehicleCapacities,
  VEHICLE_TYPE_VALUES,
  type VehicleCapacityConfig,
} from "@/lib/vehicles"
import type { VehicleType } from "@/lib/types"
import { useBookingStore } from "@/lib/store/booking-store"

type BookingConfigCapacities = {
  vehicleCapacities?: VehicleCapacityConfig
  enabledVehicleTypes?: VehicleType[]
  sedanEnabled?: boolean
  minivanEnabled?: boolean
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
      enabledTypes,
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
    enabledTypes,
    patch,
  ])
}
