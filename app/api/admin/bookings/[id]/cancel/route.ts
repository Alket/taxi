import { CancellationOutcome } from "@prisma/client"
import { NextResponse } from "next/server"

import {
  bookingDetailInclude,
  serializeBookingDetail,
} from "@/lib/bookings"
import { prisma } from "@/lib/db"

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const booking = await prisma.booking.findUnique({ where: { id } })
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 })
  }
  if (booking.status === "cancelled") {
    return NextResponse.json(
      { error: "Booking is already cancelled." },
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
  const cancellationOutcome: CancellationOutcome = withinFreeWindow
    ? "free_cancellation"
    : "deposit_forfeited"
  const cancelledAt = new Date()

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id },
      data: {
        status: "cancelled",
        cancelledAt,
        cancellationOutcome,
        paymentStatus:
          withinFreeWindow && booking.depositPaid.gt(0)
            ? "refunded"
            : booking.paymentStatus,
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

  const updated = await prisma.booking.findUnique({
    where: { id },
    include: bookingDetailInclude,
  })

  return NextResponse.json({
    booking: serializeBookingDetail(updated!),
    cancellationOutcome,
    freeCancellation: cancellationOutcome === "free_cancellation",
    depositForfeited: cancellationOutcome === "deposit_forfeited",
  })
}
