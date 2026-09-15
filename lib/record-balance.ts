import { prisma } from "@/lib/db"
import { round2 } from "@/lib/vehicles"

const UNDERPAY_EPS = 0.05

/**
 * Settle a Stripe balance charge against the booking's current balanceDue.
 *
 * - Requires a finite gateway amount (fail closed).
 * - Row-locks the booking (`FOR UPDATE`) so concurrent covering + underpay
 *   settlements cannot leave `fully_paid` with `balanceDue > 0`.
 * - Only marks fully_paid / isBalanceCharged when paid covers current due.
 * - Underpayments reduce balanceDue and bump depositPaid so admin reprice
 *   (`total − depositPaid`) stays consistent.
 */
export async function recordBalancePayment({
  bookingId,
  paymentIntentId,
  paidAt,
  chargedBy,
  gatewayAmount,
}: {
  bookingId: string
  paymentIntentId: string
  paidAt: Date
  chargedBy: string
  gatewayAmount?: number
}): Promise<void> {
  if (gatewayAmount == null || !Number.isFinite(gatewayAmount)) {
    console.warn(
      `[stripe] balance payment ${paymentIntentId} for booking ${bookingId} missing gateway amount; not clearing balance`,
    )
    return
  }

  const paid = round2(gatewayAmount)
  if (paid <= 0) return

  await prisma.$transaction(async (tx) => {
    // Serialize concurrent balance settlements on this booking.
    await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${bookingId} FOR UPDATE`

    const current = await tx.booking.findUnique({ where: { id: bookingId } })
    if (!current || current.isBalanceCharged) return

    const due = round2(Number(current.balanceDue))
    if (due <= 0) return

    const already = await tx.payment.findFirst({
      where: { externalId: paymentIntentId },
      select: { id: true },
    })
    if (already) return

    const covers = paid + UNDERPAY_EPS >= due
    if (!covers) {
      console.warn(
        `[stripe] balance underpayment on booking ${bookingId}: captured ${paid} < due ${due}; leaving remaining balance`,
      )
    }

    const remaining = covers ? 0 : round2(Math.max(0, due - paid))
    const nextDepositPaid = round2(Number(current.depositPaid) + paid)

    await tx.booking.update({
      where: { id: bookingId },
      data: covers
        ? {
            isBalanceCharged: true,
            balanceChargedAt: paidAt,
            balanceChargedBy: chargedBy,
            paymentStatus: "fully_paid",
            balanceDue: 0,
            depositPaid: nextDepositPaid,
          }
        : {
            depositPaid: nextDepositPaid,
            balanceDue: remaining,
            paymentStatus: "deposit_paid",
          },
    })

    await tx.payment.create({
      data: {
        bookingId,
        type: "balance",
        amount: paid,
        currency: current.currency,
        status: "paid",
        provider: "stripe",
        externalId: paymentIntentId,
        paidAt,
      },
    })
  })
}
