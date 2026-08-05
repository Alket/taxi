import { NextResponse } from "next/server"

import { requireDriverSession } from "@/lib/driver-auth"
import { prisma } from "@/lib/db"
import { formatMoney } from "@/lib/format"

function monthBounds(year: number, monthIndex0: number) {
  const start = new Date(year, monthIndex0, 1, 0, 0, 0, 0)
  const end = new Date(year, monthIndex0 + 1, 0, 23, 59, 59, 999)
  return { start, end }
}

/**
 * Monthly completed-trip revenue for the authenticated driver only.
 * year/month are clamped; data is always scoped to session.driver.id.
 */
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

  const { start: monthStart, end: monthEnd } = monthBounds(year, month - 1)

  const revenueRows = await prisma.booking.findMany({
    where: {
      driverId: session.driver.id,
      status: "completed",
      pickupDateTime: { gte: monthStart, lte: monthEnd },
    },
    select: {
      totalPrice: true,
      currency: true,
      balanceDue: true,
      paymentStatus: true,
    },
  })

  const currency = revenueRows[0]?.currency ?? "EUR"
  const revenueTotal = revenueRows.reduce(
    (sum, row) => sum + Number(row.totalPrice),
    0,
  )
  const revenueCash = revenueRows.reduce((sum, row) => {
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

  return NextResponse.json({
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
  })
}
