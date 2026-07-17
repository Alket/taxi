import { BookingStatus } from "@prisma/client"
import { NextResponse } from "next/server"
import { z } from "zod"

import {
  bookingDetailInclude,
  serializeBookingDetail,
} from "@/lib/bookings"
import { validateStatusTransition } from "@/lib/booking-status"
import { prisma } from "@/lib/db"

const bodySchema = z.object({
  status: z.nativeEnum(BookingStatus),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))

  if (!parsed.success) {
    return NextResponse.json(
      { error: "A valid status is required." },
      { status: 400 },
    )
  }

  const { status: nextStatus } = parsed.data

  const booking = await prisma.booking.findUnique({ where: { id } })
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 })
  }

  const transition = validateStatusTransition(booking.status, nextStatus)
  if (!transition.ok) {
    return NextResponse.json({ error: transition.error }, { status: 409 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id },
      data: { status: nextStatus },
    })

    await tx.bookingStatusEvent.create({
      data: {
        bookingId: id,
        status: nextStatus,
      },
    })
  })

  const updated = await prisma.booking.findUnique({
    where: { id },
    include: bookingDetailInclude,
  })

  return NextResponse.json({ booking: serializeBookingDetail(updated!) })
}
