import { CancellationOutcome } from "@prisma/client"
import { NextResponse } from "next/server"
import { z } from "zod"

import {
  findBookingForLookup,
  serializeManagedBooking,
} from "@/lib/managed-booking"
import { isBookingLockedForCancel } from "@/lib/booking-status"
import { prisma } from "@/lib/db"

const bodySchema = z.object({
  email: z.string().email(),
  reference: z.string().min(1).optional(),
})

/**
 * Public cancel — requires email matching the booking.
 * Customer-initiated cancellations always forfeit the deposit (no refund).
 * The unpaid balance is never charged.
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
  if (isBookingLockedForCancel(booking.status)) {
    return NextResponse.json(
      {
        error:
          booking.status === "completed"
            ? "Completed bookings cannot be cancelled."
            : "This booking cannot be cancelled after the driver has arrived. Please contact support if you need help.",
      },
      { status: 409 },
    )
  }

  const cancellationOutcome: CancellationOutcome = "deposit_forfeited"
  const cancelledAt = new Date()

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id },
      data: {
        status: "cancelled",
        cancelledAt,
        cancellationOutcome,
        // Keep payment status as-is — deposit is forfeited, not refunded.
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

  try {
    const { notifyBookingCancelled } = await import(
      "@/lib/emails/booking-events"
    )
    await notifyBookingCancelled(id)
  } catch {
    // never block cancel
  }

  return NextResponse.json({
    booking: updated ? serializeManagedBooking(updated) : null,
    cancellationOutcome,
    depositForfeited: true,
  })
}
