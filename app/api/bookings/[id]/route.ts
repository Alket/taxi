import { NextResponse } from "next/server"
import { z } from "zod"

import {
  findBookingForLookup,
  serializeManagedBooking,
} from "@/lib/managed-booking"
import {
  isPublicSelfServiceOpen,
  publicSelfServiceWhere,
} from "@/lib/booking-status"
import { clientIpFromRequest } from "@/lib/client-ip"
import { prisma } from "@/lib/db"
import { takeRateLimit } from "@/lib/rate-limit"
import { getBookingPolicy } from "@/lib/settings"

/** Caps public pickup-time churn that would spam ops alerts. */
const PUBLIC_DATE_EDIT_LIMIT = 8
const PUBLIC_DATE_EDIT_WINDOW_MS = 30 * 60 * 1000
/** Caps PATCH attempts (edit + email probing). */
const PUBLIC_PATCH_LIMIT = 30
const PUBLIC_PATCH_WINDOW_MS = 15 * 60 * 1000

const bodySchema = z.object({
  email: z.string().email(),
  pickupDateTime: z.string().optional(),
  // Rejected explicitly below — vehicle/party changes would reprice after
  // checkout and allow underpaying a raised total.
  passengerCount: z.unknown().optional(),
  vehicleType: z.unknown().optional(),
})

/**
 * Public booking edit — only before driver assignment.
 * Requires matching customer email. Pickup time only (no vehicle/price changes).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const ip = clientIpFromRequest(request)
  const limited = takeRateLimit(
    `public-booking-patch:${ip}`,
    PUBLIC_PATCH_LIMIT,
    PUBLIC_PATCH_WINDOW_MS,
  )
  if (!limited.ok) {
    return NextResponse.json(
      {
        error: `Too many requests. Try again in ${limited.retryAfterSec}s.`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    )
  }

  const json = await request.json().catch(() => ({}))
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update payload." }, { status: 400 })
  }

  if (
    parsed.data.vehicleType !== undefined ||
    parsed.data.passengerCount !== undefined
  ) {
    return NextResponse.json(
      {
        error:
          "Vehicle and passenger count cannot be changed online. Contact support or start a new booking.",
        code: "VEHICLE_LOCKED",
      },
      { status: 409 },
    )
  }

  const email = parsed.data.email.trim().toLowerCase()
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { customer: true },
  })

  // Same generic 404 for missing id / wrong email — no ownership oracle.
  if (!booking || booking.customer.email.toLowerCase() !== email) {
    return NextResponse.json(
      { error: "We couldn't find a booking matching those details." },
      { status: 404 },
    )
  }

  if (!isPublicSelfServiceOpen(booking)) {
    return NextResponse.json(
      {
        error:
          "This booking can no longer be edited once a driver is assigned.",
      },
      { status: 409 },
    )
  }

  const data: Record<string, unknown> = {}
  let pickupDateTime = booking.pickupDateTime

  if (parsed.data.pickupDateTime) {
    const next = new Date(parsed.data.pickupDateTime)
    if (Number.isNaN(next.getTime()) || next.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "Pickup must be a future date and time." },
        { status: 400 },
      )
    }
    pickupDateTime = next
    data.pickupDateTime = next
  }

  if (data.pickupDateTime) {
    try {
      const { freeCancellationHours } = await getBookingPolicy()
      data.freeCancellationUntil = new Date(
        pickupDateTime.getTime() - freeCancellationHours * 60 * 60 * 1000,
      )
    } catch {
      // Keep existing deadline if settings unavailable.
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No changes provided." }, { status: 400 })
  }

  const previousPickup = booking.pickupDateTime
  const dateChanged =
    data.pickupDateTime instanceof Date &&
    previousPickup.getTime() !== (data.pickupDateTime as Date).getTime()

  if (dateChanged) {
    const dateLimited = takeRateLimit(
      `public-date-edit:${id}`,
      PUBLIC_DATE_EDIT_LIMIT,
      PUBLIC_DATE_EDIT_WINDOW_MS,
    )
    if (!dateLimited.ok) {
      return NextResponse.json(
        {
          error: `You've changed the pickup time too many times. Try again in ${dateLimited.retryAfterSec}s.`,
        },
        {
          status: 429,
          headers: { "Retry-After": String(dateLimited.retryAfterSec) },
        },
      )
    }
  }

  const result = await prisma.booking.updateMany({
    where: publicSelfServiceWhere(id),
    data,
  })
  if (result.count === 0) {
    return NextResponse.json(
      {
        error:
          "This booking can no longer be edited once a driver is assigned.",
      },
      { status: 409 },
    )
  }

  if (dateChanged) {
    try {
      const { notifyBookingDateChanged } = await import(
        "@/lib/emails/booking-events"
      )
      // Emails + admin inbox/push — never block the customer response.
      void notifyBookingDateChanged(id, previousPickup).catch((err) => {
        console.error("[bookings] date-change notify failed:", err)
      })
    } catch {
      // never block edit
    }
  }

  const updated = await findBookingForLookup(booking.referenceCode, email)
  return NextResponse.json({
    booking: updated ? serializeManagedBooking(updated) : null,
  })
}
