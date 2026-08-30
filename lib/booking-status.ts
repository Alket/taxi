import type { BookingStatus } from "@/lib/types"

/** Operational trip flow shown in timelines and used for transitions. */
export const BOOKING_STATUS_FLOW: BookingStatus[] = [
  "pending",
  "confirmed",
  "driver_assigned",
  "driver_accepted",
  "arrived",
  "completed",
]

/** Statuses drivers may set from their dashboard. */
export const DRIVER_SETTABLE_STATUSES: BookingStatus[] = [
  "driver_accepted",
  "arrived",
  "completed",
]

/** Pending / abandoned checkout or trip in progress/done — admin cannot edit trip details. */
export function isBookingLockedForEdit(status: BookingStatus): boolean {
  return (
    status === "pending" ||
    status === "abandoned" ||
    isTripInProgressOrDone(status)
  )
}

/** Pending / abandoned checkout or trip in progress/done — admin cannot assign/reassign. */
export function isBookingLockedForDriverAssign(status: BookingStatus): boolean {
  return (
    status === "pending" ||
    status === "abandoned" ||
    isTripInProgressOrDone(status)
  )
}

/** Once the driver has arrived (or the trip is finished/cancelled), the booking cannot be cancelled. */
export function isBookingLockedForCancel(status: BookingStatus): boolean {
  return isTripInProgressOrDone(status)
}

/**
 * Customer self-service on /my-booking (cancel + edit pickup).
 * Locked once a driver is assigned — admin cancel remains available longer.
 */
export function isPublicSelfServiceOpen(booking: {
  status: BookingStatus
  driverId: string | null
}): boolean {
  if (booking.driverId) return false
  return booking.status === "pending" || booking.status === "confirmed"
}

/** Prisma `where` for atomic public cancel/edit — closes TOCTOU vs driver assign. */
export function publicSelfServiceWhere(id: string) {
  return {
    id,
    driverId: null as string | null,
    status: { in: ["pending", "confirmed"] as BookingStatus[] },
  }
}

function isTripInProgressOrDone(status: BookingStatus): boolean {
  return (
    status === "arrived" ||
    status === "completed" ||
    status === "cancelled" ||
    status === "in_progress"
  )
}

export function getNextFlowStatus(
  status: BookingStatus,
): BookingStatus | null {
  // Legacy statuses kept in the DB enum but removed from the operational flow.
  if (status === "en_route") return "arrived"
  if (status === "in_progress") return "completed"

  const index = BOOKING_STATUS_FLOW.indexOf(status)
  if (index < 0 || index >= BOOKING_STATUS_FLOW.length - 1) {
    return null
  }
  return BOOKING_STATUS_FLOW[index + 1]!
}

export function validateStatusTransition(
  current: BookingStatus,
  next: BookingStatus,
): { ok: true } | { ok: false; error: string } {
  if (current === "cancelled") {
    return { ok: false, error: "Cancelled bookings cannot change status." }
  }
  if (current === "abandoned") {
    return {
      ok: false,
      error: "Abandoned checkouts cannot change status. Customer must complete payment or start a new booking.",
    }
  }
  if (current === "completed") {
    return { ok: false, error: "Completed bookings cannot change status." }
  }
  if (next === "cancelled") {
    return {
      ok: false,
      error: "Use the cancel endpoint to cancel a booking.",
    }
  }
  if (
    !BOOKING_STATUS_FLOW.includes(next) &&
    next !== "arrived" &&
    next !== "completed"
  ) {
    return { ok: false, error: `Unknown status: ${next}` }
  }

  const expected = getNextFlowStatus(current)
  if (!expected) {
    return { ok: false, error: "Booking is already at the final status." }
  }
  if (next !== expected) {
    return {
      ok: false,
      error: `Invalid status transition from "${current}" to "${next}". The next allowed status is "${expected}".`,
    }
  }

  return { ok: true }
}
