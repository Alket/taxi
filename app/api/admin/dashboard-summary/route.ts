import { NextResponse } from "next/server"

import { requireStaffSession } from "@/lib/auth"
import {
  bookingListInclude,
  serializeBookingListItem,
} from "@/lib/bookings"
import {
  addDays,
  addMonths,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "@/lib/dashboard"
import { prisma } from "@/lib/db"
import type { DashboardSummary } from "@/lib/types"
import type { Prisma } from "@prisma/client"

export async function GET(request: Request) {
  const session = await requireStaffSession(request)
  if ("error" in session) return session.error

  const now = new Date()
  const todayStart = startOfDay(now)
  const todayEnd = addDays(todayStart, 1)
  const weekStart = startOfWeek(now)
  const weekEnd = addDays(weekStart, 7)
  const monthStart = startOfMonth(now)
  const monthEnd = addMonths(monthStart, 1)
  const urgentEnd = new Date(now.getTime() + 4 * 60 * 60 * 1000)

  const settings = await prisma.settings.findUnique({
    where: { id: "default" },
    select: { displayCurrencies: true },
  })
  const currency = settings?.displayCurrencies?.[0] ?? "EUR"

  const uncollectedProfitWhere = {
    status: "completed" as const,
    driverCost: { not: null },
    profitCollectedAt: null,
  }

  const profitThisMonthWhere: Prisma.BookingWhereInput = {
    pickupDateTime: { gte: monthStart, lt: monthEnd },
    status: { notIn: ["cancelled", "pending", "abandoned"] },
    driverCost: { not: null },
  }

  const [
    bookingsToday,
    bookingsThisWeek,
    unassignedCount,
    revenueBookings,
    profitThisMonthRows,
    upcomingUrgent,
    uncollectedProfitCount,
    uncollectedProfitRows,
    uncollectedProfitAmounts,
  ] = await Promise.all([
    prisma.booking.count({
      where: {
        pickupDateTime: { gte: todayStart, lt: todayEnd },
      },
    }),
    prisma.booking.count({
      where: {
        pickupDateTime: { gte: weekStart, lt: weekEnd },
      },
    }),
    prisma.booking.count({
      where: {
        driverId: null,
        // Pending / abandoned = unfinished checkout — not ready to assign.
        status: { notIn: ["cancelled", "completed", "pending", "abandoned"] },
      },
    }),
    prisma.booking.findMany({
      where: {
        createdAt: { gte: monthStart, lt: monthEnd },
        depositPaid: { gt: 0 },
      },
      select: {
        depositAmount: true,
        balanceDue: true,
      },
    }),
    prisma.booking.findMany({
      where: profitThisMonthWhere,
      select: { totalPrice: true, driverCost: true },
    }),
    prisma.booking.findMany({
      where: {
        driverId: null,
        pickupDateTime: { gte: now, lte: urgentEnd },
        status: { notIn: ["cancelled", "completed", "pending", "abandoned"] },
      },
      include: bookingListInclude,
      orderBy: { pickupDateTime: "asc" },
    }),
    prisma.booking.count({ where: uncollectedProfitWhere }),
    prisma.booking.findMany({
      where: uncollectedProfitWhere,
      include: bookingListInclude,
      orderBy: { pickupDateTime: "desc" },
      take: 20,
    }),
    prisma.booking.findMany({
      where: uncollectedProfitWhere,
      select: { totalPrice: true, driverCost: true },
    }),
  ])

  const revenueThisMonth = revenueBookings.reduce(
    (sum, booking) =>
      sum + Number(booking.depositAmount) + Number(booking.balanceDue),
    0,
  )

  const profitThisMonth = profitThisMonthRows.reduce((sum, booking) => {
    if (booking.driverCost == null) return sum
    return sum + (Number(booking.totalPrice) - Number(booking.driverCost))
  }, 0)

  const uncollectedProfitTotal = uncollectedProfitAmounts.reduce(
    (sum, booking) => {
      if (booking.driverCost == null) return sum
      return sum + (Number(booking.totalPrice) - Number(booking.driverCost))
    },
    0,
  )

  const summary: DashboardSummary = {
    bookingsToday,
    bookingsThisWeek,
    unassignedCount,
    revenueThisMonth: Number(revenueThisMonth.toFixed(2)),
    profitThisMonth: Number(profitThisMonth.toFixed(2)),
    profitThisMonthTripCount: profitThisMonthRows.length,
    currency,
    upcomingUrgent: upcomingUrgent.map(serializeBookingListItem),
    uncollectedProfitCount,
    uncollectedProfitTotal: Number(uncollectedProfitTotal.toFixed(2)),
    uncollectedProfit: uncollectedProfitRows.map(serializeBookingListItem),
  }

  return NextResponse.json(summary)
}
