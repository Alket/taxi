/**
 * Whether public surfaces may reveal the pickup PIN.
 * Unpaid pending checkouts must not expose it (create API / confirmation URL).
 */
export function shouldRevealPickupPin(booking: {
  paymentStatus: string
  status: string
  notes?: string | null
}): boolean {
  const paid =
    booking.paymentStatus === "deposit_paid" ||
    booking.paymentStatus === "fully_paid" ||
    booking.paymentStatus === "paid"
  if (paid) return true

  const cashOnArrival =
    (booking.notes?.toLowerCase() ?? "").includes("cash on arrival") &&
    booking.status !== "pending" &&
    booking.status !== "abandoned" &&
    booking.status !== "cancelled"
  return cashOnArrival
}
