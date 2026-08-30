import {
  appendCheckoutSupersededNote,
  isPublicAwaitingDeposit,
} from "@/lib/booking-notes"
import { prisma } from "@/lib/db"
import { PENDING_CHECKOUT_TTL_MS } from "@/lib/payment-session"

/**
 * Mark older unpaid public checkouts for this customer as abandoned + superseded
 * so they cannot be paid after a newer checkout is created.
 */
export async function supersedeOlderPublicCheckouts(params: {
  customerId: string
  keepBookingIds: string[]
}): Promise<number> {
  const older = await prisma.booking.findMany({
    where: {
      customerId: params.customerId,
      id: { notIn: params.keepBookingIds },
      paymentStatus: "unpaid",
      status: { in: ["pending", "abandoned"] },
    },
    select: { id: true, status: true, notes: true, roundTripId: true },
  })

  const targets = older.filter((b) => isPublicAwaitingDeposit(b.notes))
  if (targets.length === 0) return 0

  const now = new Date()
  let count = 0

  for (const booking of targets) {
    const notes = appendCheckoutSupersededNote(booking.notes)
    const data =
      booking.status === "pending"
        ? {
            status: "abandoned" as const,
            notes,
            statusEvents: {
              create: [{ status: "abandoned" as const, timestamp: now }],
            },
          }
        : { notes }

    await prisma.booking.update({
      where: { id: booking.id },
      data,
    })
    count += 1
  }

  return count
}

export type AbandonCheckoutsResult = {
  candidates: number
  abandoned: number
  emailed: number
  skippedEmail: number
}

/**
 * Pending unpaid public checkouts older than PENDING_CHECKOUT_TTL_MS → abandoned,
 * then one recovery email (caller sends).
 */
export async function markStaleCheckoutsAbandoned(): Promise<
  { id: string; referenceCode: string }[]
> {
  const cutoff = new Date(Date.now() - PENDING_CHECKOUT_TTL_MS)
  const candidates = await prisma.booking.findMany({
    where: {
      status: "pending",
      paymentStatus: "unpaid",
      createdAt: { lt: cutoff },
      notes: { contains: "awaiting deposit", mode: "insensitive" },
    },
    select: { id: true, referenceCode: true, notes: true },
    take: 200,
    orderBy: { createdAt: "asc" },
  })

  const now = new Date()
  const abandoned: { id: string; referenceCode: string }[] = []

  for (const booking of candidates) {
    if (!isPublicAwaitingDeposit(booking.notes)) continue
    const updated = await prisma.booking.updateMany({
      where: {
        id: booking.id,
        status: "pending",
        paymentStatus: "unpaid",
      },
      data: { status: "abandoned" },
    })
    if (updated.count === 0) continue
    await prisma.bookingStatusEvent.create({
      data: { bookingId: booking.id, status: "abandoned", timestamp: now },
    })
    abandoned.push({
      id: booking.id,
      referenceCode: booking.referenceCode,
    })
  }

  return abandoned
}
