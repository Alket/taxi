import { NextResponse } from "next/server"

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

export async function GET() {
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

  const [
    bookingsToday,
    bookingsThisWeek,
    unassignedCount,
    revenueBookings,
    upcomingUrgent,
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
        status: { notIn: ["cancelled", "completed"] },
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
      where: {
        driverId: null,
        pickupDateTime: { gte: now, lte: urgentEnd },
        status: { notIn: ["cancelled", "completed"] },
      },
      include: bookingListInclude,
      orderBy: { pickupDateTime: "asc" },
    }),
  ])

  const revenueThisMonth = revenueBookings.reduce(
    (sum, booking) =>
      sum + Number(booking.depositAmount) + Number(booking.balanceDue),
    0,
  )

  const summary: DashboardSummary = {
    bookingsToday,
    bookingsThisWeek,
    unassignedCount,
    revenueThisMonth: Number(revenueThisMonth.toFixed(2)),
    currency,
    upcomingUrgent: upcomingUrgent.map(serializeBookingListItem),
  }

  return NextResponse.json(summary)
}
