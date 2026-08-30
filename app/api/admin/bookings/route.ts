import { NextResponse } from "next/server"
import type { BookingStatus, PaymentStatus } from "@prisma/client"
import type { Prisma } from "@prisma/client"

import {
  bookingListInclude,
  serializeBookingListItem,
} from "@/lib/bookings"
import { calendarApiMaxPageSize } from "@/lib/bookings-calendar"
import {
  bookingCreateSchema,
  createBookingsFromInput,
} from "@/lib/create-booking"
import { requireStaffSession } from "@/lib/auth"
import { prisma } from "@/lib/db"

const BOOKING_STATUSES = new Set<string>([
  "pending",
  "confirmed",
  "driver_assigned",
  "driver_accepted",
  "arrived",
  "completed",
  "cancelled",
  "abandoned",
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
  const session = await requireStaffSession(request)
  if ("error" in session) return session.error

  const { searchParams } = new URL(request.url)

  const status = searchParams.get("status")
  const paymentStatus = searchParams.get("paymentStatus")
  const driverId = searchParams.get("driverId")
  const dateFrom = searchParams.get("dateFrom")
  const dateTo = searchParams.get("dateTo")
  const search = searchParams.get("search")?.trim()
  const sort = searchParams.get("sort")
  const page = parsePositiveInt(searchParams.get("page"), 1)
  // Calendar month/week loads need a higher cap when the range is bounded.
  const pageSize = Math.min(
    calendarApiMaxPageSize(dateFrom, dateTo),
    parsePositiveInt(searchParams.get("pageSize"), 20),
  )

  // Allowlist only — reject arbitrary Prisma order fields.
  const orderBy: Prisma.BookingOrderByWithRelationInput =
    sort === "created_desc"
      ? { createdAt: "desc" }
      : sort === "created_asc"
        ? { createdAt: "asc" }
        : sort === "pickup_desc"
          ? { pickupDateTime: "desc" }
          : { pickupDateTime: "asc" }

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
  } else {
    // Default list hides abandoned checkouts (use status=abandoned to see them).
    where.status = { not: "abandoned" }
  }

  if (paymentStatus && PAYMENT_STATUSES.has(paymentStatus)) {
    where.paymentStatus = paymentStatus as PaymentStatus
  }

  const profitCollected = searchParams.get("profitCollected")
  if (profitCollected === "due") {
    where.status = "completed"
    where.driverCost = { not: null }
    where.profitCollectedAt = null
  } else if (profitCollected === "collected") {
    where.profitCollectedAt = { not: null }
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
      orderBy,
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
  const session = await requireStaffSession(request)
  if ("error" in session) return session.error

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
    const err = error as Error & { code?: string }
    const status =
      err.code === "VEHICLE_DISABLED" || err.name === "VehicleDisabledError"
        ? 400
        : 500
    return NextResponse.json(
      {
        error: err.message || "Failed to create booking.",
        ...(status === 400 ? { code: "VEHICLE_DISABLED" } : {}),
      },
      { status },
    )
  }
}
