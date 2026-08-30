import { NextResponse } from "next/server"
import { z } from "zod"

import { prisma } from "@/lib/db"
import { normalizePaymentOption } from "@/lib/payment-options"
import { assertCheckoutPayable } from "@/lib/payment-session"
import { createPokOrder, getPokConfig } from "@/lib/pok"
import { getPublicOrigin } from "@/lib/public-origin"
import { getSettingsRow } from "@/lib/settings"
import { round2 } from "@/lib/vehicles"

const bodySchema = z.object({
  bookingId: z.string().min(1),
  paymentOption: z.enum(["deposit", "full"]).optional(),
})

export async function POST(request: Request) {
  const config = await getPokConfig()
  if (!config.configured) {
    return NextResponse.json(
      { error: "POK is not configured.", code: "POK_UNAVAILABLE" },
      { status: 503 },
    )
  }

  const settings = await getSettingsRow()
  if (!settings.pokEnabled) {
    return NextResponse.json(
      { error: "POK is not available.", code: "METHOD_DISABLED" },
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

  const gate = assertCheckoutPayable(booking)
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.error, code: gate.code },
      { status: gate.status },
    )
  }

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
        sum + Number(paymentOption === "full" ? b.totalPrice : b.depositAmount),
      0,
    ),
  )

  if (chargeAmount <= 0) {
    return NextResponse.json(
      { error: "This booking does not have an amount to collect." },
      { status: 400 },
    )
  }

  const origin = getPublicOrigin(request)

  try {
    const order = await createPokOrder({
      amount: chargeAmount,
      currency: booking.currency,
      referenceCode: booking.referenceCode,
      description: `Transfer ${paymentOption === "full" ? "payment" : "deposit"} ${booking.referenceCode}`,
      // The POK card form runs inline, so these only matter for 3-D Secure
      // step-ups that leave the page. The return page re-confirms server-side,
      // so nothing sensitive rides on the URL.
      redirectUrl: `${origin}/book/payment/pok/return`,
      failRedirectUrl: `${origin}/?payment=cancelled`,
      webhookUrl: `${origin}/api/webhooks/pok`,
    })

    await prisma.pokOrderIntent.create({
      data: {
        orderId: order.id,
        bookingId: booking.id,
        paymentOption,
        expectedAmount: chargeAmount,
        currency: booking.currency.toUpperCase(),
        status: "created",
      },
    })

    return NextResponse.json({
      orderId: order.id,
      environment: config.environment,
      paymentOption,
      chargeAmount,
      currency: booking.currency,
      bookingId: booking.id,
      referenceCode: booking.referenceCode,
    })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Failed to create POK order." },
      { status: 500 },
    )
  }
}
