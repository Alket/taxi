import type { AdminUser, DriverCostAction, Prisma } from "@prisma/client"

import { prisma } from "@/lib/db"
import { round2 } from "@/lib/vehicles"

export type DriverCostActor = Pick<AdminUser, "id" | "name">

function classifyAction(
  previous: number | null,
  next: number | null,
): DriverCostAction {
  if (previous == null && next != null) return "created"
  if (previous != null && next == null) return "deleted"
  return "updated"
}

function normalizeAmount(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(value)) return null
  return round2(value)
}

/**
 * Persist staff-only driver cost and an append-only history row.
 * Callers must already enforce role rules (operators cannot clear).
 */
export async function applyDriverCostChange(input: {
  bookingId: string
  nextAmount: number | null
  actor: DriverCostActor
}): Promise<void> {
  const existing = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    select: { id: true, driverCost: true },
  })
  if (!existing) {
    throw new Error("BOOKING_NOT_FOUND")
  }

  const previousAmount =
    existing.driverCost == null ? null : Number(existing.driverCost)
  const nextAmount = normalizeAmount(input.nextAmount)

  const prevNorm =
    previousAmount == null ? null : round2(previousAmount)
  const nextNorm = nextAmount

  if (prevNorm === nextNorm) {
    return
  }

  const action = classifyAction(prevNorm, nextNorm)
  const now = new Date()

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: input.bookingId },
      data: {
        driverCost: nextNorm,
        driverCostUpdatedAt: now,
        driverCostUpdatedById: input.actor.id,
      },
    })
    await tx.bookingDriverCostEvent.create({
      data: {
        bookingId: input.bookingId,
        actorId: input.actor.id,
        actorName: input.actor.name,
        action,
        previousAmount: prevNorm,
        nextAmount: nextNorm,
      },
    })
  })
}

export type DriverCostHistoryRecord = Prisma.BookingDriverCostEventGetPayload<{
  select: {
    id: true
    action: true
    actorName: true
    actorId: true
    previousAmount: true
    nextAmount: true
    createdAt: true
  }
}>

export const driverCostHistorySelect = {
  id: true,
  action: true,
  actorName: true,
  actorId: true,
  previousAmount: true,
  nextAmount: true,
  createdAt: true,
} satisfies Prisma.BookingDriverCostEventSelect

export const DRIVER_COST_HISTORY_LIMIT = 50
