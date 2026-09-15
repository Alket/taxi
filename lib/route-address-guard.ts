import type { AirportEntry } from "@/lib/types"

/**
 * Bind free-text pickup/dropoff to the priced zone/airport labels.
 * Zones have no geometry — public UI sets addresses from place labels, so we
 * require an exact normalized match (not a substring) to stop cheap-zone fraud.
 */

export class RouteAddressMismatchError extends Error {
  readonly code = "ROUTE_ADDRESS_MISMATCH" as const

  constructor(
    message = "Pickup and dropoff must match the selected route places.",
  ) {
    super(message)
    this.name = "RouteAddressMismatchError"
  }
}

export function normalizePlaceText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/** Exact place match after normalization (e.g. "Sarandë" ≡ "sarande"). */
export function addressEqualsPlace(address: string, placeName: string): boolean {
  const hay = normalizePlaceText(address)
  const needle = normalizePlaceText(placeName)
  if (!hay || !needle) return false
  return hay === needle
}

/**
 * Airport labels from the UI are `${name} (${iata})`. Require both the name
 * tokens and the IATA code as whole tokens — never a bare "Airport" word.
 */
export function addressMatchesAirport(
  address: string,
  airport: AirportEntry,
): boolean {
  const hay = normalizePlaceText(address)
  if (!hay) return false
  const iata = normalizePlaceText(airport.iataCode)
  const name = normalizePlaceText(airport.name)
  if (!iata || iata.length !== 3) return false

  const tokens = new Set(hay.split(/\s+/).filter(Boolean))
  if (!tokens.has(iata)) return false

  const expectedLabel = normalizePlaceText(
    `${airport.name} (${airport.iataCode})`,
  )
  if (hay === expectedLabel) return true

  if (!name) return false
  const nameTokens = name.split(/\s+/).filter(Boolean)
  return nameTokens.every((t) => tokens.has(t))
}

export function assertAddressesMatchPricedRoute(args: {
  direction: "airport_to_dest" | "dest_to_airport" | "zone_to_zone"
  pickupAddress: string
  dropoffAddress: string
  fromZoneName: string
  toZoneName?: string | null
  /** Required airport for airport↔zone legs — address must match this one only. */
  requiredAirport?: AirportEntry | null
}): void {
  const {
    direction,
    pickupAddress,
    dropoffAddress,
    fromZoneName,
    toZoneName,
    requiredAirport,
  } = args

  if (direction === "zone_to_zone") {
    if (!toZoneName) {
      throw new RouteAddressMismatchError(
        "City corridor booking is missing destination city.",
      )
    }
    if (!addressEqualsPlace(pickupAddress, fromZoneName)) {
      throw new RouteAddressMismatchError(
        `Pickup must be exactly the selected city (${fromZoneName}).`,
      )
    }
    if (!addressEqualsPlace(dropoffAddress, toZoneName)) {
      throw new RouteAddressMismatchError(
        `Dropoff must be exactly the selected city (${toZoneName}).`,
      )
    }
    return
  }

  if (!requiredAirport) {
    throw new RouteAddressMismatchError(
      "Select an airport for this route.",
    )
  }

  if (direction === "airport_to_dest") {
    if (!addressMatchesAirport(pickupAddress, requiredAirport)) {
      throw new RouteAddressMismatchError(
        `Pickup must be ${requiredAirport.name} (${requiredAirport.iataCode}).`,
      )
    }
    if (!addressEqualsPlace(dropoffAddress, fromZoneName)) {
      throw new RouteAddressMismatchError(
        `Dropoff must be exactly the selected destination (${fromZoneName}).`,
      )
    }
    return
  }

  // dest_to_airport
  if (!addressEqualsPlace(pickupAddress, fromZoneName)) {
    throw new RouteAddressMismatchError(
      `Pickup must be exactly the selected city (${fromZoneName}).`,
    )
  }
  if (!addressMatchesAirport(dropoffAddress, requiredAirport)) {
    throw new RouteAddressMismatchError(
      `Dropoff must be ${requiredAirport.name} (${requiredAirport.iataCode}).`,
    )
  }
}
