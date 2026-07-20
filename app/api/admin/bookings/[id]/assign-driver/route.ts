import { NextResponse } from "next/server"

import { isBookingLockedForDriverAssign } from "@/lib/booking-status"
import {
  bookingDetailInclude,
  serializeBookingDetail,
} from "@/lib/bookings"
import { findDriverPickupConflict } from "@/lib/driver-availability"
import { prisma } from "@/lib/db"
import { formatDateTime } from "@/lib/format"

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
  if (isBookingLockedForDriverAssign(booking.status)) {
    return NextResponse.json(
      {
        error:
          "Driver assignment is not allowed after the driver has arrived.",
      },
      { status: 409 },
    )
  }
  if (!driver) {
    return NextResponse.json({ error: "Driver not found" }, { status: 400 })
  }
  if (!driver.active) {
    return NextResponse.json(
      { error: "That driver is not active." },
      { status: 400 },
    )
  }

  const conflict = await findDriverPickupConflict({
    driverId: driver.id,
    pickupDateTime: booking.pickupDateTime,
    excludeBookingId: booking.id,
  })

  if (conflict) {
    return NextResponse.json(
      {
        error: `${driver.name} is already assigned to ${conflict.referenceCode} at ${formatDateTime(conflict.pickupDateTime.toISOString())}.`,
        code: "DRIVER_BUSY",
        conflictBookingId: conflict.id,
        conflictReference: conflict.referenceCode,
      },
      { status: 409 },
    )
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
