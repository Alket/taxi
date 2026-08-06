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
import { prisma } from "@/lib/db"
import { getBookingPolicy } from "@/lib/settings"
import { takeRateLimit } from "@/lib/rate-limit"
import {
  assertVehicleFitsParty,
  round2,
  vehicleCapacitiesFromSettingsRow,
  vehicleTypeSchema,
} from "@/lib/vehicles"

/** Caps public pickup-time churn that would spam ops alerts. */
const PUBLIC_DATE_EDIT_LIMIT = 8
const PUBLIC_DATE_EDIT_WINDOW_MS = 30 * 60 * 1000

const bodySchema = z.object({
  email: z.string().email(),
  pickupDateTime: z.string().optional(),
  passengerCount: z.coerce.number().int().min(1).max(20).optional(),
  vehicleType: vehicleTypeSchema.optional(),
})

/**
 * Public booking edit — only before driver assignment.
 * Requires matching customer email.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const json = await request.json().catch(() => ({}))
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update payload." }, { status: 400 })
  }

  const email = parsed.data.email.trim().toLowerCase()
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { customer: true },
  })

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

  if (parsed.data.passengerCount !== undefined) {
    data.passengerCount = parsed.data.passengerCount
  }

  const vehicleType = parsed.data.vehicleType ?? booking.vehicleType
  if (parsed.data.vehicleType) {
    data.vehicleType = parsed.data.vehicleType
  }

  if (
    parsed.data.passengerCount !== undefined ||
    parsed.data.vehicleType !== undefined
  ) {
    try {
      const policy = await getBookingPolicy()
      assertVehicleFitsParty(
        vehicleType,
        parsed.data.passengerCount ?? booking.passengerCount,
        booking.luggageCount,
        vehicleCapacitiesFromSettingsRow(policy),
      )
    } catch (error) {
      return NextResponse.json(
        { error: (error as Error).message || "Party does not fit this vehicle." },
        { status: 400 },
      )
    }
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

  if (
    parsed.data.vehicleType &&
    parsed.data.vehicleType !== booking.vehicleType &&
    booking.zoneId
  ) {
    try {
      const { depositPercentage } = await getBookingPolicy()
      const [oldRule, newRule] = await Promise.all([
        prisma.pricingRule.findFirst({
          where: {
            zoneId: booking.zoneId,
            vehicleType: booking.vehicleType,
            active: true,
          },
        }),
        prisma.pricingRule.findFirst({
          where: {
            zoneId: booking.zoneId,
            vehicleType,
            active: true,
          },
        }),
      ])

      if (oldRule && newRule) {
        const oldBase = Number(oldRule.baseFare)
        const oldPerKm = Number(oldRule.perKmRate)
        const oldMin = Number(oldRule.minFare)
        const currentTotal = Number(booking.totalPrice)
        const estimatedKm =
          oldPerKm > 0
            ? Math.max(0, (Math.max(currentTotal, oldMin) - oldBase) / oldPerKm)
            : 0
        const computed =
          Number(newRule.baseFare) + Number(newRule.perKmRate) * estimatedKm
        const totalPrice = round2(Math.max(computed, Number(newRule.minFare)))
        const depositAmount = round2((totalPrice * depositPercentage) / 100)
        const depositPaid = Number(booking.depositPaid)
        data.totalPrice = totalPrice
        data.depositAmount = depositAmount
        data.balanceDue = round2(
          Math.max(0, totalPrice - Math.max(depositPaid, 0)),
        )
        if (depositPaid <= 0) {
          data.balanceDue = round2(totalPrice - depositAmount)
        }
      }
    } catch {
      // Keep existing prices if reprice fails.
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
    const limited = takeRateLimit(
      `public-date-edit:${id}`,
      PUBLIC_DATE_EDIT_LIMIT,
      PUBLIC_DATE_EDIT_WINDOW_MS,
    )
    if (!limited.ok) {
      return NextResponse.json(
        {
          error: `You've changed the pickup time too many times. Try again in ${limited.retryAfterSec}s.`,
        },
        {
          status: 429,
          headers: { "Retry-After": String(limited.retryAfterSec) },
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
