import { NextResponse } from "next/server"
import { z } from "zod"

import { prisma } from "@/lib/db"
import { recordBookingPayment } from "@/lib/record-deposit"
import { getStripe } from "@/lib/stripe"

const bodySchema = z.object({
  bookingId: z.string().min(1),
  paymentIntentId: z.string().min(1),
})

/** Client-side success path after Stripe Elements confirmPayment. */
export async function POST(request: Request) {
  const json = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 })
  }

  const booking = await prisma.booking.findUnique({
    where: { id: parsed.data.bookingId },
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

    const paymentOption =
      intent.metadata?.paymentType === "full" ? "full" : "deposit"

    await recordBookingPayment({
      bookingId: booking.id,
      paymentIntentId: intent.id,
      provider: "stripe",
      paymentOption,
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
