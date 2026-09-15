import { NextResponse } from "next/server"

import { clientIpFromRequest } from "@/lib/client-ip"
import { takeRateLimit } from "@/lib/rate-limit"

import {
  bookingCreateSchema,
  createBookingsFromInput,
} from "@/lib/create-booking"

/**
 * Public booking creation for the /book flow.
 *
 * Pattern: create a `pending` + `unpaid` booking as soon as the customer
 * reaches payment, then collect the deposit via PaymentIntent / PayPal.
 * Abandoned checkouts leave unpaid pending rows — identifiable via notes
 * containing "awaiting deposit". Consider a periodic cleanup job or an
 * admin filter for these.
 */
export async function POST(request: Request) {
  const ip = clientIpFromRequest(request)
  const limited = takeRateLimit(`public-booking-create:${ip}`, 20, 15 * 60 * 1000)
  if (!limited.ok) {
    return NextResponse.json(
      { error: `Too many booking attempts. Try again in ${limited.retryAfterSec}s.` },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    )
  }

  const body = await request.json().catch(() => ({}))
  const parsed = bookingCreateSchema.safeParse({
    ...body,
    source: "public",
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid booking payload.", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  try {
    const result = await createBookingsFromInput(parsed.data)
    const primary = result.bookings[0]
    const depositAmount = result.bookings.reduce(
      (sum, b) => sum + b.depositAmount,
      0,
    )
    const totalPrice = result.bookings.reduce((sum, b) => sum + b.totalPrice, 0)

    return NextResponse.json(
      {
        bookingId: primary.id,
        referenceCode: primary.referenceCode,
        depositAmount: Number(depositAmount.toFixed(2)),
        totalPrice: Number(totalPrice.toFixed(2)),
        balanceDue: Number((totalPrice - depositAmount).toFixed(2)),
        currency: primary.currency,
        freeCancellationUntil: primary.freeCancellationUntil,
        freeCancellationHours: primary.freeCancellationHours,
        bookings: result.bookings,
      },
      { status: 201 },
    )
  } catch (error) {
    const err = error as Error & { code?: string }
    const message = err.message || "Failed to create booking."
    if (err.code === "VEHICLE_DISABLED" || err.name === "VehicleDisabledError") {
      return NextResponse.json(
        { error: message, code: "VEHICLE_DISABLED" },
        { status: 400 },
      )
    }
    if (err.code === "ROUTE_ADDRESS_MISMATCH" || err.name === "RouteAddressMismatchError") {
      return NextResponse.json(
        { error: message, code: "ROUTE_ADDRESS_MISMATCH" },
        { status: 400 },
      )
    }
    const status =
      message.includes("outside") || message.includes("Uncovered")
        ? 404
        : message.startsWith("Invalid") || message.includes("seats up to") || message.includes("holds up to")
          ? 400
          : 500
    return NextResponse.json({ error: message }, { status })
  }
}
