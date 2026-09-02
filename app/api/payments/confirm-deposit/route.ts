import { NextResponse } from "next/server"
import { z } from "zod"

import { prisma } from "@/lib/db"
import { recordBookingPayment } from "@/lib/record-deposit"
import { getStripe } from "@/lib/stripe"

const bodySchema = z
  .object({
    bookingId: z.string().min(1).optional(),
    referenceCode: z.string().min(3).max(32).optional(),
    paymentIntentId: z.string().min(1),
    /**
     * Required. Proves possession of the Stripe PaymentIntent (blocks
     * bookingId + payment_intent id replay).
     */
    paymentIntentClientSecret: z.string().min(10).max(512),
  })
  .refine((v) => Boolean(v.bookingId || v.referenceCode), {
    message: "bookingId or referenceCode is required",
  })

/** Client-side success path after Stripe Elements confirmPayment. */
export async function POST(request: Request) {
  const json = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 })
  }

  const booking = parsed.data.bookingId
    ? await prisma.booking.findUnique({
        where: { id: parsed.data.bookingId },
        select: { id: true, referenceCode: true },
      })
    : await prisma.booking.findUnique({
        where: {
          referenceCode: parsed.data.referenceCode!.trim().toUpperCase(),
        },
        select: { id: true, referenceCode: true },
      })

  if (!booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 })
  }

  try {
    const intent = await (await getStripe()).paymentIntents.retrieve(
      parsed.data.paymentIntentId,
    )

    if (intent.status !== "succeeded") {
      return NextResponse.json(
        { error: "Payment has not succeeded yet.", status: intent.status },
        { status: 402 },
      )
    }

    if (intent.metadata?.bookingId && intent.metadata.bookingId !== booking.id) {
      return NextResponse.json({ error: "Payment mismatch." }, { status: 400 })
    }

    const secret = parsed.data.paymentIntentClientSecret.trim()
    if (!intent.client_secret || secret !== intent.client_secret) {
      return NextResponse.json(
        { error: "Payment verification failed." },
        { status: 401 },
      )
    }

    const paymentOption =
      intent.metadata?.paymentType === "full" ? "full" : "deposit"

    const gatewayAmount =
      typeof intent.amount_received === "number"
        ? intent.amount_received / 100
        : typeof intent.amount === "number"
          ? intent.amount / 100
          : undefined

    await recordBookingPayment({
      bookingId: booking.id,
      paymentIntentId: intent.id,
      provider: "stripe",
      paymentOption,
      gatewayAmount,
    })

    return NextResponse.json({
      ok: true,
      referenceCode: booking.referenceCode,
    })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Failed to confirm payment." },
      { status: 500 },
    )
  }
}
