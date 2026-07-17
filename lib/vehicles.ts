import type { VehicleType } from "@/lib/types"

export type VehicleCatalogEntry = {
  type: VehicleType
  label: string
  description: string
  seats: number
  luggage: number
  icon: "sedan" | "comfort" | "minivan" | "premium"
}

export const VEHICLE_CATALOG: VehicleCatalogEntry[] = [
  {
    type: "sedan",
    label: "Sedan",
    description: "Efficient airport run for small groups",
    seats: 3,
    luggage: 2,
    icon: "sedan",
  },
  {
    type: "comfort",
    label: "Comfort",
    description: "Extra space and a smoother ride",
    seats: 3,
    luggage: 3,
    icon: "comfort",
  },
  {
    type: "minivan",
    label: "Minivan",
    description: "Best for families and larger parties",
    seats: 6,
    luggage: 6,
    icon: "minivan",
  },
  {
    type: "premium",
    label: "Premium",
    description: "Executive vehicle with elevated finish",
    seats: 3,
    luggage: 3,
    icon: "premium",
  },
]

export function getVehicleCatalog(type: VehicleType) {
  return VEHICLE_CATALOG.find((entry) => entry.type === type)
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
): VehicleType {
  const fitting = VEHICLE_CATALOG.filter(
    (entry) => entry.seats >= passengers && entry.luggage >= luggage,
  )

  const candidates =
    fitting.length > 0
      ? fitting
      : [VEHICLE_CATALOG.find((entry) => entry.type === "minivan")!].filter(
          Boolean,
        )

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
): {
  vehicleType: VehicleType
  quotedPrice: number | null
  quotedDistanceKm: number | null
} {
  const vehicleType = suggestVehicleType(passengers, luggage, vehicleQuotes)
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
): string | null {
  const selectedEntry = selected ? getVehicleCatalog(selected) : null

  if (passengers >= 5) {
    if (selected !== "minivan") {
      return "Minivan recommended for 5+ passengers"
    }
  }

  if (selectedEntry) {
    if (passengers > selectedEntry.seats && selected !== "minivan") {
      return `Minivan recommended for ${passengers} passengers (${selectedEntry.label} seats ${selectedEntry.seats})`
    }
    if (luggage > selectedEntry.luggage) {
      const better = VEHICLE_CATALOG.find(
        (entry) =>
          entry.luggage >= luggage && entry.seats >= passengers,
      )
      if (better && better.type !== selected) {
        return `${better.label} recommended for ${luggage} bags`
      }
      return `This vehicle holds up to ${selectedEntry.luggage} bags`
    }
  } else if (luggage >= 5) {
    return "Minivan recommended for 5+ bags"
  }

  return null
}
