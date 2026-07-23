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
 */
export async function recordBookingPayment({
  bookingId,
  paymentIntentId,
  provider,
  paymentOption = "deposit",
  paidAt = new Date(),
}: {
  bookingId: string
  paymentIntentId: string
  provider: "stripe" | "paypal"
  paymentOption?: PaymentOption
  paidAt?: Date
}) {
  const existingPayment = await prisma.payment.findFirst({
    where: { externalId: paymentIntentId },
    select: { id: true },
  })
  if (existingPayment) return { alreadyRecorded: true }

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

  await prisma.$transaction(async (tx) => {
    for (const target of targets) {
      const shouldConfirm = target.status === "pending"
      const total = Number(target.totalPrice)
      const deposit = Number(target.depositAmount)
      const amountPaid = isFull ? total : deposit
      const balanceDue = isFull ? 0 : round2(total - deposit)

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
  })

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
  provider: "stripe" | "paypal"
  paidAt?: Date
}) {
  return recordBookingPayment({ ...args, paymentOption: "deposit" })
}
