import { NextResponse } from "next/server"

import { getNextFlowStatus } from "@/lib/booking-status"
import { parseBookingNotes } from "@/lib/booking-notes"
import { requireDriverSession } from "@/lib/driver-auth"
import {
  cashCollectLabel,
  cashToCollect,
} from "@/lib/driver-cash"
import { prisma } from "@/lib/db"
import {
  BOOKING_STATUS_LABELS,
  formatDateTime,
  formatMoney,
} from "@/lib/format"
import type { BookingStatus, PaymentStatus } from "@/lib/types"

function startOfLocalDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
}

function endOfLocalDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}

function monthBounds(year: number, monthIndex0: number) {
  const start = new Date(year, monthIndex0, 1, 0, 0, 0, 0)
  const end = new Date(year, monthIndex0 + 1, 0, 23, 59, 59, 999)
  return { start, end }
}

function serializeTrip(b: {
  id: string
  referenceCode: string
  pickupPin: string
  pickupAddress: string
  dropoffAddress: string
  pickupDateTime: Date
  passengerCount: number
  luggageCount: number
  flightNumber: string
  notes: string | null
  status: BookingStatus
  currency: string
  totalPrice: { toString(): string } | number
  depositPaid: { toString(): string } | number
  balanceDue: { toString(): string } | number
  paymentStatus: PaymentStatus
  customer: { name: string; phone: string }
}) {
  const status = b.status
  const totalPrice = Number(b.totalPrice)
  const depositPaid = Number(b.depositPaid)
  const balanceDue = Number(b.balanceDue)
  const cashAmount = cashToCollect({
    totalPrice,
    balanceDue,
    depositPaid,
    paymentStatus: b.paymentStatus,
  })
  const cashStillDue = cashAmount > 0

  // After Arrived: collect cash (deposit/unpaid) before offering Mark Completed.
  const canMarkCashPaid =
    cashStillDue &&
    (status === "arrived" ||
      // Legacy: trips completed before cash was recorded can still confirm cash.
      status === "completed") &&
    (b.paymentStatus === "deposit_paid" || b.paymentStatus === "unpaid")

  const needsResponse = status === "driver_assigned"

  const flowNext = getNextFlowStatus(status)
  let nextStatus: "arrived" | "completed" | null =
    !needsResponse &&
    (flowNext === "arrived" || flowNext === "completed")
      ? flowNext
      : null

  if (nextStatus === "completed" && cashStillDue) {
    nextStatus = null
  }

  const noteItems = parseBookingNotes(b.notes, {
    paymentStatus: b.paymentStatus,
  })
  const childSeats =
    noteItems.find((item) => item.id === "child-seats")?.detail?.trim() || null
  const driverNotes =
    noteItems.find((item) => item.id === "driver-notes")?.detail?.trim() || null
  const meetAndGreet = noteItems.some((item) => item.id === "meet-and-greet")

  return {
    id: b.id,
    referenceCode: b.referenceCode,
    pickupPin: b.pickupPin,
    pickupAddress: b.pickupAddress,
    dropoffAddress: b.dropoffAddress,
    pickupDateTime: b.pickupDateTime.toISOString(),
    pickupLabel: formatDateTime(b.pickupDateTime.toISOString()),
    passengerCount: b.passengerCount,
    luggageCount: b.luggageCount,
    flightNumber: b.flightNumber || null,
    childSeats,
    driverNotes,
    meetAndGreet,
    status,
    statusLabel: BOOKING_STATUS_LABELS[status],
    customerName: b.customer.name,
    customerPhone: b.customer.phone,
    currency: b.currency,
    totalPrice,
    totalPriceLabel: formatMoney(totalPrice, b.currency),
    depositPaid,
    balanceDue,
    paymentStatus: b.paymentStatus,
    cashToCollect: cashAmount,
    cashToCollectLabel: formatMoney(cashAmount, b.currency),
    cashHint: cashCollectLabel({
      cashAmount,
      paymentStatus: b.paymentStatus,
    }),
    canMarkCashPaid,
    needsResponse,
    nextStatus,
    nextStatusLabel: nextStatus ? BOOKING_STATUS_LABELS[nextStatus] : null,
  }
}

const tripSelect = {
  id: true,
  referenceCode: true,
  pickupPin: true,
  pickupAddress: true,
  dropoffAddress: true,
  pickupDateTime: true,
  passengerCount: true,
  luggageCount: true,
  flightNumber: true,
  notes: true,
  status: true,
  currency: true,
  totalPrice: true,
  depositPaid: true,
  balanceDue: true,
  paymentStatus: true,
  customer: { select: { name: true, phone: true } },
} as const

