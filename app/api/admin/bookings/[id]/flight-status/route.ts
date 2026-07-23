import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth"
import {
  bookingDetailInclude,
  serializeBookingDetail,
} from "@/lib/bookings"
import { prisma } from "@/lib/db"
import { recordBookingFlightStatus } from "@/lib/flight-status"

const bodySchema = z.object({
  status: z.enum([
    "scheduled",
    "on_time",
    "delayed",
    "landed",
    "cancelled",
  ]),
  delayMinutes: z.coerce.number().int().min(0).max(1440).optional(),
  source: z.string().trim().max(80).optional(),
})

type RouteContext = {
  params: Promise<{ id: string }>
}

/**
 * Record a flight status update. When status is delayed past the configured
 * threshold, emails the customer (if the flightDelay channel is enabled).
 */
export async function PATCH(request: Request, context: RouteContext) {
  const denied = await requireAdmin(
    "Only admins can update flight tracking status.",
  )
  if (denied) return denied

  const { id } = await context.params
  const body = await request.json().catch(() => ({}))
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid flight status payload." },
      { status: 400 },
    )
  }

  const booking = await prisma.booking.findUnique({ where: { id } })
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 })
  }

  try {
    const { emailSent } = await recordBookingFlightStatus({
      bookingId: id,
      status: parsed.data.status,
      delayMinutes: parsed.data.delayMinutes,
      source: parsed.data.source || "admin",
    })

    const updated = await prisma.booking.findUnique({
      where: { id },
      include: bookingDetailInclude,
    })

    return NextResponse.json({
      booking: serializeBookingDetail(updated!),
      emailSent,
    })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Failed to update flight status." },
      { status: 500 },
    )
  }
}
