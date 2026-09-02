import { prisma } from "@/lib/db"
import { amountsMatch, getPokOrder } from "@/lib/pok"
import { recordBookingPayment } from "@/lib/record-deposit"
import type { PaymentOption } from "@/lib/types"

/**
 * Verifies a POK order against POK's own records and records the payment.
 * Shared by the customer return path and the POK webhook — neither is trusted
 * to report the outcome, both only supply an order id we already issued.
 */
export async function confirmPokOrder(orderId: string): Promise<{
  status: number
  body: Record<string, unknown>
  /** When set, HTTP handlers may attach a Trustpilot invite cookie. */
  inviteBookingId?: string | null
}> {
  const intent = await prisma.pokOrderIntent.findUnique({ where: { orderId } })
  if (!intent) {
    return {
      status: 404,
      body: { error: "Unknown POK order. Start checkout again." },
    }
  }

  const booking = await prisma.booking.findUnique({
    where: { id: intent.bookingId },
    select: { id: true, referenceCode: true, paymentStatus: true },
  })

  // Short-circuit before calling POK again on retries.
  if (intent.status === "captured") {
    return {
      status: 200,
      body: {
        ok: true,
        referenceCode: booking?.referenceCode ?? null,
        alreadyPaid: true,
      },
      inviteBookingId: booking?.id ?? null,
    }
  }

  if (!booking) {
    return { status: 404, body: { error: "Booking not found." } }
  }

  if (
    booking.paymentStatus === "deposit_paid" ||
    booking.paymentStatus === "fully_paid"
  ) {
    // Already paid through another method — close the intent and stop.
    await prisma.pokOrderIntent.updateMany({
      where: { orderId, status: "created" },
      data: { status: "captured" },
    })
    return {
      status: 200,
      body: {
        ok: true,
        referenceCode: booking.referenceCode,
        alreadyPaid: true,
      },
      inviteBookingId: booking.id,
    }
  }

  try {
    const order = await getPokOrder(orderId)
    const capturedAmount = order.capturedAmount

    if (capturedAmount == null || capturedAmount <= 0) {
      return {
        status: 402,
        body: {
          error: "The POK payment has not been captured yet.",
          code: "NOT_CAPTURED",
        },
      }
    }

    const expected = Number(intent.expectedAmount)
    if (!amountsMatch(capturedAmount, expected)) {
      return {
        status: 400,
        body: {
          error: "Captured amount does not match the expected charge.",
          code: "AMOUNT_MISMATCH",
        },
      }
    }

    if (
      order.currencyCode &&
      order.currencyCode !== intent.currency.toUpperCase()
    ) {
      return {
        status: 400,
        body: { error: "Captured currency does not match the booking." },
      }
    }

    if (
      order.merchantCustomReference &&
      order.merchantCustomReference !== booking.referenceCode
    ) {
      return {
        status: 400,
        body: { error: "POK order does not match this booking." },
      }
    }

    const paymentOption = (
      intent.paymentOption === "full" ? "full" : "deposit"
    ) as PaymentOption

    const recorded = await recordBookingPayment({
      bookingId: intent.bookingId,
      paymentIntentId: `pok_${orderId}`,
      provider: "pok",
      paymentOption,
      gatewayAmount: capturedAmount,
      claimPokOrderId: orderId,
    })

    return {
      status: 200,
      body: {
        ok: true,
        referenceCode: booking.referenceCode,
        alreadyPaid: recorded.alreadyRecorded,
      },
      inviteBookingId: booking.id,
    }
  } catch (error) {
    return {
      status: 500,
      body: { error: (error as Error).message || "POK confirmation failed." },
    }
  }
}
