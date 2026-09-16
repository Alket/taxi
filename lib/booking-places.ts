import type { AirportWithCoords } from "@/lib/airports"
import type { Direction } from "@/lib/types"
import type { BookingLocation } from "@/lib/store/booking-store"

export type PlaceKind = "airport" | "zone"

export type BookingPlaceOption = {
  key: string
  kind: PlaceKind
  id: string
  label: string
  lat: number
  lng: number
}

export function airportPlaceKey(iata: string) {
  return `airport:${iata.toUpperCase()}`
}

export function zonePlaceKey(zoneId: string) {
  return `zone:${zoneId}`
}

export function parsePlaceKey(
  key: string | null | undefined,
): { kind: PlaceKind; id: string } | null {
  if (!key) return null
  if (key.startsWith("airport:")) {
    return { kind: "airport", id: key.slice("airport:".length) }
  }
  if (key.startsWith("zone:")) {
    return { kind: "zone", id: key.slice("zone:".length) }
  }
  return null
}

export function buildPlaceOptions(
  airports: AirportWithCoords[],
  zones: { id: string; name: string }[],
): BookingPlaceOption[] {
  const airportOpts = airports.map((a) => ({
    key: airportPlaceKey(a.iataCode),
    kind: "airport" as const,
    id: a.iataCode,
    label: `${a.name} (${a.iataCode})`,
    lat: a.lat,
    lng: a.lng,
  }))
  const zoneOpts = zones.map((z) => ({
    key: zonePlaceKey(z.id),
    kind: "zone" as const,
    id: z.id,
    label: z.name,
    // Zones have no coords; pricing is flat — use a stable Albania fallback.
    lat: 41.3275,
    lng: 19.8187,
  }))
  return [...airportOpts, ...zoneOpts]
}

export function deriveRouteFromPlaces(
  from: BookingPlaceOption,
  to: BookingPlaceOption,
  neighborMap?: Map<string, Set<string>>,
): {
  direction: Direction
  selectedAirportIata: string | null
  selectedZoneId: string
  selectedToZoneId: string | null
  pickup: BookingLocation
  dropoff: BookingLocation
} | null {
  if (from.key === to.key) return null

  const fromLoc: BookingLocation = {
    address: from.label,
    lat: from.lat,
    lng: from.lng,
  }
  const toLoc: BookingLocation = {
    address: to.label,
    lat: to.lat,
    lng: to.lng,
  }

  if (from.kind === "airport" && to.kind === "zone") {
    return {
      direction: "airport_to_dest",
      selectedAirportIata: from.id,
      selectedZoneId: to.id,
      selectedToZoneId: null,
      pickup: fromLoc,
      dropoff: toLoc,
    }
  }
  if (from.kind === "zone" && to.kind === "airport") {
    return {
      direction: "dest_to_airport",
      selectedAirportIata: to.id,
      selectedZoneId: from.id,
      selectedToZoneId: null,
      pickup: fromLoc,
      dropoff: toLoc,
    }
  }
  if (from.kind === "zone" && to.kind === "zone") {
    if (neighborMap && !(neighborMap.get(from.id)?.has(to.id) ?? false)) {
      return null
    }
    return {
      direction: "zone_to_zone",
      selectedAirportIata: null,
      selectedZoneId: from.id,
      selectedToZoneId: to.id,
      pickup: fromLoc,
      dropoff: toLoc,
    }
  }
  // Airport → airport not supported
  return null
}

export function placeKeyFromStore(args: {
  direction: Direction | null
  selectedAirportIata: string | null
  selectedZoneId: string | null
  selectedToZoneId: string | null
  end: "from" | "to"
}): string | null {
  const { direction, selectedAirportIata, selectedZoneId, selectedToZoneId, end } =
    args
  if (!direction || !selectedZoneId) return null

  if (direction === "zone_to_zone") {
    if (end === "from") return zonePlaceKey(selectedZoneId)
    return selectedToZoneId ? zonePlaceKey(selectedToZoneId) : null
  }
  if (direction === "airport_to_dest") {
    if (end === "from") {
      return selectedAirportIata ? airportPlaceKey(selectedAirportIata) : null
    }
    return zonePlaceKey(selectedZoneId)
  }
  // dest_to_airport
  if (end === "from") return zonePlaceKey(selectedZoneId)
  return selectedAirportIata ? airportPlaceKey(selectedAirportIata) : null
}

/** Active city↔city corridor edge (symmetric). */
export type CityCorridorPair = {
  zoneAId: string
  zoneBId: string
  /**
   * Vehicles with an active InterZoneFare for this pair.
   * Omitted/empty = legacy “any vehicle” (treat as linked for all).
   */
  vehicleTypes?: Array<"sedan" | "minivan">
}

/**
 * Bidirectional map: zoneId → set of connected zone ids.
 * When `vehicleType` is set, only corridors priced for that vehicle are included.
 */
export function buildCorridorNeighborMap(
  corridors: CityCorridorPair[],
  vehicleType?: "sedan" | "minivan" | null,
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  for (const { zoneAId, zoneBId, vehicleTypes } of corridors) {
    if (!zoneAId || !zoneBId || zoneAId === zoneBId) continue
    if (
      vehicleType &&
      vehicleTypes &&
      vehicleTypes.length > 0 &&
      !vehicleTypes.includes(vehicleType)
    ) {
      continue
    }
    let a = map.get(zoneAId)
    if (!a) {
      a = new Set()
      map.set(zoneAId, a)
    }
    a.add(zoneBId)
    let b = map.get(zoneBId)
    if (!b) {
      b = new Set()
      map.set(zoneBId, b)
    }
    b.add(zoneAId)
  }
  return map
}

/**
 * Filter place options for one end of the route.
 *
 * - Airports stay available opposite a city (and vice versa).
 * - City↔city: only zones linked by an active InterZoneFare corridor.
 * - When the opposite end is empty or an airport: all cities remain available.
 * - The opposite end's current place is still listed so the user can pick it to
 *   swap direction (e.g. Ksamil→Tirana → choose Tirana in From).
 */
export function filterPlacesForOppositeEnd(
  places: BookingPlaceOption[],
  oppositeKey: string | null | undefined,
  neighborMap: Map<string, Set<string>>,
): BookingPlaceOption[] {
  const opposite = parsePlaceKey(oppositeKey)
  const filtered = places.filter((place) => {
    // Opposite is appended below for swap — skip here to avoid duplicates.
    if (oppositeKey && place.key === oppositeKey) return false

    if (!opposite) return true

    if (place.kind === "airport") {
      // Airport ↔ airport is not supported.
      return opposite.kind !== "airport"
    }

    // place is a zone
    if (opposite.kind === "airport") return true

    // opposite is a zone → city corridor only
    return neighborMap.get(opposite.id)?.has(place.id) ?? false
  })

  if (oppositeKey) {
    const oppositePlace = places.find((p) => p.key === oppositeKey)
    if (oppositePlace) filtered.push(oppositePlace)
  }

  return filtered
}
