import { z } from "zod"

import type { VehicleType } from "@/lib/types"

export type VehicleCatalogEntry = {
  type: VehicleType
  label: string
  description: string
  seats: number
  luggage: number
  icon: "sedan" | "minivan"
}

export type VehicleCapacityConfig = Record<
  VehicleType,
  { seats: number; luggage: number }
>

/** Allowed vehicle types for booking / pricing APIs (Zod allowlist). */
export const VEHICLE_TYPE_VALUES = ["sedan", "minivan"] as const

export const vehicleTypeSchema = z.enum(VEHICLE_TYPE_VALUES)

export const DEFAULT_VEHICLE_CAPACITIES: VehicleCapacityConfig = {
  sedan: { seats: 3, luggage: 2 },
  minivan: { seats: 6, luggage: 6 },
}

const VEHICLE_META: Record<
  VehicleType,
  { label: string; description: string; icon: "sedan" | "minivan" }
> = {
  sedan: {
    label: "Sedan",
    description: "Efficient airport run for small groups",
    icon: "sedan",
  },
  minivan: {
    label: "Minivan",
    description: "Best for families and larger parties",
    icon: "minivan",
  },
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.round(parsed)))
}

/** Normalize admin/public capacity payloads with safe bounds. */
export function normalizeVehicleCapacities(
  input?: Partial<
    Record<VehicleType, Partial<{ seats: number; luggage: number }>>
  > | null,
): VehicleCapacityConfig {
  return {
    sedan: {
      seats: clampInt(
        input?.sedan?.seats,
        1,
        20,
        DEFAULT_VEHICLE_CAPACITIES.sedan.seats,
      ),
      luggage: clampInt(
        input?.sedan?.luggage,
        0,
        30,
        DEFAULT_VEHICLE_CAPACITIES.sedan.luggage,
      ),
    },
    minivan: {
      seats: clampInt(
        input?.minivan?.seats,
        1,
        20,
        DEFAULT_VEHICLE_CAPACITIES.minivan.seats,
      ),
      luggage: clampInt(
        input?.minivan?.luggage,
        0,
        30,
        DEFAULT_VEHICLE_CAPACITIES.minivan.luggage,
      ),
    },
  }
}

export function vehicleCapacitiesFromSettingsRow(row: {
  sedanSeats?: number | null
  sedanLuggage?: number | null
  minivanSeats?: number | null
  minivanLuggage?: number | null
}): VehicleCapacityConfig {
  return normalizeVehicleCapacities({
    sedan: {
      seats: row.sedanSeats ?? undefined,
      luggage: row.sedanLuggage ?? undefined,
    },
    minivan: {
      seats: row.minivanSeats ?? undefined,
      luggage: row.minivanLuggage ?? undefined,
    },
  })
}

export function buildVehicleCatalog(
  capacities: VehicleCapacityConfig = DEFAULT_VEHICLE_CAPACITIES,
): VehicleCatalogEntry[] {
  const caps = normalizeVehicleCapacities(capacities)
  return VEHICLE_TYPE_VALUES.map((type) => ({
    type,
    label: VEHICLE_META[type].label,
    description: VEHICLE_META[type].description,
    seats: caps[type].seats,
    luggage: caps[type].luggage,
    icon: VEHICLE_META[type].icon,
  }))
}

/** Default catalog (hard-coded fallbacks). Prefer buildVehicleCatalog(settings). */
export const VEHICLE_CATALOG: VehicleCatalogEntry[] = buildVehicleCatalog()

export function getVehicleCatalog(
  type: VehicleType,
  capacities: VehicleCapacityConfig = DEFAULT_VEHICLE_CAPACITIES,
) {
  return buildVehicleCatalog(capacities).find((entry) => entry.type === type)
}

export function round2(value: number) {
  return Number(value.toFixed(2))
}

/** One-way quote → displayed trip total (round-trip + optional discount). */
export function computeTripTotal(
  oneWayPrice: number,
  isRoundTrip: boolean,
  roundTripDiscountPercent = 0,
) {
  if (!isRoundTrip) return round2(oneWayPrice)
  const combined = oneWayPrice * 2
  const discount = Math.min(
    100,
    Math.max(0, roundTripDiscountPercent),
  )
  return round2(combined * (1 - discount / 100))
}

/**
 * Pick the smallest vehicle that fits passengers + luggage.
 * When quotes are available, prefer the cheapest fitting option.
 */
