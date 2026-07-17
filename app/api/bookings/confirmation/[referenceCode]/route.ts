import { NextResponse } from "next/server"

import { prisma } from "@/lib/db"
import { VEHICLE_LABELS, DIRECTION_LABELS } from "@/lib/format"
import type { Direction, VehicleType } from "@/lib/types"

type RouteContext = {
  params: Promise<{ referenceCode: string }>
}

/**
 * Public confirmation payload — safe for a URL-guessable reference code.
 * Omits email, phone, and full customer identity.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { referenceCode: raw } = await context.params
  const referenceCode = raw?.trim().toUpperCase()

  if (!referenceCode) {
    return NextResponse.json({ error: "Not found." }, { status: 404 })
  }

  const booking = await prisma.booking.findUnique({
    where: { referenceCode },
    select: {
      referenceCode: true,
      pickupPin: true,
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
    },
  })

  if (!booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 })
  }

  const paymentSucceeded =
    booking.paymentStatus === "deposit_paid" ||
    booking.paymentStatus === "fully_paid" ||
    booking.paymentStatus === "paid"

  return NextResponse.json({
    referenceCode: booking.referenceCode,
    pickupPin: booking.pickupPin,
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
