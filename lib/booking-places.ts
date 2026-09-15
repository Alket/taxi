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