export function suggestVehicleType(
  passengers: number,
  luggage: number,
  quotes?: Partial<Record<VehicleType, { price: number }>>,
  capacities: VehicleCapacityConfig = DEFAULT_VEHICLE_CAPACITIES,
): VehicleType {
  const catalog = buildVehicleCatalog(capacities)
  const fitting = catalog.filter(
    (entry) => entry.seats >= passengers && entry.luggage >= luggage,
  )

  const candidates =
    fitting.length > 0
      ? fitting
      : [catalog.find((entry) => entry.type === "minivan")!].filter(Boolean)

  if (quotes) {
    let best: VehicleType | null = null
    let bestPrice = Number.POSITIVE_INFINITY
    for (const entry of candidates) {
      const quote = quotes[entry.type]
      if (quote != null && quote.price < bestPrice) {
        bestPrice = quote.price
        best = entry.type
      }
    }
    if (best) return best
  }

  return candidates[0]?.type ?? "sedan"
}

export function autoSelectVehiclePatch(
  passengers: number,
  luggage: number,
  vehicleQuotes: Partial<
    Record<VehicleType, { price: number; distanceKm: number }>
  >,
  isRoundTrip: boolean,
  roundTripDiscountPercent = 0,
  capacities: VehicleCapacityConfig = DEFAULT_VEHICLE_CAPACITIES,
): {
  vehicleType: VehicleType
  quotedPrice: number | null
  quotedDistanceKm: number | null
} {
  const vehicleType = suggestVehicleType(
    passengers,
    luggage,
    vehicleQuotes,
    capacities,
  )
  const quote = vehicleQuotes[vehicleType]
  return {
    vehicleType,
    quotedPrice:
      quote == null
        ? null
        : computeTripTotal(quote.price, isRoundTrip, roundTripDiscountPercent),
    quotedDistanceKm: quote?.distanceKm ?? null,
  }
}

export function capacitySuggestion(
  passengers: number,
  luggage: number,
  selected: VehicleType | null,
  capacities: VehicleCapacityConfig = DEFAULT_VEHICLE_CAPACITIES,
): string | null {
  const catalog = buildVehicleCatalog(capacities)
  const selectedEntry = selected
    ? catalog.find((entry) => entry.type === selected)
    : null
  const minivanSeats = capacities.minivan.seats

  if (passengers > capacities.sedan.seats) {
    if (selected !== "minivan") {
      return `Minivan recommended for ${passengers}+ passengers`
    }
  }

  if (selectedEntry) {
    if (passengers > selectedEntry.seats && selected !== "minivan") {
      return `Minivan recommended for ${passengers} passengers (${selectedEntry.label} seats ${selectedEntry.seats})`
    }
    if (luggage > selectedEntry.luggage) {
      const better = catalog.find(
        (entry) =>
          entry.luggage >= luggage && entry.seats >= passengers,
      )
      if (better && better.type !== selected) {
        return `${better.label} recommended for ${luggage} bags`
      }
      return `This vehicle holds up to ${selectedEntry.luggage} bags`
    }
  } else if (luggage > capacities.sedan.luggage) {
    return `Minivan recommended for ${luggage}+ bags`
  }

  if (passengers > minivanSeats && selected === "minivan") {
    return `Minivan seats up to ${minivanSeats} passengers`
  }

  return null
}

export function partyStepperLimits(
  capacities: VehicleCapacityConfig = DEFAULT_VEHICLE_CAPACITIES,
): { maxPassengers: number; maxLuggage: number } {
  const caps = normalizeVehicleCapacities(capacities)
  return {
    // Stepper ceiling = largest vehicle we offer (never below 1 / 0).
    maxPassengers: Math.max(1, caps.sedan.seats, caps.minivan.seats),
    maxLuggage: Math.max(0, caps.sedan.luggage, caps.minivan.luggage),
  }
}

/** Clamp party size into the Rules-driven stepper range. */
export function clampPartyToLimits(
  passengers: number,
  luggage: number,
  limits: { maxPassengers: number; maxLuggage: number },
) {
  return {
    passengerCount: Math.min(
      limits.maxPassengers,
      Math.max(1, Math.round(passengers) || 1),
    ),
    luggageCount: Math.min(
      limits.maxLuggage,
      Math.max(0, Math.round(luggage) || 0),
    ),
  }
}

/** Server-side guard: reject parties that exceed the selected vehicle. */
export function assertVehicleFitsParty(
  vehicleType: VehicleType,
  passengers: number,
  luggage: number,
  capacities: VehicleCapacityConfig = DEFAULT_VEHICLE_CAPACITIES,
) {
  const caps = normalizeVehicleCapacities(capacities)[vehicleType]
  const label = VEHICLE_META[vehicleType].label
  if (passengers > caps.seats) {
    throw new Error(
      `${label} seats up to ${caps.seats} passenger${caps.seats === 1 ? "" : "s"}.`,
    )
  }
  if (luggage > caps.luggage) {
    throw new Error(
      `${label} holds up to ${caps.luggage} bag${caps.luggage === 1 ? "" : "s"}.`,
    )
  }
}
