import type { PaymentStatus } from "@/lib/types"
import { toDateInputValue } from "@/lib/dashboard"

/** Payment statuses that count as money received. */
export const ANALYTICS_PAID_STATUSES: PaymentStatus[] = [
  "deposit_paid",
  "paid",
  "fully_paid",
]

export type AnalyticsDateRange = {
  dateFrom: string
  dateTo: string
  start: Date
  end: Date
}

export function parseAnalyticsDateRange(
  dateFromParam: string | null,
  dateToParam: string | null,
  fallbackFrom: Date,
  fallbackTo: Date,
): AnalyticsDateRange {
  const dateFrom = dateFromParam || toDateInputValue(fallbackFrom)
  const dateTo = dateToParam || toDateInputValue(fallbackTo)

  const [fromY, fromM, fromD] = dateFrom.split("-").map(Number)
  const [toY, toM, toD] = dateTo.split("-").map(Number)

  const start = new Date(fromY!, fromM! - 1, fromD!, 0, 0, 0, 0)
  const end = new Date(toY!, toM! - 1, toD!, 23, 59, 59, 999)

  if (start.getTime() > end.getTime()) {
    return {
      dateFrom: dateTo,
      dateTo: dateFrom,
      start: new Date(toY!, toM! - 1, toD!, 0, 0, 0, 0),
      end: new Date(fromY!, fromM! - 1, fromD!, 23, 59, 59, 999),
    }
  }

  return { dateFrom, dateTo, start, end }
}

export function isAnalyticsPaidStatus(status: PaymentStatus): boolean {
  return ANALYTICS_PAID_STATUSES.includes(status)
}

export function roundMoney(value: number): number {
  return Number(value.toFixed(2))
}

export function sumAmounts(values: number[]): number {
  return roundMoney(values.reduce((sum, value) => sum + value, 0))
}

export type PaymentRow = {
  amount: number
  provider: string
  paidAt: Date | null
  bookingId: string
  driverId: string | null
  driverName: string | null
  zoneId: string | null
  zoneName: string | null
  vehicleType: string | null
}

export function isCashPaymentProvider(provider: string): boolean {
  return provider === "manual"
}

type DriverRevenueBucket = {
  driverId: string | null
  driverName: string
  cash: number
  online: number
  bookingIds: Set<string>
}

type DriverRouteBucket = DriverRevenueBucket & {
  zoneId: string | null
  routeLabel: string
}

function getDriverKey(payment: PaymentRow): string {
  return payment.driverId ?? "__unassigned__"
}

function upsertDriverBucket(
  map: Map<string, DriverRevenueBucket>,
  payment: PaymentRow,
): DriverRevenueBucket {
  const key = getDriverKey(payment)
  const bucket = map.get(key) ?? {
    driverId: payment.driverId,
    driverName: payment.driverName ?? "Unassigned",
    cash: 0,
    online: 0,
    bookingIds: new Set<string>(),
  }
  if (isCashPaymentProvider(payment.provider)) {
    bucket.cash += payment.amount
  } else {
    bucket.online += payment.amount
  }
  bucket.bookingIds.add(payment.bookingId)
  map.set(key, bucket)
  return bucket
}

export function buildDriverRevenueBuckets(payments: PaymentRow[]) {
  const map = new Map<string, DriverRevenueBucket>()
  for (const payment of payments) {
    upsertDriverBucket(map, payment)
  }
  return map
}

export function buildDriverRouteRevenueBuckets(payments: PaymentRow[]) {
  const map = new Map<string, DriverRouteBucket>()

  for (const payment of payments) {
    const driverKey = getDriverKey(payment)
    const zoneKey = payment.zoneId ?? "__unknown__"
    const key = `${driverKey}::${zoneKey}`
    const routeLabel = payment.zoneName ?? "Unknown route"
    const bucket = map.get(key) ?? {
      driverId: payment.driverId,
      driverName: payment.driverName ?? "Unassigned",
      zoneId: payment.zoneId,
      routeLabel,
      cash: 0,
      online: 0,
      bookingIds: new Set<string>(),
    }
    if (isCashPaymentProvider(payment.provider)) {
      bucket.cash += payment.amount
    } else {
      bucket.online += payment.amount
    }
    bucket.bookingIds.add(payment.bookingId)
    map.set(key, bucket)
  }

  return map
}

export function buildDailySeries(
  payments: PaymentRow[],
  dateFrom: string,
  dateTo: string,
) {
  const byDate = new Map<string, { total: number; cash: number; online: number }>()

  const [fromY, fromM, fromD] = dateFrom.split("-").map(Number)
  const [toY, toM, toD] = dateTo.split("-").map(Number)
  const cursor = new Date(fromY!, fromM! - 1, fromD!, 12, 0, 0, 0)
  const end = new Date(toY!, toM! - 1, toD!, 12, 0, 0, 0)

  while (cursor.getTime() <= end.getTime()) {
    byDate.set(toDateInputValue(cursor), { total: 0, cash: 0, online: 0 })
    cursor.setDate(cursor.getDate() + 1)
  }

  for (const payment of payments) {
    if (!payment.paidAt) continue
    const key = toDateInputValue(payment.paidAt)
    const bucket = byDate.get(key)
    if (!bucket) continue
    bucket.total += payment.amount
    if (payment.provider === "manual") {
      bucket.cash += payment.amount
    } else {
      bucket.online += payment.amount
    }
  }

  return [...byDate.entries()].map(([date, values]) => ({
    date,
    total: roundMoney(values.total),
    cash: roundMoney(values.cash),
    online: roundMoney(values.online),
  }))
}
