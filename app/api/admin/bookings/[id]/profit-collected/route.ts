import { NextResponse } from "next/server"
import { z } from "zod"

import { isAdmin, requireStaffSession } from "@/lib/auth"
import {
  bookingDetailInclude,
  serializeBookingDetail,
} from "@/lib/bookings"
import { prisma } from "@/lib/db"
import { round2 } from "@/lib/vehicles"

const updateSchema = z.object({
  collected: z.boolean(),
})

type RouteContext = {
  params: Promise<{ id: string }>
}

/**
 * Staff-only: mark or clear that office received company profit cash
 * from the driver.
 *
 * On mark, freezes profitCollectedAmount = totalPrice − driverCost.
 * - Admin + Operator may mark as collected (when not already collected).
 * - Only Admin may undo / revert to not collected.
 * - Operators cannot modify the record after it is collected.
 */
export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireStaffSession(request)
  if ("error" in session) return session.error

  const { id } = await context.params
  const body = await request.json().catch(() => ({}))
  const parsed = updateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid profit collected payload." },
      { status: 400 },
    )
  }

  const existing = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      totalPrice: true,
      driverCost: true,
      profitCollectedAt: true,
    },
  })
  if (!existing) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 })
  }

  const alreadyCollected = existing.profitCollectedAt != null
  const admin = isAdmin(session.user)

  if (!parsed.data.collected) {
    if (!admin) {
      return NextResponse.json(
        {
          error:
            "Operators cannot undo Profit Collected. Ask an admin to revert it.",
        },
        { status: 403 },
      )
    }
  } else {
    if (alreadyCollected && !admin) {
      return NextResponse.json(
        {
          error:
            "Profit is already marked collected. Operators cannot change this record.",
        },
        { status: 403 },
      )
    }
    if (existing.status !== "completed") {
      return NextResponse.json(
        {
          error:
            "Profit can only be marked collected after the trip is completed.",
        },
        { status: 400 },
      )
    }
    if (existing.driverCost == null) {
      return NextResponse.json(
        {
          error:
            "Set a driver cost before marking profit collected (profit = client price − driver cost).",
        },
        { status: 400 },
      )
    }
  }

  const now = new Date()
  const frozenAmount =
    existing.driverCost == null
      ? null
      : round2(Number(existing.totalPrice) - Number(existing.driverCost))

  await prisma.booking.update({
    where: { id },
    data: parsed.data.collected
      ? {
          profitCollectedAt: now,
          profitCollectedById: session.user.id,
          profitCollectedAmount: frozenAmount,
        }
      : {
          profitCollectedAt: null,
          profitCollectedById: null,
          profitCollectedAmount: null,
        },
  })

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: bookingDetailInclude,
  })

  return NextResponse.json({
    booking: booking
      ? serializeBookingDetail(booking, {
          includeDriverCostHistory: admin,
        })
      : null,
  })
}
