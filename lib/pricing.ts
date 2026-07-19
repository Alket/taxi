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

/** Flat zone fare: max(baseFare, minFare). Distance is not used after zone lat/lng removal. */
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
  }
}

export async function calculatePriceForZone(
  zoneId: string,
  vehicleType: VehicleType,
): Promise<number> {
  const quote = await calculateQuoteForZone(zoneId, vehicleType)
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
