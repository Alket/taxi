import { NextResponse } from "next/server"
import { z } from "zod"

import { isAdmin, requireStaffSession } from "@/lib/auth"
import {
  bookingDetailInclude,
  serializeBookingDetail,
} from "@/lib/bookings"
import { prisma } from "@/lib/db"
import { applyInternalNotesChange } from "@/lib/internal-notes"

const updateInternalNotesSchema = z.object({
  internalNotes: z.string().trim().max(4000),
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
 * Staff-only: admin and operator can add/edit internal notes.
 * Clearing (delete) is admin-only — operators must keep existing content.
 * Every change writes an append-only history row.
 */
export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireStaffSession(request)
  if ("error" in session) return session.error

  const { id } = await context.params
  const body = await request.json().catch(() => ({}))
  const parsed = updateInternalNotesSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid internal notes payload." },
      { status: 400 },
    )
  }

  const existing = await prisma.booking.findUnique({
    where: { id },
    select: { id: true, internalNotes: true },
  })
  if (!existing) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 })
  }

  const next = parsed.data.internalNotes
  if (!next && !isAdmin(session.user)) {
    return NextResponse.json(
      {
        error:
          "Operators cannot delete internal notes. Ask an admin to clear them.",
      },
      { status: 403 },
    )
  }

  try {
    await applyInternalNotesChange({
      bookingId: id,
      nextNotes: next || null,
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
    booking: booking ? serializeBookingDetail(booking) : null,
  })
}

/** Admin-only: permanently clear the internal note (audited as deleted). */
export async function DELETE(request: Request, context: RouteContext) {
  const session = await requireStaffSession(request)
  if ("error" in session) return session.error

  if (!isAdmin(session.user)) {
    return NextResponse.json(
      {
        error:
          "Your account cannot delete internal notes. Ask an admin.",
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
    await applyInternalNotesChange({
      bookingId: id,
      nextNotes: null,
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
    booking: booking ? serializeBookingDetail(booking) : null,
  })
}
