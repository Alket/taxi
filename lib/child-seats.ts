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

/**
 * Recover seat counts from booking notes written by formatChildSeatNotes.
 * Returns null when a "Child seats:" segment exists but cannot be parsed
 * (fail closed on reprice rather than silently dropping the add-on).
 */
export function parseChildSeatCountsFromNotes(
  notes: string | null | undefined,
): ChildSeatCounts | null {
  if (!notes?.trim()) return { ...EMPTY_CHILD_SEAT_COUNTS }
  const match = notes.match(/child seats:\s*(.+?)(?:\.\s*(?:Meet\s*&\s*greet|Source:|Payment method:|Customer opted|Driver notes:)|\.?\s*$)/i)
  if (!match) return { ...EMPTY_CHILD_SEAT_COUNTS }

  const segment = match[1] ?? ""
  const counts: ChildSeatCounts = { ...EMPTY_CHILD_SEAT_COUNTS }
  let matchedAny = false
  for (const option of CHILD_SEAT_OPTIONS) {
    const re = new RegExp(
      `${option.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[×x]\\s*(\\d+)`,
      "i",
    )
    const hit = segment.match(re)
    if (hit) {
      counts[option.key] = clampSeatCount(hit[1])
      matchedAny = true
    }
  }
  if (!matchedAny) return null
  return counts
}
