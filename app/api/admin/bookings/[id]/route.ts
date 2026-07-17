import { NextResponse } from "next/server"
import { z } from "zod"

import { requireCanDelete } from "@/lib/auth"
import {
  bookingDetailInclude,
  serializeBookingDetail,
} from "@/lib/bookings"
import { prisma } from "@/lib/db"
import { round2 } from "@/lib/vehicles"

const updateBookingSchema = z
  .object({
    pickupAddress: z.string().trim().min(1).max(400).optional(),
    dropoffAddress: z.string().trim().min(1).max(400).optional(),
    pickupDateTime: z.string().min(1).optional(),
    flightNumber: z.string().trim().max(40).optional(),
    passengerCount: z.coerce.number().int().min(1).max(30).optional(),
    luggageCount: z.coerce.number().int().min(0).max(50).optional(),
    vehicleType: z.enum(["sedan", "comfort", "minivan", "premium"]).optional(),
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

export async function GET(_request: Request, context: RouteContext) {
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

  if (existing.status === "cancelled") {
    return NextResponse.json(
      { error: "Cancelled bookings cannot be edited." },
      { status: 409 },
    )
  }

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

  const updated = await prisma.booking.update({
    where: { id },
    data,
    include: bookingDetailInclude,
  })

  return NextResponse.json({ booking: serializeBookingDetail(updated) })
}

export async function DELETE(_request: Request, context: RouteContext) {
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
