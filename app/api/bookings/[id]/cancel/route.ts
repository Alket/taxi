import { CancellationOutcome } from "@prisma/client"
import { NextResponse } from "next/server"
import { z } from "zod"

import {
  findBookingForLookup,
  serializeManagedBooking,
} from "@/lib/managed-booking"
import { prisma } from "@/lib/db"

const bodySchema = z.object({
  email: z.string().email(),
  reference: z.string().min(1).optional(),
})

/**
 * Public cancel — requires email matching the booking.
 * Mirrors admin cancel outcome logic (free window vs deposit forfeited).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const json = await request.json().catch(() => ({}))
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "We couldn't find a booking matching those details." },
      { status: 404 },
    )
  }

  const email = parsed.data.email.trim().toLowerCase()
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { customer: true },
  })

  if (
    !booking ||
    booking.customer.email.toLowerCase() !== email ||
    (parsed.data.reference &&
      booking.referenceCode.toLowerCase() !==
        parsed.data.reference.trim().toLowerCase())
  ) {
    return NextResponse.json(
      { error: "We couldn't find a booking matching those details." },
      { status: 404 },
    )
  }

  if (booking.status === "cancelled") {
    return NextResponse.json(
      { error: "This booking is already cancelled." },
      { status: 409 },
    )
  }
  if (booking.status === "completed") {
    return NextResponse.json(
      { error: "Completed bookings cannot be cancelled." },
      { status: 409 },
    )
  }

  const withinFreeWindow =
    booking.freeCancellationUntil.getTime() > Date.now()

  // Public cancel is only allowed until freeCancellationUntil
  // (typically 24 hours before pickup).
  if (!withinFreeWindow) {
    return NextResponse.json(
      {
        error:
          "Cancellation is only available until 24 hours before pickup. Please contact support if you need help.",
      },
      { status: 409 },
    )
  }

  const cancellationOutcome: CancellationOutcome = "free_cancellation"
  const cancelledAt = new Date()

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id },
      data: {
        status: "cancelled",
        cancelledAt,
        cancellationOutcome,
        paymentStatus:
          booking.depositPaid.gt(0) ? "refunded" : booking.paymentStatus,
      },
    })

    await tx.bookingStatusEvent.create({
      data: {
        bookingId: id,
        status: "cancelled",
        timestamp: cancelledAt,
      },
    })
  })

  const updated = await findBookingForLookup(booking.referenceCode, email)

  return NextResponse.json({
    booking: updated ? serializeManagedBooking(updated) : null,
    cancellationOutcome,
    freeCancellation: true,
    depositForfeited: false,
  })
}
