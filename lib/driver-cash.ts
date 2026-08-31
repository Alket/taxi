import type { PaymentStatus } from "@/lib/types"
import { round2 } from "@/lib/vehicles"

/** True when this payment was recorded via driver “cash paid”. */
export function isDriverCashPayment(payment: {
  externalId?: string | null
}): boolean {
  return Boolean(payment.externalId?.startsWith("cash:"))
}

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

/**
 * Split a booking total into cash vs online after collection.
 *
 * Driver cash-paid sets `paymentStatus` to `fully_paid`, so status alone cannot
 * distinguish cash from card — use `cash:` payment rows when present.
 */
export function splitCollected(args: {
  totalPrice: number
  balanceDue: number
  depositPaid: number
  paymentStatus: PaymentStatus
  payments: { amount: number | { toString(): string }; externalId?: string | null }[]
}): { cash: number; online: number } {
  const total = round2(Math.max(0, Number(args.totalPrice)))
  const cashPaid = round2(
    args.payments
      .filter((payment) => isDriverCashPayment(payment))
      .reduce((sum, payment) => sum + Number(payment.amount), 0),
  )

  if (cashPaid > 0) {
    const cash = round2(Math.min(cashPaid, total))
    return { cash, online: round2(Math.max(0, total - cash)) }
  }

  const cash = cashToCollect({
    totalPrice: total,
    balanceDue: Number(args.balanceDue),
    depositPaid: Number(args.depositPaid),
    paymentStatus: args.paymentStatus,
  })
  return { cash, online: round2(Math.max(0, total - cash)) }
}

export function cashCollectLabel(args: {
  cashAmount: number
  paymentStatus: PaymentStatus
  /** True when the remaining balance was recorded as cash (driver/manual). */
  cashCollected?: boolean
}): string {
  if (args.cashAmount <= 0) {
    return args.cashCollected
      ? "Cash collected"
      : "Nothing to collect (paid online)"
  }
  if (args.paymentStatus === "deposit_paid") return "Collect balance in cash"
  return "Collect full amount in cash"
}
