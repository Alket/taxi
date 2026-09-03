/** Keyword-rich anchors + URLs for destination ↔ transfer internal linking. */
export const DESTINATION_TRANSFER_LINKS: Record<
  string,
  { transferSlug: string; anchor: string }
> = {
  sarande: {
    transferSlug: "tirana-airport-to-saranda",
    anchor: "book a private transfer from Tirana Airport to Sarandë",
  },
  ksamil: {
    transferSlug: "tirana-airport-to-ksamil",
    anchor: "view fixed driver rates for Tirana to Ksamil",
  },
  vlore: {
    transferSlug: "tirana-airport-to-vlore",
    anchor: "reserve a direct TIA airport taxi to Vlorë",
  },
}

export type DestinationTransferLinkMeta = {
  transferLinkSlug?: string
  transferLinkAnchor?: string
}

/**
 * Prefer CMS meta when both slug + anchor are set; else code fallback map.
 */
export function resolveDestinationTransferLink(
  destinationId: string,
  meta?: DestinationTransferLinkMeta | null,
): { transferSlug: string; anchor: string } | null {
  const cmsSlug = meta?.transferLinkSlug?.trim() ?? ""
  const cmsAnchor = meta?.transferLinkAnchor?.trim() ?? ""
  if (cmsSlug && cmsAnchor) {
    return { transferSlug: cmsSlug, anchor: cmsAnchor }
  }
  return DESTINATION_TRANSFER_LINKS[destinationId] ?? null
}

export function transferLinkForDestination(destinationId: string) {
  return resolveDestinationTransferLink(destinationId)
}
