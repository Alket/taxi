import { NextResponse } from "next/server"
import { z } from "zod"

import { prisma } from "@/lib/db"
import { markPublicBookingPaid } from "@/lib/booking-notes"
import { PENDING_CHECKOUT_TTL_MS } from "@/lib/payment-session"
import { getSettingsRow } from "@/lib/settings"
import { round2 } from "@/lib/vehicles"

const bodySchema = z.object({
  bookingId: z.string().min(1),
})

/**
 * Confirm a public booking with cash on arrival (no online deposit).
 */
export async function POST(request: Request) {
  const json = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "bookingId is required." }, { status: 400 })
  }

  const settings = await getSettingsRow()
  if (!settings.cashOnArrivalEnabled) {
    return NextResponse.json(
      {
        error: "Cash on arrival is not available.",
        code: "METHOD_DISABLED",
      },
      { status: 403 },
    )
  }

  const booking = await prisma.booking.findUnique({
    where: { id: parsed.data.bookingId },
  })

  if (!booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 })
  }

  if (booking.status === "cancelled") {
    return NextResponse.json(
      { error: "This booking was cancelled.", code: "NOT_PAYABLE" },
      { status: 409 },
    )
  }

  if (
    booking.paymentStatus === "deposit_paid" ||
    booking.paymentStatus === "fully_paid" ||
    booking.paymentStatus === "paid"
  ) {
    return NextResponse.json({
      bookingId: booking.id,
      referenceCode: booking.referenceCode,
      alreadyConfirmed: true,
    })
  }

  if (booking.paymentStatus !== "unpaid") {
    return NextResponse.json(
      {
        error: "This booking is no longer awaiting confirmation.",
        code: "NOT_PAYABLE",
      },
      { status: 409 },
    )
  }

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

  const targets = booking.roundTripId
    ? await prisma.booking.findMany({
        where: {
          roundTripId: booking.roundTripId,
          paymentStatus: "unpaid",
          status: { not: "cancelled" },
        },
      })
    : [booking]

  const now = new Date()
  const cashNote = "Payment method: cash on arrival (pay driver)."

  await prisma.$transaction(
    targets.flatMap((leg) => {
      const total = Number(leg.totalPrice)
      const existingNotes = leg.notes?.trim() ?? ""
      const withoutAwaiting = markPublicBookingPaid(existingNotes, "cash") ?? ""
      const notes = withoutAwaiting.toLowerCase().includes("cash on arrival")
        ? withoutAwaiting
        : [withoutAwaiting, cashNote].filter(Boolean).join(" ")

      return [
        prisma.booking.update({
          where: { id: leg.id },
          data: {
            status: "confirmed",
            paymentStatus: "unpaid",
            depositPaid: 0,
            balanceDue: round2(total),
            notes,
            statusEvents: {
              create: [{ status: "confirmed", timestamp: now }],
            },
          },
        }),
        prisma.payment.create({
          data: {
            bookingId: leg.id,
            type: "deposit",
            amount: 0,
            currency: leg.currency,
            status: "unpaid",
            provider: "manual",
            externalId: null,
            paidAt: null,
          },
        }),
      ]
    }),
  )

  try {
    const withCustomer = await prisma.booking.findUnique({
      where: { id: booking.id },
      select: {
        id: true,
        referenceCode: true,
        pickupAddress: true,
        dropoffAddress: true,
        customer: { select: { name: true } },
      },
    })
    if (withCustomer) {
      const { notifyAdminsNewBooking } = await import(
        "@/lib/push-notifications"
      )
      notifyAdminsNewBooking({
        bookingId: withCustomer.id,
        referenceCode: withCustomer.referenceCode,
        pickupAddress: withCustomer.pickupAddress,
        dropoffAddress: withCustomer.dropoffAddress,
        customerName: withCustomer.customer.name,
      })
    }
  } catch {
    // ignore
  }

  try {
    const { sendBookingConfirmationEmail } = await import(
      "@/lib/emails/booking-events"
    )
    await sendBookingConfirmationEmail(booking.id)
  } catch {
    // ignore
  }

  return NextResponse.json({
    bookingId: booking.id,
    referenceCode: booking.referenceCode,
    alreadyConfirmed: false,
  })
}
