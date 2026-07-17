import { NextResponse } from "next/server"

import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { formatDateTime } from "@/lib/format"

/**
 * Recent staff-worthy bookings for in-app toasts (polling fallback).
 * Skips unpaid public checkouts still awaiting deposit.
 */
export async function GET(request: Request) {
  const user = await getSession()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const sinceRaw = searchParams.get("since")
  const since = sinceRaw ? new Date(sinceRaw) : new Date(Date.now() - 60_000)
  if (Number.isNaN(since.getTime())) {
    return NextResponse.json({ error: "Invalid since." }, { status: 400 })
  }

  const bookings = await prisma.booking.findMany({
    where: {
      status: { not: "cancelled" },
      OR: [
        {
          createdAt: { gt: since },
          NOT: {
            notes: { contains: "awaiting deposit", mode: "insensitive" },
          },
        },
        {
          updatedAt: { gt: since },
          createdAt: { lte: since },
          paymentStatus: { in: ["deposit_paid", "paid", "fully_paid"] },
        },
      ],
    },
    orderBy: { updatedAt: "asc" },
    take: 20,
    select: {
      id: true,
      referenceCode: true,
      pickupAddress: true,
      dropoffAddress: true,
      pickupDateTime: true,
      createdAt: true,
      updatedAt: true,
      paymentStatus: true,
      customer: { select: { name: true } },
    },
  })

  return NextResponse.json({
    serverTime: new Date().toISOString(),
    bookings: bookings.map((b) => ({
      id: b.id,
      referenceCode: b.referenceCode,
      pickupAddress: b.pickupAddress,
      dropoffAddress: b.dropoffAddress,
      customerName: b.customer.name,
      pickupLabel: formatDateTime(b.pickupDateTime.toISOString()),
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
      paymentStatus: b.paymentStatus,
    })),
  })
}
