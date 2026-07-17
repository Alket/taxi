import { round2 } from "@/lib/vehicles"

export const CHILD_SEAT_OPTIONS = [
  {
    key: "infantCarrier",
    priceKey: "infantCarrierPrice",
    label: "Infant carrier",
    age: "0-6 months",
  },
  {
    key: "childSeat",
    priceKey: "childSeatPrice",
    label: "Child seat",
    age: "6 months - 3 years",
  },
  {
    key: "booster",
    priceKey: "boosterSeatPrice",
    label: "Booster",
    age: "3-12 years",
  },
] as const

export type ChildSeatKey = (typeof CHILD_SEAT_OPTIONS)[number]["key"]

export type ChildSeatCounts = Record<ChildSeatKey, number>

export type ChildSeatPrices = {
  infantCarrierPrice: number
  childSeatPrice: number
  boosterSeatPrice: number
}

export const EMPTY_CHILD_SEAT_COUNTS: ChildSeatCounts = {
  infantCarrier: 0,
  childSeat: 0,
  booster: 0,
}

export function clampSeatCount(value: unknown, fallback = 0) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(4, Math.max(0, Math.trunc(n)))
}

export function computeChildSeatTotal(
  counts: ChildSeatCounts,
  prices: ChildSeatPrices,
) {
  return round2(
    counts.infantCarrier * prices.infantCarrierPrice +
      counts.childSeat * prices.childSeatPrice +
      counts.booster * prices.boosterSeatPrice,
  )
}

export function formatChildSeatNotes(
  counts: ChildSeatCounts,
  prices: ChildSeatPrices,
  currency: string,
) {
  const parts: string[] = []
  for (const option of CHILD_SEAT_OPTIONS) {
    const count = counts[option.key]
    if (count <= 0) continue
    const unit = prices[option.priceKey]
    parts.push(`${option.label} ×${count} (${currency} ${unit.toFixed(2)} each)`)
  }
  if (parts.length === 0) return null
  return `Child seats: ${parts.join("; ")}.`
}

export function parseChildSeatCounts(input: {
  infantCarrierCount?: unknown
  childSeatCount?: unknown
  boosterCount?: unknown
}): ChildSeatCounts {
  return {
    infantCarrier: clampSeatCount(input.infantCarrierCount),
    childSeat: clampSeatCount(input.childSeatCount),
    booster: clampSeatCount(input.boosterCount),
  }
}
