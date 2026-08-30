import { NextResponse } from "next/server"

import { isCheckoutSuperseded } from "@/lib/booking-notes"
import { verifyCheckoutResumeToken } from "@/lib/checkout-resume"
import { prisma } from "@/lib/db"
import { assertCheckoutPayable } from "@/lib/payment-session"

type RouteContext = { params: Promise<{ referenceCode: string }> }

/**
 * Validate resume token and return payload to hydrate the public booking store
 * onto the payment step for the same booking (no second create).
 */
export async function GET(request: Request, context: RouteContext) {
  const { referenceCode: raw } = await context.params
  const referenceCode = decodeURIComponent(raw).trim().toUpperCase()
  const token = new URL(request.url).searchParams.get("token")?.trim()
  if (!token) {
    return NextResponse.json(
      { error: "Resume token is required.", code: "TOKEN_REQUIRED" },
      { status: 400 },
    )
  }

  const bookingId = await verifyCheckoutResumeToken(token)
  if (!bookingId) {
    return NextResponse.json(
      { error: "This continue link is invalid or expired.", code: "TOKEN_INVALID" },
      { status: 401 },
    )
  }

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, referenceCode },
    include: {
      customer: true,
      zone: { select: { id: true, name: true } },
    },
  })

  if (!booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 })
  }

  if (isCheckoutSuperseded(booking.notes)) {
    return NextResponse.json(
      {
        error:
          "This checkout was replaced by a newer booking. Please continue with your latest booking.",
        code: "SUPERSEDED",
      },
      { status: 409 },
    )
  }

  const gate = assertCheckoutPayable(booking)
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.error, code: gate.code },
      { status: gate.status },
    )
  }

  return NextResponse.json({
    bookingId: booking.id,
    referenceCode: booking.referenceCode,
    depositAmount: Number(booking.depositAmount),
    totalPrice: Number(booking.totalPrice),
    balanceDue: Number(booking.balanceDue),
    currency: booking.currency,
    direction: booking.direction,
    pickupAddress: booking.pickupAddress,
    dropoffAddress: booking.dropoffAddress,
    pickupDateTime: booking.pickupDateTime.toISOString(),
    flightNumber: booking.flightNumber,
    passengerCount: booking.passengerCount,
    luggageCount: booking.luggageCount,
    vehicleType: booking.vehicleType,
    zoneId: booking.zoneId,
    meetAndGreet: booking.meetAndGreet,
    isRoundTrip: booking.isRoundTrip,
    customer: {
      name: booking.customer.name,
      email: booking.customer.email,
      phone: booking.customer.phone,
    },
  })
}
