import { NextResponse } from "next/server"
import type { PaymentStatus } from "@prisma/client"

import {
  buildDailySeries,
  buildDriverRevenueBuckets,
  buildDriverRouteRevenueBuckets,
  parseAnalyticsDateRange,
  roundMoney,
  type PaymentRow,
} from "@/lib/analytics"
import { getSession } from "@/lib/auth"
import { cashToCollect } from "@/lib/driver-cash"
import { startOfMonth } from "@/lib/dashboard"
import { prisma } from "@/lib/db"
import { formatMoney } from "@/lib/format"
import { VEHICLE_LABELS } from "@/lib/format"
import type { AnalyticsReport, VehicleType } from "@/lib/types"

const PROVIDER_LABELS: Record<string, string> = {
  stripe: "Stripe",
  paypal: "PayPal",
  manual: "Cash",
}

export async function GET(request: Request) {
  const user = await getSession()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const now = new Date()
  const defaultFrom = startOfMonth(now)
  const defaultTo = now
  const range = parseAnalyticsDateRange(
    searchParams.get("dateFrom"),
    searchParams.get("dateTo"),
    defaultFrom,
    defaultTo,
  )

  const settings = await prisma.settings.findUnique({
    where: { id: "default" },
    select: { displayCurrencies: true },
  })
  const currency = settings?.displayCurrencies?.[0] ?? "EUR"

  const driverIdParam = searchParams.get("driverId")
  const bookingDriverFilter =
    driverIdParam && driverIdParam !== "all"
      ? driverIdParam === "unassigned"
        ? { driverId: null as string | null }
        : { driverId: driverIdParam }
      : undefined

  const [paymentRows, forfeitedRows, outstandingRows] = await Promise.all([
    prisma.payment.findMany({
      where: {
        paidAt: { gte: range.start, lte: range.end },
        status: { in: ["deposit_paid", "paid", "fully_paid"] },
        ...(bookingDriverFilter ? { booking: bookingDriverFilter } : {}),
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
    }),
    prisma.booking.findMany({
      where: {
        cancellationOutcome: "deposit_forfeited",
        cancelledAt: { gte: range.start, lte: range.end },
      },
      select: { depositPaid: true },
    }),
    prisma.booking.findMany({
      where: {
        status: { notIn: ["cancelled"] },
        paymentStatus: { in: ["unpaid", "deposit_paid", "failed"] },
      },
      select: {
        totalPrice: true,
        balanceDue: true,
        depositPaid: true,
        paymentStatus: true,
      },
    }),
  ])

  const payments: PaymentRow[] = paymentRows.map((row) => ({
    amount: Number(row.amount),
    provider: row.provider,
    paidAt: row.paidAt,
    bookingId: row.bookingId,
    driverId: row.booking.driverId,
    driverName: row.booking.driver?.name ?? null,
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

  const providerMap = new Map<string, { amount: number; count: number }>()
  for (const payment of payments) {
    const bucket = providerMap.get(payment.provider) ?? { amount: 0, count: 0 }
    bucket.amount += payment.amount
    bucket.count += 1
    providerMap.set(payment.provider, bucket)
  }

  const driverMap = buildDriverRevenueBuckets(payments)
  const driverRouteMap = buildDriverRouteRevenueBuckets(payments)

  const revenueByDriver = [...driverMap.values()]
    .map((row) => {
      const total = row.cash + row.online
      return {
        driverId: row.driverId,
        driverName: row.driverName,
        cashCollected: roundMoney(row.cash),
        cashCollectedLabel: formatMoney(row.cash, currency),
        onlineCollected: roundMoney(row.online),
        onlineCollectedLabel: formatMoney(row.online, currency),
        totalCollected: roundMoney(total),
        totalCollectedLabel: formatMoney(total, currency),
        tripCount: row.bookingIds.size,
        shareOfCash:
          cashCollected > 0 ? roundMoney((row.cash / cashCollected) * 100) : 0,
      }
    })
    .sort((a, b) => b.totalCollected - a.totalCollected)

  const revenueByDriverRoute = [...driverRouteMap.values()]
    .map((row) => {
      const total = row.cash + row.online
      return {
        driverId: row.driverId,
        driverName: row.driverName,
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
    .sort((a, b) => {
      const byDriver = a.driverName.localeCompare(b.driverName)
      if (byDriver !== 0) return byDriver
      return b.totalCollected - a.totalCollected
    })

  const zoneMap = new Map<string, { label: string; amount: number; count: number }>()
  for (const payment of payments) {
    const key = payment.zoneId ?? "__unknown__"
    const label = payment.zoneName ?? "Unknown zone"
    const bucket = zoneMap.get(key) ?? { label, amount: 0, count: 0 }
    bucket.amount += payment.amount
    bucket.count += 1
    zoneMap.set(key, bucket)
  }

  const vehicleMap = new Map<string, { label: string; amount: number; count: number }>()
  for (const payment of payments) {
    const key = payment.vehicleType ?? "__unknown__"
    const label =
      payment.vehicleType && payment.vehicleType in VEHICLE_LABELS
        ? VEHICLE_LABELS[payment.vehicleType as VehicleType]
        : "Unknown"
    const bucket = vehicleMap.get(key) ?? { label, amount: 0, count: 0 }
    bucket.amount += payment.amount
    bucket.count += 1
    vehicleMap.set(key, bucket)
  }

  let unpaidBalances = 0
  let unpaidTripCount = 0
  for (const booking of outstandingRows) {
    const due = cashToCollect({
      totalPrice: Number(booking.totalPrice),
      balanceDue: Number(booking.balanceDue),
      depositPaid: Number(booking.depositPaid),
      paymentStatus: booking.paymentStatus as PaymentStatus,
    })
    if (due <= 0) continue
    unpaidBalances += due
    unpaidTripCount += 1
  }

  const forfeitedDeposits = roundMoney(
    forfeitedRows.reduce((sum, row) => sum + Number(row.depositPaid), 0),
  )

  const completedTripCount = await prisma.booking.count({
    where: {
      status: "completed",
      pickupDateTime: { gte: range.start, lte: range.end },
      ...(bookingDriverFilter ?? {}),
    },
  })

  const driverFilter =
    driverIdParam && driverIdParam !== "all"
      ? {
          driverId: driverIdParam === "unassigned" ? null : driverIdParam,
          driverName:
            driverIdParam === "unassigned"
              ? "Unassigned"
              : (payments.find((p) => p.driverId === driverIdParam)?.driverName ??
                (
                  await prisma.driver.findUnique({
                    where: { id: driverIdParam },
                    select: { name: true },
                  })
                )?.name ??
                "Driver"),
        }
      : null

  const report: AnalyticsReport = {
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
    currency,
    driverFilter,
    summary: {
      totalCollected,
      totalCollectedLabel: formatMoney(totalCollected, currency),
      cashCollected,
      cashCollectedLabel: formatMoney(cashCollected, currency),
      onlineCollected,
      onlineCollectedLabel: formatMoney(onlineCollected, currency),
      paymentCount: payments.length,
      completedTripCount,
      forfeitedDeposits,
      forfeitedDepositsLabel: formatMoney(forfeitedDeposits, currency),
    },
    outstanding: {
      unpaidBalances: roundMoney(unpaidBalances),
      unpaidBalancesLabel: formatMoney(unpaidBalances, currency),
      unpaidTripCount,
    },
    byProvider: [...providerMap.entries()]
      .map(([provider, row]) => ({
        provider,
        providerLabel: PROVIDER_LABELS[provider] ?? provider,
        amount: roundMoney(row.amount),
        amountLabel: formatMoney(row.amount, currency),
        count: row.count,
      }))
      .sort((a, b) => b.amount - a.amount),
    revenueByDriver,
    revenueByDriverRoute,
    cashByDriver: revenueByDriver,
    dailySeries: buildDailySeries(payments, range.dateFrom, range.dateTo),
    byZone: [...zoneMap.values()]
      .map((row) => ({
        key: row.label,
        label: row.label,
        amount: roundMoney(row.amount),
        amountLabel: formatMoney(row.amount, currency),
        count: row.count,
      }))
      .sort((a, b) => b.amount - a.amount),
    byVehicle: [...vehicleMap.values()]
      .map((row) => ({
        key: row.label,
        label: row.label,
        amount: roundMoney(row.amount),
        amountLabel: formatMoney(row.amount, currency),
        count: row.count,
      }))
      .sort((a, b) => b.amount - a.amount),
  }

  return NextResponse.json(report)
}
