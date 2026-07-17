import { NextResponse } from "next/server"
import { z } from "zod"

import { prisma } from "@/lib/db"
import { normalizePaymentOption } from "@/lib/payment-options"
import { PENDING_CHECKOUT_TTL_MS } from "@/lib/payment-session"
import { getSettingsRow } from "@/lib/settings"
import { ensureStripeCustomer } from "@/lib/stripe-booking-payments"
import { getStripe, getStripeConfig } from "@/lib/stripe"
import { round2 } from "@/lib/vehicles"

const bodySchema = z.object({
  bookingId: z.string().min(1),
  paymentOption: z.enum(["deposit", "full"]).optional(),
})

export async function POST(request: Request) {
  const json = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "bookingId is required." }, { status: 400 })
  }

  const settings = await getSettingsRow()
  if (!settings.stripeEnabled) {
    return NextResponse.json(
      { error: "Card payments are not available.", code: "METHOD_DISABLED" },
      { status: 403 },
    )
  }

  const paymentOption = normalizePaymentOption(parsed.data.paymentOption, {
    depositEnabled: settings.depositPaymentEnabled ?? true,
    fullEnabled: settings.fullPaymentEnabled ?? true,
  })

  const booking = await prisma.booking.findUnique({
    where: { id: parsed.data.bookingId },
    include: { customer: true },
  })

  if (!booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 })
  }

  if (booking.paymentStatus !== "unpaid" || booking.status === "cancelled") {
    return NextResponse.json(
      {
        error: "This booking is no longer awaiting payment.",
        code: "NOT_PAYABLE",
      },
      { status: 409 },
    )
  }

  // Abandoned / stale pending checkouts from the public flow.
  if (Date.now() - booking.createdAt.getTime() > PENDING_CHECKOUT_TTL_MS) {
    return NextResponse.json(
      {
        error:
          "This payment session has expired. Please start a new booking.",
        code: "SESSION_EXPIRED",
      },
      { status: 410 },
    )
  }

  // Round-trip: charge the sum of unpaid deposits on linked legs.
  const siblings = booking.roundTripId
    ? await prisma.booking.findMany({
        where: {
          roundTripId: booking.roundTripId,
          paymentStatus: "unpaid",
          status: { not: "cancelled" },
        },
      })
    : [booking]

  const chargeAmount = round2(
    siblings.reduce(
      (sum, b) =>
        sum +
        Number(paymentOption === "full" ? b.totalPrice : b.depositAmount),
      0,
    ),
  )

  if (chargeAmount <= 0) {
    return NextResponse.json(
      { error: "This booking does not have an amount to collect." },
      { status: 400 },
    )
  }

  try {
    const stripeCustomerId = await ensureStripeCustomer(booking.customer)
    const stripe = await getStripe()

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(chargeAmount * 100),
      currency: booking.currency.toLowerCase(),
      customer: stripeCustomerId,
      setup_future_usage: "off_session",
      automatic_payment_methods: { enabled: true },
      metadata: {
        bookingId: booking.id,
        paymentType: paymentOption,
        referenceCode: booking.referenceCode,
        roundTripId: booking.roundTripId ?? "",
      },
      description: `${
        paymentOption === "full" ? "Full payment" : "Deposit"
      } for ${booking.referenceCode}`,
    })

    if (!paymentIntent.client_secret) {
      return NextResponse.json(
        { error: "Stripe did not return a client secret." },
        { status: 502 },
      )
    }

    const stripeConfig = await getStripeConfig()

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      paymentOption,
      chargeAmount,
      // Kept for backward compatibility with existing clients.
      depositAmount: chargeAmount,
      currency: booking.currency,
      bookingId: booking.id,
      referenceCode: booking.referenceCode,
      publishableKey: stripeConfig.publishableKey || null,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          (error as Error).message || "Failed to create payment intent.",
      },
      { status: 500 },
    )
  }
}
