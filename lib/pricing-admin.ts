import type { InterZoneFare, PricingRule, Zone } from "@/lib/types"
import { canonicalZonePair } from "@/lib/pricing"

function toNumber(value: unknown): number {
  return typeof value === "number" ? value : Number(value)
}

export function serializeZone(zone: { id: string; name: string }): Zone {
  return {
    id: zone.id,
    name: zone.name,
  }
}

export function serializePricingRule(rule: {
  id: string
  zoneId: string
  vehicleType: PricingRule["vehicleType"]
  baseFare: unknown
  perKmRate: unknown
  minFare: unknown
  currency: string
  zone: { name: string }
}): PricingRule {
  return {
    id: rule.id,
    zoneId: rule.zoneId,
    zoneName: rule.zone.name,
    vehicleType: rule.vehicleType,
    baseFare: toNumber(rule.baseFare),
    perKmRate: toNumber(rule.perKmRate),
    minFare: toNumber(rule.minFare),
    currency: rule.currency,
  }
}

export function serializeInterZoneFare(fare: {
  id: string
  zoneAId: string
  zoneBId: string
  vehicleType: InterZoneFare["vehicleType"]
  baseFare: unknown
  minFare: unknown
  currency: string
  active: boolean
  zoneA: { name: string }
  zoneB: { name: string }
}): InterZoneFare {
  return {
    id: fare.id,
    zoneAId: fare.zoneAId,
    zoneBId: fare.zoneBId,
    zoneAName: fare.zoneA.name,
    zoneBName: fare.zoneB.name,
    vehicleType: fare.vehicleType,
    baseFare: toNumber(fare.baseFare),
    minFare: toNumber(fare.minFare),
    currency: fare.currency,
    active: fare.active,
  }
}

export { canonicalZonePair }
