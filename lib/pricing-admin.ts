import type { PricingRule, Zone } from "@/lib/types"

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
