import { NextResponse } from "next/server"
import { z } from "zod"

import { requireDriverSession } from "@/lib/driver-auth"
import { prisma } from "@/lib/db"
import { BOOKING_STATUS_LABELS } from "@/lib/format"

const bodySchema = z.object({
  action: z.enum(["accept", "reject"]),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireDriverSession()
  if ("error" in session) return session.error

  const { id } = await params
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Action must be accept or reject." },
      { status: 400 },
    )
  }

  const booking = await prisma.booking.findFirst({
    where: { id, driverId: session.driver.id },
    select: {
      id: true,
      status: true,
      referenceCode: true,
      pickupAddress: true,
      dropoffAddress: true,
    },
  })

  if (!booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 })
  }

  if (booking.status !== "driver_assigned") {
    return NextResponse.json(
      { error: "This trip is not awaiting your response." },
      { status: 409 },
    )
  }

  if (parsed.data.action === "accept") {
    try {
      await prisma.$transaction(async (tx) => {
        const updated = await tx.booking.updateMany({
          where: { id, driverId: session.driver.id },
          data: { status: "driver_accepted" },
        })
        if (updated.count === 0) {
          throw new Error("BOOKING_OWNERSHIP_LOST")
        }
        await tx.bookingStatusEvent.create({
          data: { bookingId: id, status: "driver_accepted" },
        })
      })
    } catch (err) {
      if (err instanceof Error && err.message === "BOOKING_OWNERSHIP_LOST") {
        return NextResponse.json({ error: "Booking not found." }, { status: 404 })
      }
      throw err
    }

    const { notifyAdminsDriverAccepted } = await import(
      "@/lib/push-notifications"
    )
    notifyAdminsDriverAccepted({
      bookingId: booking.id,
      referenceCode: booking.referenceCode,
      pickupAddress: booking.pickupAddress,
      dropoffAddress: booking.dropoffAddress,
      driverName: session.driver.name,
    })

    try {
      const { sendCustomerDriverAssigned } = await import(
        "@/lib/emails/booking-events"
      )
      await sendCustomerDriverAssigned(booking.id)
    } catch {
      // never block accept
    }

    return NextResponse.json({
      ok: true,
      action: "accept",
      status: "driver_accepted",
      statusLabel: BOOKING_STATUS_LABELS.driver_accepted,
    })
  }

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.booking.updateMany({
        where: { id, driverId: session.driver.id },
        data: {
          driverId: null,
          status: "confirmed",
        },
      })
      if (updated.count === 0) {
        throw new Error("BOOKING_OWNERSHIP_LOST")
      }
      await tx.bookingStatusEvent.create({
        data: { bookingId: id, status: "confirmed" },
      })
    })
  } catch (err) {
    if (err instanceof Error && err.message === "BOOKING_OWNERSHIP_LOST") {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 })
    }
    throw err
  }

  const { notifyAdminsDriverRejected } = await import(
    "@/lib/push-notifications"
  )
  notifyAdminsDriverRejected({
    bookingId: booking.id,
    referenceCode: booking.referenceCode,
    pickupAddress: booking.pickupAddress,
    dropoffAddress: booking.dropoffAddress,
    driverName: session.driver.name,
  })

  return NextResponse.json({
    ok: true,
    action: "reject",
    status: "confirmed",
    statusLabel: BOOKING_STATUS_LABELS.confirmed,
  })
}