export async function GET(request: Request) {
  const session = await requireDriverSession()
  if ("error" in session) return session.error

  const { searchParams } = new URL(request.url)
  const now = new Date()
  const yearParam = Number.parseInt(searchParams.get("year") ?? "", 10)
  const monthParam = Number.parseInt(searchParams.get("month") ?? "", 10) // 1–12
  const year = Number.isFinite(yearParam) ? yearParam : now.getFullYear()
  const month = Number.isFinite(monthParam)
    ? Math.min(12, Math.max(1, monthParam))
    : now.getMonth() + 1

  const todayStart = startOfLocalDay(now)
  const todayEnd = endOfLocalDay(now)
  const { start: monthStart, end: monthEnd } = monthBounds(year, month - 1)

  const activeStatuses = [
    "driver_assigned",
    "driver_accepted",
    "arrived",
    "en_route",
    "in_progress",
  ] as const

  const [todayRows, upcomingRows, historyRows, revenueRows] =
    await Promise.all([
      // Today: active trips + completed ones still awaiting cash (deposit-only / unpaid)
      prisma.booking.findMany({
        where: {
          driverId: session.driver.id,
          pickupDateTime: { gte: todayStart, lte: todayEnd },
          OR: [
            { status: { in: [...activeStatuses] } },
            {
              status: "completed",
              paymentStatus: { in: ["deposit_paid", "unpaid"] },
            },
          ],
        },
        orderBy: { pickupDateTime: "desc" },
        select: tripSelect,
      }),
      prisma.booking.findMany({
        where: {
          driverId: session.driver.id,
          status: { in: [...activeStatuses] },
          pickupDateTime: { gt: todayEnd },
        },
        orderBy: { pickupDateTime: "asc" },
        select: tripSelect,
        take: 50,
      }),
      // Past trips only — completed/cancelled, excluding today's cash-pending completed
      prisma.booking.findMany({
        where: {
          driverId: session.driver.id,
          status: { in: ["completed", "cancelled"] },
          NOT: {
            AND: [
              { pickupDateTime: { gte: todayStart, lte: todayEnd } },
              { status: "completed" },
              { paymentStatus: { in: ["deposit_paid", "unpaid"] } },
            ],
          },
        },
        orderBy: { pickupDateTime: "desc" },
        select: tripSelect,
        take: 50,
      }),
      prisma.booking.findMany({
        where: {
          driverId: session.driver.id,
          status: "completed",
          pickupDateTime: { gte: monthStart, lte: monthEnd },
        },
        select: {
          totalPrice: true,
          currency: true,
          balanceDue: true,
          depositPaid: true,
          paymentStatus: true,
        },
      }),
    ])

  const currency =
    revenueRows[0]?.currency ??
    todayRows[0]?.currency ??
    upcomingRows[0]?.currency ??
    historyRows[0]?.currency ??
    "EUR"

  const revenueTotal = revenueRows.reduce(
    (sum, row) => sum + Number(row.totalPrice),
    0,
  )
  const revenueCash = revenueRows.reduce((sum, row) => {
    // Cash actually collected on completed trips (balance / full if unpaid)
    if (
      row.paymentStatus === "fully_paid" ||
      row.paymentStatus === "paid"
    ) {
      return sum
    }
    if (row.paymentStatus === "deposit_paid") {
      return sum + Number(row.balanceDue)
    }
    return sum + Number(row.totalPrice)
  }, 0)

  const activeRows = [...todayRows, ...upcomingRows]
  let cashToCollectNow = 0
  let unpaidBalances = 0
  let unpaidTripCount = 0

  for (const row of activeRows) {
    const cashAmount = cashToCollect({
      totalPrice: Number(row.totalPrice),
      balanceDue: Number(row.balanceDue),
      depositPaid: Number(row.depositPaid),
      paymentStatus: row.paymentStatus,
    })
    if (cashAmount <= 0) continue

    unpaidBalances += cashAmount
    unpaidTripCount += 1

    if (row.status === "arrived" || row.status === "completed") {
      cashToCollectNow += cashAmount
    }
  }

  return NextResponse.json({
    today: todayRows.map(serializeTrip),
    upcoming: upcomingRows.map(serializeTrip),
    history: historyRows.map(serializeTrip),
    // Back-compat for any old clients
    bookings: [...todayRows, ...upcomingRows].map(serializeTrip),
    outstanding: {
      cashToCollect: Number(cashToCollectNow.toFixed(2)),
      cashToCollectLabel: formatMoney(cashToCollectNow, currency),
      unpaidBalances: Number(unpaidBalances.toFixed(2)),
      unpaidBalancesLabel: formatMoney(unpaidBalances, currency),
      unpaidTripCount,
    },
    revenue: {
      year,
      month,
      monthLabel: new Intl.DateTimeFormat("en-GB", {
        month: "long",
        year: "numeric",
      }).format(monthStart),
      completedTrips: revenueRows.length,
      total: Number(revenueTotal.toFixed(2)),
      totalLabel: formatMoney(revenueTotal, currency),
      cashCollected: Number(revenueCash.toFixed(2)),
      cashCollectedLabel: formatMoney(revenueCash, currency),
      currency,
    },
  })
}
