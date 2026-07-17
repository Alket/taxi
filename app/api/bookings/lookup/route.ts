import { NextResponse } from "next/server"

import {
  findBookingForLookup,
  serializeManagedBooking,
} from "@/lib/managed-booking"

/**
 * Customer self-service lookup. Requires both reference + email.
 * Always returns the same generic 404 message on mismatch.
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

  return NextResponse.json({ booking: serializeManagedBooking(booking) })
}
