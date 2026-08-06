import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdmin, requireCanDelete, requireStaffSession } from "@/lib/auth"
import { isBookingLockedForEdit } from "@/lib/booking-status"
import {
  bookingDetailInclude,
  serializeBookingDetail,
} from "@/lib/bookings"
import { prisma } from "@/lib/db"
import { getBookingPolicy } from "@/lib/settings"
import {
  assertVehicleFitsParty,
  round2,
  vehicleCapacitiesFromSettingsRow,
  vehicleTypeSchema,
} from "@/lib/vehicles"

const updateBookingSchema = z
  .object({
    pickupAddress: z.string().trim().min(1).max(400).optional(),
    dropoffAddress: z.string().trim().min(1).max(400).optional(),
    pickupDateTime: z.string().min(1).optional(),
    flightNumber: z.string().trim().max(40).optional(),
    passengerCount: z.coerce.number().int().min(1).max(20).optional(),
    luggageCount: z.coerce.number().int().min(0).max(30).optional(),
    vehicleType: vehicleTypeSchema.optional(),
    totalPrice: z.coerce.number().min(0).optional(),
    depositAmount: z.coerce.number().min(0).optional(),
    notes: z.string().trim().max(2000).optional().nullable(),
    meetAndGreet: z.boolean().optional(),
    direction: z.enum(["airport_to_dest", "dest_to_airport"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "No fields provided.",
  })

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const session = await requireStaffSession(request)
  if ("error" in session) return session.error

  const { id } = await context.params

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: bookingDetailInclude,
  })

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 })
  }

  return NextResponse.json({ booking: serializeBookingDetail(booking) })
}

export async function PATCH(request: Request, context: RouteContext) {
  const denied = await requireAdmin(
    "Your account cannot edit bookings. Ask an admin.",
    request,
  )
  if (denied) return denied

  const { id } = await context.params
  const body = await request.json().catch(() => ({}))
  const parsed = updateBookingSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid booking payload." },
      { status: 400 },
    )
  }

  const existing = await prisma.booking.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 })
  }

  if (isBookingLockedForEdit(existing.status)) {
    return NextResponse.json(
      {
        error:
          existing.status === "pending"
            ? "Confirm the booking before editing trip details."
            : existing.status === "cancelled"
              ? "Cancelled bookings cannot be edited."
              : "This booking can no longer be edited after the driver has arrived.",
      },
      { status: 409 },
    )
  }

  const previousPickup = existing.pickupDateTime
  let pickupChanged = false

  const data: Record<string, unknown> = { ...parsed.data }

  if (parsed.data.pickupDateTime) {
    const pickupDateTime = new Date(parsed.data.pickupDateTime)
    if (Number.isNaN(pickupDateTime.getTime())) {
      return NextResponse.json(
        { error: "Invalid pickup date/time." },
        { status: 400 },
      )
    }
    data.pickupDateTime = pickupDateTime
    pickupChanged = pickupDateTime.getTime() !== previousPickup.getTime()
  }

  const nextTotal =
    parsed.data.totalPrice != null
      ? round2(parsed.data.totalPrice)
      : Number(existing.totalPrice)
  const nextDeposit =
    parsed.data.depositAmount != null
      ? round2(parsed.data.depositAmount)
      : Number(existing.depositAmount)

  if (parsed.data.totalPrice != null || parsed.data.depositAmount != null) {
    data.totalPrice = nextTotal
    data.depositAmount = nextDeposit
    data.balanceDue = round2(
      Math.max(0, nextTotal - Number(existing.depositPaid)),
    )
  }

  if (
    parsed.data.vehicleType !== undefined ||
    parsed.data.passengerCount !== undefined ||
    parsed.data.luggageCount !== undefined
  ) {
    try {
      const policy = await getBookingPolicy()
      assertVehicleFitsParty(
        parsed.data.vehicleType ?? existing.vehicleType,
        parsed.data.passengerCount ?? existing.passengerCount,
        parsed.data.luggageCount ?? existing.luggageCount,
        vehicleCapacitiesFromSettingsRow(policy),
      )
    } catch (error) {
      return NextResponse.json(
        { error: (error as Error).message || "Party does not fit this vehicle." },
        { status: 400 },
      )
    }
  }

  const updated = await prisma.booking.update({
    where: { id },
    data,
    include: bookingDetailInclude,
  })

  if (pickupChanged) {
    try {
      const { notifyBookingDateChanged } = await import(
        "@/lib/emails/booking-events"
      )
      await notifyBookingDateChanged(id, previousPickup)
    } catch {
      // never block edit
    }
  }

  return NextResponse.json({ booking: serializeBookingDetail(updated) })
}

export async function DELETE(request: Request, context: RouteContext) {
  const staff = await requireStaffSession(request)
  if ("error" in staff) return staff.error

  const denied = await requireCanDelete()
  if (denied) return denied

  const { id } = await context.params

  const existing = await prisma.booking.findUnique({
    where: { id },
    select: { id: true, referenceCode: true },
  })
  if (!existing) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 })
  }

  await prisma.booking.delete({ where: { id } })
  return NextResponse.json({
    ok: true,
    referenceCode: existing.referenceCode,
  })
}
