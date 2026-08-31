import { NextResponse } from "next/server"

import {
  parseAnalyticsDateRange,
  roundMoney,
} from "@/lib/analytics"
import { startOfMonth, toDateInputValue } from "@/lib/dashboard"
import { prisma } from "@/lib/db"
import { requireDriverSession } from "@/lib/driver-auth"
import { splitCollected } from "@/lib/driver-cash"
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

  // Only completed trips in the range (by pickup) — same rule as dashboard
  // history / monthly “Completed trip totals”.
  const bookings = await prisma.booking.findMany({
    where: {
      driverId: driver.id,
      status: "completed",
      pickupDateTime: { gte: range.start, lte: range.end },
    },
    select: {
      id: true,
      totalPrice: true,
      balanceDue: true,
      depositPaid: true,
      paymentStatus: true,
      pickupDateTime: true,
      zoneId: true,
      zone: { select: { name: true } },
      payments: {
        select: {
          amount: true,
          externalId: true,
          status: true,
        },
      },
    },
    orderBy: { pickupDateTime: "asc" },
  })

  let totalCollected = 0
  let cashCollected = 0
  let paymentCount = 0

  type RouteBucket = {
    zoneId: string | null
    routeLabel: string
    cash: number
    online: number
    tripCount: number
  }
  const byRouteMap = new Map<string, RouteBucket>()
  const byDate = new Map<string, { total: number; cash: number; online: number }>()

  const [fromY, fromM, fromD] = range.dateFrom.split("-").map(Number)
  const [toY, toM, toD] = range.dateTo.split("-").map(Number)
  const cursor = new Date(fromY!, fromM! - 1, fromD!, 12, 0, 0, 0)
  const endDay = new Date(toY!, toM! - 1, toD!, 12, 0, 0, 0)
  while (cursor.getTime() <= endDay.getTime()) {
    byDate.set(toDateInputValue(cursor), { total: 0, cash: 0, online: 0 })
    cursor.setDate(cursor.getDate() + 1)
  }

  for (const booking of bookings) {
    const total = Number(booking.totalPrice)
    const { cash, online } = splitCollected({
      totalPrice: total,
      balanceDue: Number(booking.balanceDue),
      depositPaid: Number(booking.depositPaid),
      paymentStatus: booking.paymentStatus,
      payments: booking.payments,
    })

    totalCollected += total
    cashCollected += cash
    paymentCount += booking.payments.filter((payment) =>
      ["deposit_paid", "paid", "fully_paid"].includes(payment.status),
    ).length

    const zoneKey = booking.zoneId ?? "__unknown__"
    const route = byRouteMap.get(zoneKey) ?? {
      zoneId: booking.zoneId,
      routeLabel: booking.zone?.name ?? "Unknown route",
      cash: 0,
      online: 0,
      tripCount: 0,
    }
    route.cash += cash
    route.online += online
    route.tripCount += 1
    byRouteMap.set(zoneKey, route)

    const dayKey = toDateInputValue(booking.pickupDateTime)
    const day = byDate.get(dayKey)
    if (day) {
      day.total += total
      day.cash += cash
      day.online += online
    }
  }

  totalCollected = roundMoney(totalCollected)
  cashCollected = roundMoney(cashCollected)
  const onlineCollected = roundMoney(totalCollected - cashCollected)

  const byRoute = [...byRouteMap.values()]
    .map((row) => {
      const total = roundMoney(row.cash + row.online)
      return {
        zoneId: row.zoneId,
        routeLabel: row.routeLabel,
        cashCollected: roundMoney(row.cash),
        cashCollectedLabel: formatMoney(row.cash, currency),
        onlineCollected: roundMoney(row.online),
        onlineCollectedLabel: formatMoney(row.online, currency),
        totalCollected: total,
        totalCollectedLabel: formatMoney(total, currency),
        tripCount: row.tripCount,
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
      paymentCount,
      tripCount: bookings.length,
    },
    byRoute,
    dailySeries: [...byDate.entries()].map(([date, values]) => ({
      date,
      total: roundMoney(values.total),
      cash: roundMoney(values.cash),
      online: roundMoney(values.online),
    })),
  }

  return NextResponse.json(report)
}
