import { markPublicBookingPaid } from "@/lib/booking-notes"
import { prisma } from "@/lib/db"
import type { PaymentOption } from "@/lib/types"
import { round2 } from "@/lib/vehicles"

/**
 * Records an online payment (deposit or full amount) for a booking and any
 * unpaid round-trip siblings. Idempotent on externalId.
 *
 * - "deposit": marks paymentStatus deposit_paid, keeps the remaining balance.
 * - "full": marks paymentStatus fully_paid and clears the balance.
 *
 * When `gatewayAmount` is provided (preferred), Payment.amount and
 * depositPaid allocations use the gateway-confirmed total (split across
 * round-trip legs by expected share). Otherwise falls back to list prices.
 */
export async function recordBookingPayment({
  bookingId,
  paymentIntentId,
  provider,
  paymentOption = "deposit",
  gatewayAmount,
  claimPaypalOrderId,
  claimPokOrderId,
  paidAt = new Date(),
}: {
  bookingId: string
  paymentIntentId: string
  provider: "stripe" | "paypal" | "pok"
  paymentOption?: PaymentOption
  /** Actual amount confirmed by the payment provider (major currency units). */
  gatewayAmount?: number
  /**
   * When set, claim this PaypalOrderIntent (status created → captured) in the
   * same transaction as the payment write. If another request already claimed
   * it, returns { alreadyRecorded: true } without mutating bookings again.
   */
  claimPaypalOrderId?: string
  /** Same as `claimPaypalOrderId`, for a PokOrderIntent. */
  claimPokOrderId?: string
  paidAt?: Date
}) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } })
  if (!booking) return { alreadyRecorded: false }

  const targets = booking.roundTripId
    ? await prisma.booking.findMany({
        where: {
          roundTripId: booking.roundTripId,
          paymentStatus: "unpaid",
          status: { not: "cancelled" },
        },
      })
    : [booking]

  const isFull = paymentOption === "full"
  const expectedShares = targets.map((t) =>
    isFull ? Number(t.totalPrice) : Number(t.depositAmount),
  )
  const expectedTotal = round2(expectedShares.reduce((sum, n) => sum + n, 0))
  const capturedTotal =
    gatewayAmount != null && Number.isFinite(gatewayAmount)
      ? round2(gatewayAmount)
      : expectedTotal

  const outcome = await prisma.$transaction(async (tx) => {
    if (claimPaypalOrderId) {
      const claimed = await tx.paypalOrderIntent.updateMany({
        where: { orderId: claimPaypalOrderId, status: "created" },
        data: { status: "captured" },
      })
      if (claimed.count === 0) {
        return { alreadyRecorded: true as const }
      }
    }

    if (claimPokOrderId) {
      const claimed = await tx.pokOrderIntent.updateMany({
        where: { orderId: claimPokOrderId, status: "created" },
        data: { status: "captured" },
      })
      if (claimed.count === 0) {
        return { alreadyRecorded: true as const }
      }
    }

    const existingPayment = await tx.payment.findFirst({
      where: { externalId: paymentIntentId },
      select: { id: true },
    })
    if (existingPayment) return { alreadyRecorded: true as const }

    // If the primary booking was already marked paid (e.g. concurrent Stripe
    // path) and we have no unpaid targets, treat as idempotent success.
    if (targets.length === 0) {
      return { alreadyRecorded: true as const }
    }

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i]
      const shouldConfirm =
        target.status === "pending" || target.status === "abandoned"
      const total = Number(target.totalPrice)
      const expectedShare = expectedShares[i]
      const amountPaid =
        targets.length === 1 || expectedTotal <= 0
          ? capturedTotal
          : round2((expectedShare / expectedTotal) * capturedTotal)
      const balanceDue = isFull ? 0 : round2(total - amountPaid)

      await tx.booking.update({
        where: { id: target.id },
        data: {
          depositPaid: amountPaid,
          balanceDue,
          isBalanceCharged: isFull,
          paymentStatus: isFull ? "fully_paid" : "deposit_paid",
          status: shouldConfirm ? "confirmed" : target.status,
          notes: markPublicBookingPaid(
            target.notes,
            isFull ? "full" : "deposit",
          ),
        },
      })

      await tx.payment.create({
        data: {
          bookingId: target.id,
          type: isFull ? "balance" : "deposit",
          amount: amountPaid,
          currency: target.currency,
          status: isFull ? "fully_paid" : "deposit_paid",
          provider,
          externalId:
            targets.length > 1
              ? `${paymentIntentId}:${target.id}`
              : paymentIntentId,
          paidAt,
        },
      })

      if (shouldConfirm) {
        await tx.bookingStatusEvent.create({
          data: {
            bookingId: target.id,
            status: "confirmed",
            timestamp: paidAt,
          },
        })
      }
    }

    return { alreadyRecorded: false as const }
  })

  if (outcome.alreadyRecorded) return outcome

  // Alert admins when a public checkout becomes a real booking.
  try {
    const primary = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        referenceCode: true,
        pickupAddress: true,
        dropoffAddress: true,
        customer: { select: { name: true } },
      },
    })
    if (primary) {
      const { notifyAdminsNewBooking } = await import(
        "@/lib/push-notifications"
      )
      notifyAdminsNewBooking({
        bookingId: primary.id,
        referenceCode: primary.referenceCode,
        pickupAddress: primary.pickupAddress,
        dropoffAddress: primary.dropoffAddress,
        customerName: primary.customer.name,
      })
    }
  } catch {
    // never block payment confirmation
  }

  try {
    const { sendBookingConfirmationEmail } = await import(
      "@/lib/emails/booking-events"
    )
    await sendBookingConfirmationEmail(bookingId)
  } catch {
    // never block payment confirmation
  }

  return { alreadyRecorded: false }
}

/** Back-compat wrapper: records a deposit payment. */
export async function recordDepositPaid(args: {
  bookingId: string
  paymentIntentId: string
  provider: "stripe" | "paypal" | "pok"
  gatewayAmount?: number
  paidAt?: Date
}) {
  return recordBookingPayment({ ...args, paymentOption: "deposit" })
}
