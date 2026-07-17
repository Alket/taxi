import { NextResponse } from "next/server"
import { z } from "zod"

import { prisma } from "@/lib/db"
import { normalizePaymentOption } from "@/lib/payment-options"
import { createPaypalOrder, isPaypalConfigured } from "@/lib/paypal"
import { PENDING_CHECKOUT_TTL_MS } from "@/lib/payment-session"
import { getPublicOrigin } from "@/lib/public-origin"
import { getSettingsRow } from "@/lib/settings"
import { round2 } from "@/lib/vehicles"

const bodySchema = z.object({
  bookingId: z.string().min(1),
  paymentOption: z.enum(["deposit", "full"]).optional(),
})

export async function POST(request: Request) {
  if (!(await isPaypalConfigured())) {
    return NextResponse.json(
      { error: "PayPal is not configured.", code: "PAYPAL_UNAVAILABLE" },
      { status: 503 },
    )
  }

  const settings = await getSettingsRow()
  if (!settings.paypalEnabled) {
    return NextResponse.json(
      { error: "PayPal is not available.", code: "METHOD_DISABLED" },
      { status: 403 },
    )
  }

  const json = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "bookingId is required." }, { status: 400 })
  }

  const paymentOption = normalizePaymentOption(parsed.data.paymentOption, {
    depositEnabled: settings.depositPaymentEnabled ?? true,
    fullEnabled: settings.fullPaymentEnabled ?? true,
  })

  const booking = await prisma.booking.findUnique({
    where: { id: parsed.data.bookingId },
  })
  if (!booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 })
  }

  if (booking.paymentStatus !== "unpaid") {
    return NextResponse.json(
      { error: "This booking is no longer awaiting payment.", code: "NOT_PAYABLE" },
      { status: 409 },
    )
  }

  if (Date.now() - booking.createdAt.getTime() > PENDING_CHECKOUT_TTL_MS) {
    return NextResponse.json(
      {
        error: "This payment session has expired. Please start a new booking.",
        code: "SESSION_EXPIRED",
      },
      { status: 410 },
    )
  }

  const siblings = booking.roundTripId
    ? await prisma.booking.findMany({
        where: {
          roundTripId: booking.roundTripId,
          paymentStatus: "unpaid",
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

  const origin = getPublicOrigin(request)
  const returnUrl = `${origin}/book/payment/paypal/return?bookingId=${booking.id}&paymentOption=${paymentOption}`
  const cancelUrl = `${origin}/?payment=cancelled`

  try {
    const order = await createPaypalOrder({
      amount: chargeAmount,
      currency: booking.currency,
      bookingId: booking.id,
      referenceCode: booking.referenceCode,
      returnUrl,
      cancelUrl,
    })

    if (!order.approveUrl) {
      return NextResponse.json(
        { error: "PayPal did not return an approval URL." },
        { status: 502 },
      )
    }

    return NextResponse.json({
      orderId: order.orderId,
      approveUrl: order.approveUrl,
      paymentOption,
      chargeAmount,
      depositAmount: chargeAmount,
      currency: booking.currency,
      referenceCode: booking.referenceCode,
    })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Failed to create PayPal order." },
      { status: 500 },
    )
  }
}
