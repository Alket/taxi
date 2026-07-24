import { NextResponse } from "next/server"

import { findBookingForLookup } from "@/lib/managed-booking"
import { prisma } from "@/lib/db"

/**
 * Public review lookup — reference + email (same pattern as /my-booking).
 * Returns whether the booking can accept a review.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const reference = searchParams.get("reference")?.trim() ?? ""
  const email = searchParams.get("email")?.trim() ?? ""

  if (!reference || !email) {
    return NextResponse.json(
      { error: "We couldn't find a booking matching those details." },
      { status: 404 },
    )
  }

  const booking = await findBookingForLookup(reference, email)
  if (!booking) {
    return NextResponse.json(
      { error: "We couldn't find a booking matching those details." },
      { status: 404 },
    )
  }

  if (booking.status !== "completed") {
    return NextResponse.json(
      { error: "Reviews are only available after the trip is completed." },
      { status: 409 },
    )
  }

  if (!booking.driverId || !booking.driver) {
    return NextResponse.json(
      { error: "This trip has no assigned driver to review." },
      { status: 409 },
    )
  }

  const existing = await prisma.review.findUnique({
    where: { bookingId: booking.id },
    select: { id: true, status: true },
  })

  return NextResponse.json({
    booking: {
      id: booking.id,
      referenceCode: booking.referenceCode,
      pickupAddress: booking.pickupAddress,
      dropoffAddress: booking.dropoffAddress,
      pickupDateTime: booking.pickupDateTime.toISOString(),
      customerName: booking.customer.name,
      customerEmail: booking.customer.email,
      driverName: booking.driver.name,
    },
    alreadySubmitted: Boolean(existing),
    reviewStatus: existing?.status ?? null,
  })
}
