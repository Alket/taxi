import type { AirportEntry } from "@/lib/types"

/** Known airport coordinates keyed by IATA. Used until Settings store lat/lng. */
const AIRPORT_COORDS: Record<string, { lat: number; lng: number }> = {
  TIA: { lat: 41.414742, lng: 19.720544 }, // Tirana International
  MXP: { lat: 45.6306, lng: 8.7281 },
  LIN: { lat: 45.4451, lng: 9.2767 },
  BGY: { lat: 45.6739, lng: 9.7042 },
}

export type AirportWithCoords = AirportEntry & {
  lat: number
  lng: number
}

export function withAirportCoords(
  airports: AirportEntry[],
): AirportWithCoords[] {
  return airports
    .map((airport) => {
      const coords = AIRPORT_COORDS[airport.iataCode.toUpperCase()]
      if (!coords) return null
      return {
        ...airport,
        iataCode: airport.iataCode.toUpperCase(),
        lat: coords.lat,
        lng: coords.lng,
      }
    })
    .filter((a): a is AirportWithCoords => a !== null)
}

export function resolveAirportLocation(
  airports: AirportEntry[],
  iataCode: string | null,
): AirportWithCoords | null {
  const withCoords = withAirportCoords(airports)
  if (withCoords.length === 0) return null

  if (iataCode) {
    const match = withCoords.find(
      (a) => a.iataCode === iataCode.toUpperCase(),
    )
    if (match) return match
  }

  const tirana = withCoords.find((a) => a.iataCode === "TIA")
  return tirana ?? withCoords[0]
}
