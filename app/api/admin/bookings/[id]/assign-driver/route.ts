import { NextResponse } from "next/server"

import {
  bookingDetailInclude,
  serializeBookingDetail,
} from "@/lib/bookings"
import { prisma } from "@/lib/db"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const driverId = body.driverId as string | undefined

  if (!driverId) {
    return NextResponse.json({ error: "Driver is required." }, { status: 400 })
  }

  const [booking, driver] = await Promise.all([
    prisma.booking.findUnique({ where: { id } }),
    prisma.driver.findUnique({ where: { id: driverId } }),
  ])

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 })
  }
  if (!driver) {
    return NextResponse.json({ error: "Driver not found" }, { status: 400 })
  }

  const shouldAssignStatus =
    booking.status === "pending" || booking.status === "confirmed"

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id },
      data: {
        driverId: driver.id,
        status: "driver_assigned",
      },
    })

    const existing = await tx.bookingStatusEvent.findFirst({
      where: { bookingId: id, status: "driver_assigned" },
    })
      if (!existing || shouldAssignStatus) {
      await tx.bookingStatusEvent.create({
        data: {
          bookingId: id,
          status: "driver_assigned",
        },
      })
    }
  })

  const { notifyDriverAssigned } = await import("@/lib/push-notifications")
  const { formatDateTime } = await import("@/lib/format")
  notifyDriverAssigned({
    driverId: driver.id,
    bookingId: booking.id,
    referenceCode: booking.referenceCode,
    pickupAddress: booking.pickupAddress,
    dropoffAddress: booking.dropoffAddress,
    pickupLabel: formatDateTime(booking.pickupDateTime.toISOString()),
  })

  const updated = await prisma.booking.findUnique({
    where: { id },
    include: bookingDetailInclude,
  })

  return NextResponse.json({ booking: serializeBookingDetail(updated!) })
}
