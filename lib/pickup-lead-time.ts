/** Minimum notice before pickup for public bookings. */
export const MIN_PICKUP_LEAD_MS = 60 * 60 * 1000

export const MIN_PICKUP_LEAD_LABEL = "1 hour"

export function earliestPickupAt(from: Date = new Date()) {
  return new Date(from.getTime() + MIN_PICKUP_LEAD_MS)
}

export function isPickupTooSoon(
  value: string | Date | null | undefined,
  from: Date = new Date(),
) {
  if (value == null) return true
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return true
  return date.getTime() < earliestPickupAt(from).getTime()
}

export function pickupLeadTimeMessage() {
  return `Pickup must be at least ${MIN_PICKUP_LEAD_LABEL} from now.`
}
