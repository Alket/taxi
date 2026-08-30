import { isPickupTooSoon } from "@/lib/pickup-lead-time"
import {
  isCheckoutSuperseded,
  isPublicAwaitingDeposit,
} from "@/lib/booking-notes"

/** Age after which unpaid public checkouts are marked Abandoned by cron. */
export const PENDING_CHECKOUT_TTL_MS = 60 * 60 * 1000 // 1 hour

/**
 * How long an Abandoned (or still-pending) unpaid checkout can still be paid /
 * resumed from create time. After this, customer must start a new booking.
 */
export const ABANDONED_RESUME_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export type CheckoutPayableBooking = {
  status: string
  paymentStatus: string
  createdAt: Date
  notes: string | null
  pickupDateTime?: Date
}

export type CheckoutGateFailure = {
  ok: false
  status: number
  code: "NOT_PAYABLE" | "SESSION_EXPIRED" | "SUPERSEDED" | "PICKUP_TOO_SOON"
  error: string
}

/**
 * Shared gate for cash / Stripe / PayPal / POK checkout on public bookings.
 * Allows `pending` and `abandoned` while unpaid, within resume TTL, not superseded.
 */
export function assertCheckoutPayable(
  booking: CheckoutPayableBooking,
): { ok: true } | CheckoutGateFailure {
  if (booking.status === "cancelled") {
    return {
      ok: false,
      status: 409,
      code: "NOT_PAYABLE",
      error: "This booking was cancelled.",
    }
  }

  if (
    booking.paymentStatus === "deposit_paid" ||
    booking.paymentStatus === "fully_paid" ||
    booking.paymentStatus === "paid"
  ) {
    return {
      ok: false,
      status: 409,
      code: "NOT_PAYABLE",
      error: "This booking is no longer awaiting payment.",
    }
  }

  if (booking.paymentStatus !== "unpaid") {
    return {
      ok: false,
      status: 409,
      code: "NOT_PAYABLE",
      error: "This booking is no longer awaiting payment.",
    }
  }

  if (booking.status !== "pending" && booking.status !== "abandoned") {
    return {
      ok: false,
      status: 409,
      code: "NOT_PAYABLE",
      error: "This booking is no longer awaiting payment.",
    }
  }

  if (isCheckoutSuperseded(booking.notes)) {
    return {
      ok: false,
      status: 409,
      code: "SUPERSEDED",
      error:
        "This checkout was replaced by a newer booking. Please continue with your latest booking.",
    }
  }

  if (Date.now() - booking.createdAt.getTime() > ABANDONED_RESUME_TTL_MS) {
    return {
      ok: false,
      status: 410,
      code: "SESSION_EXPIRED",
      error: "This payment session has expired. Please start a new booking.",
    }
  }

  if (booking.pickupDateTime && isPickupTooSoon(booking.pickupDateTime)) {
    return {
      ok: false,
      status: 409,
      code: "PICKUP_TOO_SOON",
      error: "Pickup is too soon to complete this checkout. Please start a new booking.",
    }
  }

  return { ok: true }
}

export function isStalePendingCheckout(booking: {
  status: string
  paymentStatus: string
  createdAt: Date
  notes: string | null
}): boolean {
  return (
    booking.status === "pending" &&
    booking.paymentStatus === "unpaid" &&
    isPublicAwaitingDeposit(booking.notes) &&
    Date.now() - booking.createdAt.getTime() >= PENDING_CHECKOUT_TTL_MS
  )
}
