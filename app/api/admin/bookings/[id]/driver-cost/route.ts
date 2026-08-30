import { NextResponse } from "next/server"
import { z } from "zod"

import { isAdmin, requireStaffSession } from "@/lib/auth"
import {
  bookingDetailInclude,
  serializeBookingDetail,
} from "@/lib/bookings"
import { applyDriverCostChange } from "@/lib/driver-cost"
import { prisma } from "@/lib/db"
import { round2 } from "@/lib/vehicles"

const updateDriverCostSchema = z.object({
  driverCost: z
    .union([z.number(), z.null()])
    .refine(
      (value) =>
        value === null ||
        (Number.isFinite(value) && value >= 0 && value <= 1_000_000),
      { message: "Driver cost must be between 0 and 1000000." },
    ),
})

type RouteContext = {
  params: Promise<{ id: string }>
}

async function loadDetail(id: string) {
  return prisma.booking.findUnique({
    where: { id },
    include: bookingDetailInclude,
  })
}

/**
 * Staff-only: admin and operator can add/edit driver cost.
 * Clearing is admin-only. History is returned to admins only.
 */
export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireStaffSession(request)
  if ("error" in session) return session.error

  const { id } = await context.params
  const body = await request.json().catch(() => ({}))
  const parsed = updateDriverCostSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid driver cost payload." },
      { status: 400 },
    )
  }

  const existing = await prisma.booking.findUnique({
    where: { id },
    select: { id: true, driverCost: true },
  })
  if (!existing) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 })
  }

  const next =
    parsed.data.driverCost === null
      ? null
      : round2(parsed.data.driverCost)

  if (next === null && !isAdmin(session.user)) {
    return NextResponse.json(
      {
        error:
          "Operators cannot clear driver cost. Ask an admin to clear it.",
      },
      { status: 403 },
    )
  }

  try {
    await applyDriverCostChange({
      bookingId: id,
      nextAmount: next,
      actor: { id: session.user.id, name: session.user.name },
    })
  } catch (error) {
    if (error instanceof Error && error.message === "BOOKING_NOT_FOUND") {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }
    throw error
  }

  const booking = await loadDetail(id)
  return NextResponse.json({
    booking: booking
      ? serializeBookingDetail(booking, {
          includeDriverCostHistory: isAdmin(session.user),
        })
      : null,
  })
}

/** Admin-only: clear driver cost (audited as deleted). History rows are kept. */
export async function DELETE(request: Request, context: RouteContext) {
  const session = await requireStaffSession(request)
  if ("error" in session) return session.error

  if (!isAdmin(session.user)) {
    return NextResponse.json(
      {
        error: "Your account cannot clear driver cost. Ask an admin.",
      },
      { status: 403 },
    )
  }

  const { id } = await context.params

  const existing = await prisma.booking.findUnique({
    where: { id },
    select: { id: true },
  })
  if (!existing) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 })
  }

  try {
    await applyDriverCostChange({
      bookingId: id,
      nextAmount: null,
      actor: { id: session.user.id, name: session.user.name },
    })
  } catch (error) {
    if (error instanceof Error && error.message === "BOOKING_NOT_FOUND") {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }
    throw error
  }

  const booking = await loadDetail(id)
  return NextResponse.json({
    booking: booking
      ? serializeBookingDetail(booking, {
          includeDriverCostHistory: true,
        })
      : null,
  })
}
