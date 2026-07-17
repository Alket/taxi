import { NextResponse } from "next/server"

import { requireDriverSession } from "@/lib/driver-auth"
import { prisma } from "@/lib/db"
import { formatDateTime } from "@/lib/format"

/** Newly assigned trips for in-app driver alerts. */
export async function GET(request: Request) {
  const session = await requireDriverSession()
  if ("error" in session) return session.error

  const { searchParams } = new URL(request.url)
  const sinceRaw = searchParams.get("since")
  const since = sinceRaw ? new Date(sinceRaw) : new Date(Date.now() - 60_000)
  if (Number.isNaN(since.getTime())) {
    return NextResponse.json({ error: "Invalid since." }, { status: 400 })
  }

  const events = await prisma.bookingStatusEvent.findMany({
    where: {
      status: "driver_assigned",
      timestamp: { gt: since },
      booking: {
        driverId: session.driver.id,
        status: { not: "cancelled" },
      },
    },
    orderBy: { timestamp: "asc" },
    take: 20,
    select: {
      timestamp: true,
      booking: {
        select: {
          id: true,
          referenceCode: true,
          pickupAddress: true,
          dropoffAddress: true,
          pickupDateTime: true,
        },
      },
    },
  })

  return NextResponse.json({
    serverTime: new Date().toISOString(),
    bookings: events.map((e) => ({
      id: e.booking.id,
      referenceCode: e.booking.referenceCode,
      pickupAddress: e.booking.pickupAddress,
      dropoffAddress: e.booking.dropoffAddress,
      pickupLabel: formatDateTime(e.booking.pickupDateTime.toISOString()),
      assignedAt: e.timestamp.toISOString(),
    })),
  })
}
