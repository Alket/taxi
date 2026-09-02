import { prisma } from "@/lib/db"
import { normalizeTrustpilotIntegrationKey } from "@/lib/trustpilot"

const AFS_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Unique Trustpilot Automatic Feedback Service address (BCC). */
export function normalizeTrustpilotAfsEmail(
  raw: string | null | undefined,
): string | null {
  const email = raw?.trim().toLowerCase() ?? ""
  if (!email || !AFS_EMAIL_RE.test(email)) return null
  return email
}

export function getTrustpilotAfsEmail(): string | null {
  if (
    !normalizeTrustpilotIntegrationKey(
      process.env.NEXT_PUBLIC_TRUSTPILOT_INTEGRATION_KEY,
    )
  ) {
    return null
  }
  return normalizeTrustpilotAfsEmail(process.env.TRUSTPILOT_AFS_EMAIL)
}

/** True when this completed booking may still BCC Trustpilot AFS. */
export async function canTrustpilotAfsBcc(
  bookingId: string,
): Promise<boolean> {
  if (!getTrustpilotAfsEmail()) return false

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      status: true,
      trustpilotInviteClaimedAt: true,
      customer: { select: { email: true } },
    },
  })
  if (!booking || booking.status !== "completed") return false
  if (booking.trustpilotInviteClaimedAt) return false
  return Boolean(booking.customer.email?.trim())
}

/** Mark invite as queued (one-shot). Returns true if this caller won the claim. */
export async function markTrustpilotInviteClaimed(
  bookingId: string,
): Promise<boolean> {
  const claimed = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      trustpilotInviteClaimedAt: null,
      status: "completed",
    },
    data: { trustpilotInviteClaimedAt: new Date() },
  })
  return claimed.count > 0
}

/**
 * Resolve AFS BCC for a completed booking email. Does not claim until
 * {@link markTrustpilotInviteClaimed} after a successful send.
 */
export async function resolveTrustpilotAfsBcc(
  bookingId: string,
): Promise<string | null> {
  if (!(await canTrustpilotAfsBcc(bookingId))) return null
  return getTrustpilotAfsEmail()
}
