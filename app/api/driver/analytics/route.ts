import { NextResponse } from "next/server"

import {
  buildDailySeries,
  buildDriverRouteRevenueBuckets,
  parseAnalyticsDateRange,
  roundMoney,
  type PaymentRow,
} from "@/lib/analytics"
import { startOfMonth } from "@/lib/dashboard"
import { prisma } from "@/lib/db"
import { requireDriverSession } from "@/lib/driver-auth"
import { formatMoney } from "@/lib/format"
import type { DriverAnalyticsReport } from "@/lib/types"

export async function GET(request: Request) {
  const session = await requireDriverSession()
  if ("error" in session) return session.error

  const { driver } = session
  const { searchParams } = new URL(request.url)
  const now = new Date()
  const range = parseAnalyticsDateRange(
    searchParams.get("dateFrom"),
    searchParams.get("dateTo"),
    startOfMonth(now),
    now,
  )

  const settings = await prisma.settings.findUnique({
    where: { id: "default" },
    select: { displayCurrencies: true },
  })
  const currency = settings?.displayCurrencies?.[0] ?? "EUR"

  const paymentRows = await prisma.payment.findMany({
    where: {
      paidAt: { gte: range.start, lte: range.end },
      status: { in: ["deposit_paid", "paid", "fully_paid"] },
      booking: { driverId: driver.id },
    },
    select: {
      amount: true,
      provider: true,
      paidAt: true,
      bookingId: true,
      booking: {
        select: {
          driverId: true,
          zoneId: true,
          vehicleType: true,
          driver: { select: { name: true } },
          zone: { select: { name: true } },
        },
      },
    },
    orderBy: { paidAt: "asc" },
  })

  const payments: PaymentRow[] = paymentRows.map((row) => ({
    amount: Number(row.amount),
    provider: row.provider,
    paidAt: row.paidAt,
    bookingId: row.bookingId,
    driverId: row.booking.driverId,
    driverName: row.booking.driver?.name ?? driver.name,
    zoneId: row.booking.zoneId,
    zoneName: row.booking.zone?.name ?? null,
    vehicleType: row.booking.vehicleType,
  }))

  const totalCollected = roundMoney(
    payments.reduce((sum, row) => sum + row.amount, 0),
  )
  const cashCollected = roundMoney(
    payments
      .filter((row) => row.provider === "manual")
      .reduce((sum, row) => sum + row.amount, 0),
  )
  const onlineCollected = roundMoney(totalCollected - cashCollected)

  const tripCount = new Set(payments.map((row) => row.bookingId)).size

  const byRoute = [...buildDriverRouteRevenueBuckets(payments).values()]
    .map((row) => {
      const total = row.cash + row.online
      return {
        zoneId: row.zoneId,
        routeLabel: row.routeLabel,
        cashCollected: roundMoney(row.cash),
        cashCollectedLabel: formatMoney(row.cash, currency),
        onlineCollected: roundMoney(row.online),
        onlineCollectedLabel: formatMoney(row.online, currency),
        totalCollected: roundMoney(total),
        totalCollectedLabel: formatMoney(total, currency),
        tripCount: row.bookingIds.size,
      }
    })
    .sort((a, b) => b.totalCollected - a.totalCollected)

  const report: DriverAnalyticsReport = {
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
    currency,
    driver: { id: driver.id, name: driver.name },
    summary: {
      totalCollected,
      totalCollectedLabel: formatMoney(totalCollected, currency),
      cashCollected,
      cashCollectedLabel: formatMoney(cashCollected, currency),
      onlineCollected,
      onlineCollectedLabel: formatMoney(onlineCollected, currency),
      paymentCount: payments.length,
      tripCount,
    },
    byRoute,
    dailySeries: buildDailySeries(payments, range.dateFrom, range.dateTo),
  }

  return NextResponse.json(report)
}
