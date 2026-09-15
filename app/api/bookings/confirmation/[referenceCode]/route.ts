import { NextResponse } from "next/server"

import { clientIpFromRequest } from "@/lib/client-ip"
import { prisma } from "@/lib/db"
import { VEHICLE_LABELS, DIRECTION_LABELS } from "@/lib/format"
import { takeRateLimit } from "@/lib/rate-limit"
import type { Direction, VehicleType } from "@/lib/types"

type RouteContext = {
  params: Promise<{ referenceCode: string }>
}

/**
 * Public confirmation payload. Requires matching customer email so a
 * guessable TRF-****** reference alone cannot expose trip details.
 */
export async function GET(request: Request, context: RouteContext) {
  const ip = clientIpFromRequest(request)
  const limited = takeRateLimit(`public-booking-confirm:${ip}`, 40, 15 * 60 * 1000)
  if (!limited.ok) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${limited.retryAfterSec}s.` },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    )
  }

  const { referenceCode: raw } = await context.params
  const referenceCode = raw?.trim().toUpperCase()
  const email = new URL(request.url).searchParams.get("email")?.trim().toLowerCase() ?? ""

  if (!referenceCode || !email) {
    return NextResponse.json({ error: "Not found." }, { status: 404 })
  }

  const booking = await prisma.booking.findUnique({
    where: { referenceCode },
    select: {
      referenceCode: true,
      direction: true,
      pickupAddress: true,
      dropoffAddress: true,
      pickupDateTime: true,
      flightNumber: true,
      vehicleType: true,
      passengerCount: true,
      luggageCount: true,
      meetAndGreet: true,
      isRoundTrip: true,
      totalPrice: true,
      depositAmount: true,
      depositPaid: true,
      balanceDue: true,
      currency: true,
      status: true,
      paymentStatus: true,
      freeCancellationUntil: true,
      customer: { select: { email: true } },
    },
  })

  if (!booking || booking.customer.email.toLowerCase() !== email) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 })
  }

  const paymentSucceeded =
    booking.paymentStatus === "deposit_paid" ||
    booking.paymentStatus === "fully_paid" ||
    booking.paymentStatus === "paid"

  return NextResponse.json({
    referenceCode: booking.referenceCode,
    direction: booking.direction,
    directionLabel: DIRECTION_LABELS[booking.direction as Direction],
    pickupAddress: booking.pickupAddress,
    dropoffAddress: booking.dropoffAddress,
    pickupDateTime: booking.pickupDateTime.toISOString(),
    flightNumber: booking.flightNumber || null,
    vehicleType: booking.vehicleType,
    vehicleLabel: VEHICLE_LABELS[booking.vehicleType as VehicleType],
    passengerCount: booking.passengerCount,
    luggageCount: booking.luggageCount,
    meetAndGreet: booking.meetAndGreet,
    isRoundTrip: booking.isRoundTrip,
    currency: booking.currency,
    totalPrice: Number(booking.totalPrice),
    depositAmount: Number(booking.depositAmount),
    depositPaid: Number(booking.depositPaid),
    balanceDue: Number(booking.balanceDue),
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    paymentSucceeded,
    freeCancellationUntil: booking.freeCancellationUntil.toISOString(),
  })
}
