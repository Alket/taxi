import { NextResponse } from "next/server"

import { confirmPokOrder } from "@/lib/pok-confirm"
import { takeRateLimit } from "@/lib/rate-limit"

/** Cap per-order webhook work so retries can't hammer the POK API. */
const POK_WEBHOOK_LIMIT = 10
const POK_WEBHOOK_WINDOW_MS = 60 * 1000

function extractOrderId(payload: unknown): string | null {
  const seen = new Set<unknown>()

  function walk(value: unknown, depth: number): string | null {
    if (depth > 4 || !value || typeof value !== "object") return null
    if (seen.has(value)) return null
    seen.add(value)

    const record = value as Record<string, unknown>
    for (const key of ["sdkOrderId", "orderId", "sdkOrderID", "id"]) {
      const candidate = record[key]
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim()
      }
    }
    for (const nested of Object.values(record)) {
      const found = walk(nested, depth + 1)
      if (found) return found
    }
    return null
  }

  return walk(payload, 0)
}

/**
 * POK capture notifications. The payload is never trusted: we only read an
 * order id from it, and confirmation re-reads the order from the POK API. That
 * keeps the endpoint safe without a shared webhook signature.
 */
export async function POST(request: Request) {
  const payload = await request.json().catch(() => null)
  const orderId = extractOrderId(payload)

  // Nothing actionable — ack so POK stops retrying.
  if (!orderId || orderId.length > 128) {
    return NextResponse.json({ received: true })
  }

  const limited = takeRateLimit(
    `pok-webhook:${orderId}`,
    POK_WEBHOOK_LIMIT,
    POK_WEBHOOK_WINDOW_MS,
  )
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many webhook deliveries for this order." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    )
  }

  const result = await confirmPokOrder(orderId)

  // Unknown orders and not-yet-captured orders are acked; only genuine server
  // failures return 5xx so POK retries them.
  if (result.status >= 500) {
    return NextResponse.json({ received: false }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
