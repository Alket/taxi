import { NextResponse } from "next/server"

import { prisma } from "@/lib/db"
import { sendCustomerPickupReminder } from "@/lib/emails/booking-events"

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false

  const header = request.headers.get("authorization")
  if (header === `Bearer ${secret}`) return true

  const url = new URL(request.url)
  if (url.searchParams.get("secret") === secret) return true

  return false
}

/**
 * Sends customer pickup reminders for trips ~24h away.
 * Hit hourly: Authorization: Bearer $CRON_SECRET
 */
async function runReminders() {
  const now = Date.now()
  const windowStart = new Date(now + 23 * 60 * 60 * 1000)
  const windowEnd = new Date(now + 25 * 60 * 60 * 1000)

  const candidates = await prisma.booking.findMany({
    where: {
      pickupDateTime: { gte: windowStart, lt: windowEnd },
      status: {
        notIn: ["cancelled", "completed"],
      },
    },
    select: { id: true, referenceCode: true },
    take: 200,
  })

  let sent = 0
  let skipped = 0

  for (const booking of candidates) {
    const already = await prisma.notificationLog.findFirst({
      where: {
        bookingId: booking.id,
        type: "reminder",
        status: { in: ["sent", "pending"] },
      },
      select: { id: true },
    })
    if (already) {
      skipped += 1
      continue
    }

    const result = await sendCustomerPickupReminder(booking.id)
    if (result.sent) sent += 1
    else skipped += 1
  }

  return {
    ok: true,
    candidates: candidates.length,
    sent,
    skipped,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
  }
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const result = await runReminders()
    return NextResponse.json(result)
  } catch (error) {
    console.error("[cron] pickup reminders failed:", error)
    return NextResponse.json(
      { error: (error as Error).message || "Cron failed" },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  return GET(request)
}
