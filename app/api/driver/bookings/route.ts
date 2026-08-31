import { NextResponse } from "next/server"

import { getNextFlowStatus } from "@/lib/booking-status"
import { parseBookingNotes } from "@/lib/booking-notes"
import { CALENDAR_PAGE_SIZE } from "@/lib/bookings-calendar"
import { requireDriverSession } from "@/lib/driver-auth"
import {
  cashCollectLabel,
  cashToCollect,
  isDriverCashPayment,
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

function parseDateBound(value: string, endOfDay: boolean): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [y, m, d] = value.split("-").map(Number)
  return endOfDay
    ? new Date(y!, m! - 1, d!, 23, 59, 59, 999)
    : new Date(y!, m! - 1, d!, 0, 0, 0, 0)
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
  passengerName: string | null
  passengerPhone: string | null
  customer: { name: string; phone: string }
  payments: {
    provider: string
    externalId: string | null
    type: string
  }[]
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
  const cashCollected = b.payments.some((payment) =>
    isDriverCashPayment(payment),
  )
  const cashCollectedAmount = Number(
    b.payments
      .filter((payment) => isDriverCashPayment(payment))
      .reduce((sum, payment) => sum + Number(payment.amount), 0)
      .toFixed(2),
  )
  // Real online deposit/full payment — not the post-cash depositPaid overwrite.
  const hadOnlineDeposit = b.payments.some(
    (payment) => payment.provider !== "manual",
  )

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

  const passengerName = b.passengerName?.trim() || null
  const passengerPhone = b.passengerPhone?.trim() || null
  // Prefer traveler phone when booking is for someone else.
  const contactName = passengerName || b.customer.name
  const contactPhone = passengerPhone || b.customer.phone
  const contactPhoneDigits = contactPhone.replace(/\D/g, "")

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
    passengerName,
    passengerPhone,
    contactName,
    contactPhone,
    contactWhatsappUrl: contactPhoneDigits
      ? `https://wa.me/${contactPhoneDigits}`
      : null,
    currency: b.currency,
    totalPrice,
    totalPriceLabel: formatMoney(totalPrice, b.currency),
    depositPaid,
    balanceDue,
    paymentStatus: b.paymentStatus,
    cashToCollect: cashAmount,
    cashToCollectLabel: formatMoney(cashAmount, b.currency),
    cashCollected,
    cashCollectedAmount,
    cashCollectedAmountLabel: formatMoney(cashCollectedAmount, b.currency),
    hadOnlineDeposit,
    cashHint: cashCollectLabel({
      cashAmount,
      paymentStatus: b.paymentStatus,
      cashCollected,
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
  passengerName: true,
  passengerPhone: true,
  customer: { select: { name: true, phone: true } },
  payments: {
    select: { provider: true, externalId: true, type: true, amount: true },
  },
} as const

export async function GET(request: Request) {
  const session = await requireDriverSession()
  if ("error" in session) return session.error

  const { searchParams } = new URL(request.url)
  const dateFrom = searchParams.get("dateFrom")
  const dateTo = searchParams.get("dateTo")

  // Calendar range mode — only the session driver's trips in the window.
  if (dateFrom && dateTo) {
    const from = parseDateBound(dateFrom, false)
    const to = parseDateBound(dateTo, true)
    if (!from || !to) {
      return NextResponse.json(
        { error: "dateFrom and dateTo must be YYYY-MM-DD." },
        { status: 400 },
      )
    }
    if (from.getTime() > to.getTime()) {
      return NextResponse.json(
        { error: "dateFrom must be on or before dateTo." },
        { status: 400 },
      )
    }

    const rows = await prisma.booking.findMany({
      where: {
        driverId: session.driver.id,
        pickupDateTime: { gte: from, lte: to },
      },
      orderBy: { pickupDateTime: "asc" },
      select: tripSelect,
      take: CALENDAR_PAGE_SIZE,
    })

    return NextResponse.json({
      bookings: rows.map(serializeTrip),
      total: rows.length,
    })
  }

  const now = new Date()
  const todayStart = startOfLocalDay(now)
  const todayEnd = endOfLocalDay(now)

  const activeStatuses = [
    "driver_assigned",
    "driver_accepted",
    "arrived",
    "en_route",
    "in_progress",
  ] as const

  const [todayRows, upcomingRows, historyRows] = await Promise.all([
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
      orderBy: { pickupDateTime: "asc" },
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
  ])

  const currency =
    todayRows[0]?.currency ??
    upcomingRows[0]?.currency ??
    historyRows[0]?.currency ??
    "EUR"

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
  })
}
