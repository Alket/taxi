import { NextResponse } from "next/server"
import { z } from "zod"

import { prisma } from "@/lib/db"
import { createBookingCheckoutSession } from "@/lib/stripe-booking-payments"

export const runtime = "nodejs"

const bodySchema = z.object({
  paymentType: z.enum(["deposit", "balance"]).default("deposit"),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
  const paymentType = parsed.success ? parsed.data.paymentType : "deposit"

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { customer: true },
  })

  if (!booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 })
  }

  if (paymentType === "deposit") {
    if (Number(booking.depositAmount) <= 0) {
      return NextResponse.json(
        { error: "This booking does not have a deposit to collect." },
        { status: 409 },
      )
    }

    if (Number(booking.depositPaid) >= Number(booking.depositAmount)) {
      return NextResponse.json(
        { error: "Deposit has already been paid." },
        { status: 409 },
      )
    }
  } else {
    if (booking.isBalanceCharged) {
      return NextResponse.json(
        { error: "Balance has already been charged." },
        { status: 409 },
      )
    }

    if (Number(booking.balanceDue) <= 0) {
      return NextResponse.json(
        { error: "This booking does not have a balance to collect." },
        { status: 409 },
      )
    }
  }

  try {
    const origin = new URL(request.url).origin
    const url = await createBookingCheckoutSession({
      booking,
      paymentType,
      origin,
    })

    return NextResponse.json({ url })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Failed to create payment link." },
      { status: 500 },
    )
  }
}
