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

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true,
      driverId: true,
      status: true,
      referenceCode: true,
      pickupAddress: true,
      dropoffAddress: true,
    },
  })

  if (!booking || booking.driverId !== session.driver.id) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 })
  }

  if (booking.status !== "driver_assigned") {
    return NextResponse.json(
      { error: "This trip is not awaiting your response." },
      { status: 409 },
    )
  }

  if (parsed.data.action === "accept") {
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id },
        data: { status: "driver_accepted" },
      })
      await tx.bookingStatusEvent.create({
        data: { bookingId: id, status: "driver_accepted" },
      })
    })

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

    return NextResponse.json({
      ok: true,
      action: "accept",
      status: "driver_accepted",
      statusLabel: BOOKING_STATUS_LABELS.driver_accepted,
    })
  }

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id },
      data: {
        driverId: null,
        status: "confirmed",
      },
    })
    await tx.bookingStatusEvent.create({
      data: { bookingId: id, status: "confirmed" },
    })
  })

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
