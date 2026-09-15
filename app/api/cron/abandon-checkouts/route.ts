import { NextResponse } from "next/server"

import { markStaleCheckoutsAbandoned } from "@/lib/abandon-checkouts"
import { authorizeCron } from "@/lib/cron-auth"
import { sendCheckoutAbandonedEmail } from "@/lib/emails/booking-events"

/**
 * Marks stale unpaid public checkouts as Abandoned and sends one recovery email.
 * Hit hourly: Authorization: Bearer $CRON_SECRET
 */
async function runAbandonCheckouts() {
  const abandoned = await markStaleCheckoutsAbandoned()
  let emailed = 0
  let skippedEmail = 0

  for (const booking of abandoned) {
    const result = await sendCheckoutAbandonedEmail(booking.id)
    if (result.sent) emailed += 1
    else skippedEmail += 1
  }

  return {
    ok: true,
    abandoned: abandoned.length,
    emailed,
    skippedEmail,
    references: abandoned.map((b) => b.referenceCode),
  }
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const result = await runAbandonCheckouts()
    return NextResponse.json(result)
  } catch (error) {
    console.error("[cron] abandon checkouts failed:", error)
    return NextResponse.json(
      { error: (error as Error).message || "Cron failed" },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  return GET(request)
}
