import { NextResponse } from "next/server"
import type { BookingStatus, PaymentStatus } from "@prisma/client"
import type { Prisma } from "@prisma/client"

import {
  bookingListInclude,
  serializeBookingListItem,
} from "@/lib/bookings"
import {
  bookingCreateSchema,
  createBookingsFromInput,
} from "@/lib/create-booking"
import { prisma } from "@/lib/db"

const BOOKING_STATUSES = new Set<string>([
  "pending",
  "confirmed",
  "driver_assigned",
  "driver_accepted",
  "arrived",
  "completed",
  "cancelled",
])

const PAYMENT_STATUSES = new Set<string>([
  "unpaid",
  "deposit_paid",
  "paid",
  "fully_paid",
  "refunded",
  "failed",
])

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const status = searchParams.get("status")
  const paymentStatus = searchParams.get("paymentStatus")
  const driverId = searchParams.get("driverId")
  const dateFrom = searchParams.get("dateFrom")
  const dateTo = searchParams.get("dateTo")
  const search = searchParams.get("search")?.trim()
  const page = parsePositiveInt(searchParams.get("page"), 1)
  const pageSize = Math.min(
    100,
    parsePositiveInt(searchParams.get("pageSize"), 20),
  )

  const where: Prisma.BookingWhereInput = {}

  if (status && status !== "all") {
    const statuses = status
      .split(",")
      .map((value) => value.trim())
      .filter((value) => BOOKING_STATUSES.has(value))

    if (statuses.length === 1) {
      where.status = statuses[0] as BookingStatus
    } else if (statuses.length > 1) {
      where.status = { in: statuses as BookingStatus[] }
    }
  }

  if (paymentStatus && PAYMENT_STATUSES.has(paymentStatus)) {
    where.paymentStatus = paymentStatus as PaymentStatus
  }

  if (driverId) {
    if (driverId === "unassigned" || driverId === "null") {
      where.driverId = null
    } else {
      where.driverId = driverId
    }
  }

  if (search) {
    where.OR = [
      { referenceCode: { contains: search, mode: "insensitive" } },
      { customer: { name: { contains: search, mode: "insensitive" } } },
      { customer: { email: { contains: search, mode: "insensitive" } } },
    ]
  }

  if (dateFrom || dateTo) {
    where.pickupDateTime = {}
    if (dateFrom) {
      // Parse YYYY-MM-DD as local midnight (avoids UTC shift on iOS / browsers).
      const [y, m, d] = dateFrom.split("-").map(Number)
      where.pickupDateTime.gte = new Date(y!, m! - 1, d!, 0, 0, 0, 0)
    }
    if (dateTo) {
      const [y, m, d] = dateTo.split("-").map(Number)
      where.pickupDateTime.lte = new Date(y!, m! - 1, d!, 23, 59, 59, 999)
    }
  }

  const [total, bookings] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      include: bookingListInclude,
      orderBy: { pickupDateTime: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  return NextResponse.json({
    bookings: bookings.map(serializeBookingListItem),
    total,
    page,
    pageSize,
  })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const parsed = bookingCreateSchema.safeParse({ ...body, source: "admin" })
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid booking payload." },
      { status: 400 },
    )
  }

  try {
    const result = await createBookingsFromInput(parsed.data)
    return NextResponse.json({
      bookings: result.bookings.map((b) => ({
        id: b.id,
        referenceCode: b.referenceCode,
      })),
    })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Failed to create booking." },
      { status: 500 },
    )
  }
}
