import type { VehicleType } from "@/lib/types"
import { prisma } from "@/lib/db"

export type LatLng = { lat: number; lng: number }

export type QuoteResult = {
  price: number
  distanceKm: number
  durationMin: number
  zoneId: string
  zoneName: string
}

/** Destinations farther than this from the nearest zone centroid are uncovered. */
export const MAX_ZONE_RADIUS_KM = 80

/** Average road speed used to estimate duration from haversine distance. */
const AVG_SPEED_KMH = 55

export class UncoveredDestinationError extends Error {
  readonly code = "OUTSIDE_SERVICE_AREA" as const

  constructor(message = "Destination is outside the service area.") {
    super(message)
    this.name = "UncoveredDestinationError"
  }
}

const EARTH_RADIUS_KM = 6371

function toRad(value: number) {
  return (value * Math.PI) / 180
}

export function haversineKm(a: LatLng, b: LatLng) {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)

  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const sinDLat = Math.sin(dLat / 2)
  const sinDLng = Math.sin(dLng / 2)

  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value
  return Number(value)
}

export async function resolveZone(lat: number, lng: number) {
  const { zone } = await findNearestZone(lat, lng)
  return zone
}

async function findNearestZone(lat: number, lng: number) {
  const zones = await prisma.zone.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      centroidLat: true,
      centroidLng: true,
      active: true,
    },
  })

  if (zones.length === 0) {
    throw new Error("No active zones configured.")
  }

  let best = zones[0]
  let bestDistance = haversineKm(
    { lat, lng },
    { lat: zones[0].centroidLat, lng: zones[0].centroidLng },
  )

  for (let i = 1; i < zones.length; i++) {
    const z = zones[i]
    const d = haversineKm(
      { lat, lng },
      { lat: z.centroidLat, lng: z.centroidLng },
    )
    if (d < bestDistance) {
      best = z
      bestDistance = d
    }
  }

  return { zone: best, distanceKm: bestDistance }
}

export async function resolveCoveredZone(lat: number, lng: number) {
  const { zone, distanceKm } = await findNearestZone(lat, lng)
  if (distanceKm > MAX_ZONE_RADIUS_KM) {
    throw new UncoveredDestinationError()
  }
  return zone
}

// NOTE: `dropoffCoords` is expected to be the non-airport end.
export async function calculatePrice(
  pickupCoords: LatLng,
  dropoffCoords: LatLng,
  vehicleType: VehicleType,
): Promise<number> {
  const quote = await calculateQuote(pickupCoords, dropoffCoords, vehicleType)
  return quote.price
}

export async function calculateQuote(
  pickupCoords: LatLng,
  dropoffCoords: LatLng,
  vehicleType: VehicleType,
): Promise<QuoteResult> {
  const zone = await resolveCoveredZone(dropoffCoords.lat, dropoffCoords.lng)

  const rule = await prisma.pricingRule.findFirst({
    where: {
      active: true,
      zoneId: zone.id,
      vehicleType,
    },
  })

  if (!rule) {
    throw new UncoveredDestinationError(
      `No pricing available for this destination and vehicle.`,
    )
  }

  const distanceKm = haversineKm(pickupCoords, dropoffCoords)
  const baseFare = toNumber(rule.baseFare)
  const perKmRate = toNumber(rule.perKmRate)
  const minFare = toNumber(rule.minFare)

  const computed = baseFare + perKmRate * distanceKm
  const price = Number(Math.max(computed, minFare).toFixed(2))
  const durationMin = Math.max(1, Math.round((distanceKm / AVG_SPEED_KMH) * 60))

  return {
    price,
    distanceKm: Number(distanceKm.toFixed(2)),
    durationMin,
    zoneId: zone.id,
    zoneName: zone.name,
  }
}
