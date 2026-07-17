import type { PaymentStatus } from "@/lib/types"
import { round2 } from "@/lib/vehicles"

/**
 * Cash the driver should collect at pickup/drop-off.
 * - Fully paid online → 0
 * - Deposit paid → remaining balance
 * - Unpaid / cash on arrival → full trip total
 */
export function cashToCollect(args: {
  totalPrice: number
  balanceDue: number
  depositPaid: number
  paymentStatus: PaymentStatus
}): number {
  if (
    args.paymentStatus === "fully_paid" ||
    args.paymentStatus === "paid" ||
    args.paymentStatus === "refunded"
  ) {
    return 0
  }

  if (args.paymentStatus === "deposit_paid") {
    return round2(Math.max(0, args.balanceDue))
  }

  // unpaid / failed → collect the full fare (or remaining balance if set)
  const due = args.balanceDue > 0 ? args.balanceDue : args.totalPrice
  return round2(Math.max(0, due))
}

export function cashCollectLabel(args: {
  cashAmount: number
  paymentStatus: PaymentStatus
}): string {
  if (args.cashAmount <= 0) return "Nothing to collect (paid online)"
  if (args.paymentStatus === "deposit_paid") return "Collect balance in cash"
  return "Collect full amount in cash"
}
