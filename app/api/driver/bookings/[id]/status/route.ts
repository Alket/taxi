import { BookingStatus } from "@prisma/client"
import { NextResponse } from "next/server"
import { z } from "zod"

import {
  DRIVER_SETTABLE_STATUSES,
  getNextFlowStatus,
  validateStatusTransition,
} from "@/lib/booking-status"
import { cashToCollect } from "@/lib/driver-cash"
import { requireDriverSession } from "@/lib/driver-auth"
import { prisma } from "@/lib/db"
import { BOOKING_STATUS_LABELS } from "@/lib/format"

const bodySchema = z.object({
  status: z.enum(["arrived", "completed"]),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireDriverSession()
  if ("error" in session) return session.error

  const { id } = await params
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Status must be arrived or completed." },
      { status: 400 },
    )
  }

  const nextStatus = parsed.data.status as BookingStatus
  if (!DRIVER_SETTABLE_STATUSES.includes(nextStatus)) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 })
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
      totalPrice: true,
      depositPaid: true,
      balanceDue: true,
      paymentStatus: true,
    },
  })

  if (!booking || booking.driverId !== session.driver.id) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 })
  }

  const transition = validateStatusTransition(booking.status, nextStatus)
  if (!transition.ok) {
    return NextResponse.json({ error: transition.error }, { status: 409 })
  }

  if (nextStatus === "completed") {
    const cashDue = cashToCollect({
      totalPrice: Number(booking.totalPrice),
      balanceDue: Number(booking.balanceDue),
      depositPaid: Number(booking.depositPaid),
      paymentStatus: booking.paymentStatus,
    })
    if (cashDue > 0) {
      return NextResponse.json(
        {
          error:
            "Collect and confirm cash payment before marking the trip completed.",
        },
        { status: 409 },
      )
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id },
      data: { status: nextStatus },
    })
    await tx.bookingStatusEvent.create({
      data: { bookingId: id, status: nextStatus },
    })
  })

  if (nextStatus === "arrived") {
    const { notifyAdminsDriverArrived } = await import(
      "@/lib/push-notifications"
    )
    notifyAdminsDriverArrived({
      bookingId: booking.id,
      referenceCode: booking.referenceCode,
      pickupAddress: booking.pickupAddress,
      dropoffAddress: booking.dropoffAddress,
      driverName: session.driver.name,
    })
  } else if (nextStatus === "completed") {
    const { notifyAdminsTripCompleted } = await import(
      "@/lib/push-notifications"
    )
    notifyAdminsTripCompleted({
      bookingId: booking.id,
      referenceCode: booking.referenceCode,
      pickupAddress: booking.pickupAddress,
      dropoffAddress: booking.dropoffAddress,
      driverName: session.driver.name,
    })
    try {
      const { notifyBookingCompleted } = await import(
        "@/lib/emails/booking-events"
      )
      await notifyBookingCompleted(booking.id)
    } catch {
      // never block status update
    }
  }

  const refreshed = await prisma.booking.findUnique({
    where: { id },
    select: {
      status: true,
      totalPrice: true,
      depositPaid: true,
      balanceDue: true,
      paymentStatus: true,
    },
  })

  const flowNext = refreshed ? getNextFlowStatus(refreshed.status) : null
  const cashDue = refreshed
    ? cashToCollect({
        totalPrice: Number(refreshed.totalPrice),
        balanceDue: Number(refreshed.balanceDue),
        depositPaid: Number(refreshed.depositPaid),
        paymentStatus: refreshed.paymentStatus,
      })
    : 0

  let next: "arrived" | "completed" | null =
    flowNext === "arrived" || flowNext === "completed" ? flowNext : null
  if (next === "completed" && cashDue > 0) {
    next = null
  }

  return NextResponse.json({
    ok: true,
    referenceCode: booking.referenceCode,
    status: nextStatus,
    statusLabel: BOOKING_STATUS_LABELS[nextStatus],
    nextStatus: next,
    nextStatusLabel: next ? BOOKING_STATUS_LABELS[next] : null,
  })
}
