import { DESTINATIONS, getDestination, normalizePlaceName } from "@/lib/destinations"
import { getTransferSeed } from "@/lib/transfers/routes"

export type ZoneLike = { id: string; name: string }

/**
 * Resolve a booking service zone from a deep-link query value.
 * Accepts zone id, zone name, marketing destination id/slug, or transfer route slug.
 */
export function resolveZoneFromDestinationParam<T extends ZoneLike>(
  zones: T[],
  rawParam: string | null | undefined,
): T | null {
  const raw = rawParam?.trim()
  if (!raw || zones.length === 0) return null

  const byId = zones.find((z) => z.id === raw)
  if (byId) return byId

  const lower = raw.toLowerCase()
  const byName = zones.find((z) => z.name.toLowerCase() === lower)
  if (byName) return byName

  const normalized = normalizePlaceName(raw)
  if (normalized) {
    const byNorm = zones.find((z) => {
      const zn = normalizePlaceName(z.name)
      return (
        zn === normalized ||
        zn.includes(normalized) ||
        normalized.includes(zn)
      )
    })
    if (byNorm) return byNorm
  }

  const dest =
    getDestination(raw) ||
    DESTINATIONS.find((d) => d.slug === raw || d.id === raw) ||
    null
  if (dest) {
    const destNorm = normalizePlaceName(dest.name)
    const destIdNorm = normalizePlaceName(dest.id)
    const matched = zones.find((z) => {
      const zn = normalizePlaceName(z.name)
      if (destNorm && (zn === destNorm || zn.includes(destNorm) || destNorm.includes(zn))) {
        return true
      }
      if (destIdNorm && (zn === destIdNorm || zn.includes(destIdNorm))) {
        return true
      }
      return dest.reviewKeywords.some((kw) => {
        const k = normalizePlaceName(kw)
        return Boolean(k && (zn === k || zn.includes(k) || k.includes(zn)))
      })
    })
    if (matched) return matched
  }

  const transfer = getTransferSeed(raw)
  if (transfer) {
    return (
      resolveZoneFromDestinationParam(zones, transfer.destinationId) ||
      resolveZoneFromDestinationParam(zones, transfer.zoneName)
    )
  }

  return null
}

/** Homepage deep-link for booking with a destination preselected. */
export function homepageBookHref(destinationKey: string): string {
  const key = destinationKey.trim()
  if (!key) return "/#book"
  return `/?destination=${encodeURIComponent(key)}#book`
}
