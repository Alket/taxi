import { NextResponse } from "next/server"
import { z } from "zod"

import { confirmPokOrder } from "@/lib/pok-confirm"
import { isPokConfigured } from "@/lib/pok"
import { takeRateLimit } from "@/lib/rate-limit"

/** Caps per-order confirm polling/retries that would otherwise spam the POK API. */
const POK_CONFIRM_LIMIT = 10
const POK_CONFIRM_WINDOW_MS = 60 * 1000

const bodySchema = z.object({
  orderId: z.string().min(1).max(128),
})

export async function POST(request: Request) {
  if (!(await isPokConfigured())) {
    return NextResponse.json({ error: "POK is not configured." }, { status: 503 })
  }

  const json = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "orderId is required." }, { status: 400 })
  }

  const limited = takeRateLimit(
    `pok-confirm:${parsed.data.orderId}`,
    POK_CONFIRM_LIMIT,
    POK_CONFIRM_WINDOW_MS,
  )
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many confirmation attempts for this order. Try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    )
  }

  const result = await confirmPokOrder(parsed.data.orderId)
  return NextResponse.json(result.body, { status: result.status })
}
