import type { VehicleType } from "@/lib/types"
import { prisma } from "@/lib/db"

export type LatLng = { lat: number; lng: number }

export type QuoteResult = {
  price: number
  distanceKm: number
  durationMin: number
  zoneId: string
  zoneName: string
  toZoneId?: string | null
  toZoneName?: string | null
}

export class UncoveredDestinationError extends Error {
  readonly code = "OUTSIDE_SERVICE_AREA" as const

  constructor(message = "Destination is outside the service area.") {
    super(message)
    this.name = "UncoveredDestinationError"
  }
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value
  return Number(value)
}

/** Canonical pair order so Sarandë↔Tirana City is one row either way. */
export function canonicalZonePair(
  zoneId1: string,
  zoneId2: string,
): { zoneAId: string; zoneBId: string } {
  if (zoneId1 === zoneId2) {
    throw new UncoveredDestinationError("Pickup and dropoff must be different.")
  }
  return zoneId1 < zoneId2
    ? { zoneAId: zoneId1, zoneBId: zoneId2 }
    : { zoneAId: zoneId2, zoneBId: zoneId1 }
}

export async function getActiveZone(zoneId: string) {
  const zone = await prisma.zone.findFirst({
    where: { id: zoneId, active: true },
    select: { id: true, name: true },
  })
  if (!zone) {
    throw new UncoveredDestinationError("Selected destination is not available.")
  }
  return zone
}

/** Flat zone fare for airport ↔ city: max(baseFare, minFare). */
export async function calculateQuoteForZone(
  zoneId: string,
  vehicleType: VehicleType,
): Promise<QuoteResult> {
  const zone = await getActiveZone(zoneId)

  const rule = await prisma.pricingRule.findFirst({
    where: {
      active: true,
      zoneId: zone.id,
      vehicleType,
    },
  })

  if (!rule) {
    throw new UncoveredDestinationError(
      "No pricing available for this destination and vehicle.",
    )
  }

  const baseFare = toNumber(rule.baseFare)
  const minFare = toNumber(rule.minFare)
  const price = Number(Math.max(baseFare, minFare).toFixed(2))

  return {
    price,
    distanceKm: 0,
    durationMin: 0,
    zoneId: zone.id,
    zoneName: zone.name,
    toZoneId: null,
    toZoneName: null,
  }
}

/** Symmetric city ↔ city corridor fare. */
export async function calculateQuoteForInterZone(
  fromZoneId: string,
  toZoneId: string,
  vehicleType: VehicleType,
): Promise<QuoteResult> {
  const [fromZone, toZone] = await Promise.all([
    getActiveZone(fromZoneId),
    getActiveZone(toZoneId),
  ])
  const { zoneAId, zoneBId } = canonicalZonePair(fromZone.id, toZone.id)

  const fare = await prisma.interZoneFare.findFirst({
    where: {
      active: true,
      zoneAId,
      zoneBId,
      vehicleType,
    },
  })

  if (!fare) {
    throw new UncoveredDestinationError(
      "No fare for this route.",
    )
  }

  const baseFare = toNumber(fare.baseFare)
  const minFare = toNumber(fare.minFare)
  const price = Number(Math.max(baseFare, minFare).toFixed(2))

  return {
    price,
    distanceKm: 0,
    durationMin: 0,
    zoneId: fromZone.id,
    zoneName: fromZone.name,
    toZoneId: toZone.id,
    toZoneName: toZone.name,
  }
}

export async function calculatePriceForZone(
  zoneId: string,
  vehicleType: VehicleType,
): Promise<number> {
  const quote = await calculateQuoteForZone(zoneId, vehicleType)
  return quote.price
}

export async function calculatePriceForInterZone(
  fromZoneId: string,
  toZoneId: string,
  vehicleType: VehicleType,
): Promise<number> {
  const quote = await calculateQuoteForInterZone(
    fromZoneId,
    toZoneId,
    vehicleType,
  )
  return quote.price
}

/** @deprecated Prefer calculateQuoteForZone — kept for any residual call sites. */
export async function calculateQuote(
  _pickupCoords: LatLng,
  _dropoffCoords: LatLng,
  vehicleType: VehicleType,
  zoneId?: string,
): Promise<QuoteResult> {
  if (!zoneId) {
    throw new UncoveredDestinationError(
      "A destination zone is required to calculate a quote.",
    )
  }
  return calculateQuoteForZone(zoneId, vehicleType)
}

/** @deprecated Prefer calculatePriceForZone */
export async function calculatePrice(
  _pickupCoords: LatLng,
  _dropoffCoords: LatLng,
  vehicleType: VehicleType,
  zoneId?: string,
): Promise<number> {
  if (!zoneId) {
    throw new UncoveredDestinationError(
      "A destination zone is required to calculate a price.",
    )
  }
  return calculatePriceForZone(zoneId, vehicleType)
}
