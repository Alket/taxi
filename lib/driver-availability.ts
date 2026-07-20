import type { BookingStatus } from "@prisma/client"

import { prisma } from "@/lib/db"

/** Statuses that mean the driver is still tied up with that trip. */
export const DRIVER_BUSY_STATUSES: BookingStatus[] = [
  "pending",
  "confirmed",
  "driver_assigned",
  "driver_accepted",
  "en_route",
  "arrived",
  "in_progress",
]

/** Truncate to minute so "same date and time" matches admin-facing pickup slots. */
export function pickupMinuteRange(pickup: Date) {
  const start = new Date(pickup)
  start.setSeconds(0, 0)
  const end = new Date(start)
  end.setMinutes(end.getMinutes() + 1)
  return { start, end }
}

export type DriverPickupConflict = {
  id: string
  referenceCode: string
  pickupDateTime: Date
}

/**
 * Returns an active booking for this driver at the same pickup date+time
 * (to the minute), excluding `excludeBookingId`.
 */
export async function findDriverPickupConflict(args: {
  driverId: string
  pickupDateTime: Date
  excludeBookingId?: string
}): Promise<DriverPickupConflict | null> {
  const { start, end } = pickupMinuteRange(args.pickupDateTime)

  return prisma.booking.findFirst({
    where: {
      driverId: args.driverId,
      status: { in: DRIVER_BUSY_STATUSES },
      pickupDateTime: { gte: start, lt: end },
      ...(args.excludeBookingId
        ? { id: { not: args.excludeBookingId } }
        : {}),
    },
    select: {
      id: true,
      referenceCode: true,
      pickupDateTime: true,
    },
    orderBy: { pickupDateTime: "asc" },
  })
}
