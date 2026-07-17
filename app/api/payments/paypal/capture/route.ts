import { NextResponse } from "next/server"
import { z } from "zod"

import { prisma } from "@/lib/db"
import { capturePaypalOrder, isPaypalConfigured } from "@/lib/paypal"
import { recordBookingPayment } from "@/lib/record-deposit"

const bodySchema = z.object({
  orderId: z.string().min(1),
  bookingId: z.string().min(1),
  paymentOption: z.enum(["deposit", "full"]).optional(),
})

export async function POST(request: Request) {
  if (!(await isPaypalConfigured())) {
    return NextResponse.json(
      { error: "PayPal is not configured." },
      { status: 503 },
    )
  }

  const json = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "orderId and bookingId are required." },
      { status: 400 },
    )
  }

  const booking = await prisma.booking.findUnique({
    where: { id: parsed.data.bookingId },
    select: { id: true, referenceCode: true, paymentStatus: true },
  })
  if (!booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 })
  }

  if (booking.paymentStatus === "deposit_paid" || booking.paymentStatus === "fully_paid") {
    return NextResponse.json({
      ok: true,
      referenceCode: booking.referenceCode,
      alreadyPaid: true,
    })
  }

  try {
    const capture = await capturePaypalOrder(parsed.data.orderId)
    const captureId =
      capture.purchase_units?.[0]?.payments?.captures?.[0]?.id ?? capture.id

    if (capture.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "PayPal payment was not completed.", status: capture.status },
        { status: 402 },
      )
    }

    await recordBookingPayment({
      bookingId: booking.id,
      paymentIntentId: captureId,
      provider: "paypal",
      paymentOption: parsed.data.paymentOption ?? "deposit",
    })

    return NextResponse.json({
      ok: true,
      referenceCode: booking.referenceCode,
    })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "PayPal capture failed." },
      { status: 500 },
    )
  }
}
