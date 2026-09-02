import { prisma } from "@/lib/db"
import {
  signTrustpilotInviteToken,
  verifyTrustpilotInviteToken,
} from "@/lib/trustpilot-invite-token"
import { normalizeTrustpilotIntegrationKey } from "@/lib/trustpilot"

function trustpilotConfigured() {
  return Boolean(
    normalizeTrustpilotIntegrationKey(
      process.env.NEXT_PUBLIC_TRUSTPILOT_INTEGRATION_KEY,
    ),
  )
}

/** Issue a short-lived claim token after verified checkout success. */
export async function issueTrustpilotInviteToken(
  bookingId: string,
): Promise<string | null> {
  if (!trustpilotConfigured()) return null

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      referenceCode: true,
      trustpilotInviteClaimedAt: true,
    },
  })
  if (!booking || booking.trustpilotInviteClaimedAt) return null

  return signTrustpilotInviteToken({
    bookingId: booking.id,
    referenceCode: booking.referenceCode,
  })
}

export type TrustpilotInviteClaim =
  | {
      ok: true
      recipientEmail: string
      recipientName: string
      referenceId: string
    }
  | {
      ok: false
      code: "invalid" | "already_claimed" | "not_eligible" | "missing_email"
    }

function isInviteEligible(booking: {
  paymentStatus: string
  status: string
  notes: string | null
}) {
  const paymentSucceeded =
    booking.paymentStatus === "deposit_paid" ||
    booking.paymentStatus === "fully_paid" ||
    booking.paymentStatus === "paid"

  const cashOnArrival =
    !paymentSucceeded &&
    booking.status !== "pending" &&
    booking.status !== "cancelled" &&
    (booking.notes?.toLowerCase().includes("cash on arrival") ?? false)

  return paymentSucceeded || cashOnArrival
}

/**
 * One-shot claim: validates checkout token, marks booking claimed, returns
 * booker contact for invitejs. Never returns PII without a valid token.
 */
export async function claimTrustpilotInvite(opts: {
  token: string
  referenceCode: string
}): Promise<TrustpilotInviteClaim> {
  if (!trustpilotConfigured()) return { ok: false, code: "invalid" }

  const referenceCode = opts.referenceCode.trim().toUpperCase()
  if (!referenceCode || !opts.token.trim()) {
    return { ok: false, code: "invalid" }
  }

  const payload = await verifyTrustpilotInviteToken(opts.token.trim())
  if (!payload || payload.referenceCode !== referenceCode) {
    return { ok: false, code: "invalid" }
  }

  const booking = await prisma.booking.findUnique({
    where: { id: payload.bookingId },
    select: {
      id: true,
      referenceCode: true,
      paymentStatus: true,
      status: true,
      notes: true,
      trustpilotInviteClaimedAt: true,
      customer: { select: { email: true, name: true } },
    },
  })

  if (!booking || booking.referenceCode !== referenceCode) {
    return { ok: false, code: "invalid" }
  }
  if (!isInviteEligible(booking)) {
    return { ok: false, code: "not_eligible" }
  }
  if (booking.trustpilotInviteClaimedAt) {
    return { ok: false, code: "already_claimed" }
  }

  const email = booking.customer.email?.trim() || ""
  if (!email) return { ok: false, code: "missing_email" }
  const name = booking.customer.name?.trim() || email

  const claimed = await prisma.booking.updateMany({
    where: { id: booking.id, trustpilotInviteClaimedAt: null },
    data: { trustpilotInviteClaimedAt: new Date() },
  })
  if (claimed.count === 0) {
    return { ok: false, code: "already_claimed" }
  }

  return {
    ok: true,
    recipientEmail: email,
    recipientName: name,
    referenceId: booking.referenceCode,
  }
}
