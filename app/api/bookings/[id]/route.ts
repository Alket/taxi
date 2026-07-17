import { NextResponse } from "next/server"
import { z } from "zod"

import {
  findBookingForLookup,
  serializeManagedBooking,
} from "@/lib/managed-booking"
import { prisma } from "@/lib/db"
import { getBookingPolicy } from "@/lib/settings"
import { round2 } from "@/lib/vehicles"

const bodySchema = z.object({
  email: z.string().email(),
  pickupDateTime: z.string().optional(),
  passengerCount: z.coerce.number().int().min(1).max(30).optional(),
  vehicleType: z.enum(["sedan", "comfort", "minivan", "premium"]).optional(),
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

  if (booking.status !== "pending" && booking.status !== "confirmed") {
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

  await prisma.booking.update({ where: { id }, data })

  const updated = await findBookingForLookup(booking.referenceCode, email)
  return NextResponse.json({
    booking: updated ? serializeManagedBooking(updated) : null,
  })
}
