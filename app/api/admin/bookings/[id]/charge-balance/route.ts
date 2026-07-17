import { NextResponse } from "next/server"

import {
  bookingDetailInclude,
  serializeBookingDetail,
} from "@/lib/bookings"
import { prisma } from "@/lib/db"
import {
  ensureStripeCustomer,
  getSavedPaymentMethodId,
  mapStripeChargeError,
} from "@/lib/stripe-booking-payments"
import { getStripe } from "@/lib/stripe"
import { formatDateTime } from "@/lib/format"

export const runtime = "nodejs"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { customer: true },
  })

  if (!booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 })
  }

  if (booking.status !== "completed") {
    return NextResponse.json(
      { error: "Balance can only be charged for completed bookings." },
      { status: 400 },
    )
  }

  if (booking.isBalanceCharged) {
    const chargedAt = booking.balanceChargedAt
      ? formatDateTime(booking.balanceChargedAt.toISOString())
      : "an unknown time"
    return NextResponse.json(
      { error: `Balance already charged on ${chargedAt}` },
      { status: 409 },
    )
  }

  if (Number(booking.balanceDue) <= 0) {
    return NextResponse.json(
      { error: "No balance is due on this booking." },
      { status: 409 },
    )
  }

  if (!booking.customer.stripeCustomerId) {
    return NextResponse.json(
      {
        error:
          "No saved payment method on file. Send a payment link instead.",
        code: "authentication_required",
      },
      { status: 402 },
    )
  }

  const stripe = await getStripe()
  const idempotencyKey = `balance-${id}`

  try {
    const stripeCustomerId = await ensureStripeCustomer(booking.customer)
    const paymentMethodId = await getSavedPaymentMethodId(stripeCustomerId)

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: Math.round(Number(booking.balanceDue) * 100),
        currency: booking.currency.toLowerCase(),
        customer: stripeCustomerId,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
        metadata: {
          bookingId: booking.id,
          paymentType: "balance",
          referenceCode: booking.referenceCode,
        },
      },
      { idempotencyKey },
    )

    if (paymentIntent.status !== "succeeded") {
      if (paymentIntent.status === "requires_action") {
        return NextResponse.json(
          {
            error:
              "Card requires authentication — send a new payment link instead.",
            code: "authentication_required",
          },
          { status: 402 },
        )
      }

      return NextResponse.json(
        { error: "Payment could not be completed.", code: "unknown" },
        { status: 402 },
      )
    }

    const chargedAt = new Date()

    await prisma.$transaction(async (tx) => {
      const current = await tx.booking.findUnique({ where: { id } })
      if (!current || current.isBalanceCharged) {
        return
      }

      await tx.booking.update({
        where: { id },
        data: {
          isBalanceCharged: true,
          balanceChargedAt: chargedAt,
          balanceChargedBy: "admin",
          paymentStatus: "fully_paid",
          balanceDue: 0,
        },
      })

      const existingPayment = await tx.payment.findFirst({
        where: { externalId: paymentIntent.id },
        select: { id: true },
      })

      if (!existingPayment) {
        await tx.payment.create({
          data: {
            bookingId: id,
            type: "balance",
            amount: booking.balanceDue,
            currency: booking.currency,
            status: "paid",
            provider: "stripe",
            externalId: paymentIntent.id,
            paidAt: chargedAt,
          },
        })
      }
    })
  } catch (error) {
    const mapped = mapStripeChargeError(error)
    return NextResponse.json(
      { error: mapped.message, code: mapped.code },
      { status: 402 },
    )
  }

  const updated = await prisma.booking.findUnique({
    where: { id },
    include: bookingDetailInclude,
  })

  return NextResponse.json({ booking: serializeBookingDetail(updated!) })
}
