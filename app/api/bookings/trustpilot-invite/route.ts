import { NextResponse } from "next/server"
import { z } from "zod"

import { claimTrustpilotInvite } from "@/lib/trustpilot-invite"
import {
  TRUSTPILOT_INVITE_COOKIE,
  clearTrustpilotInviteCookie,
} from "@/lib/trustpilot-invite-cookie"
import { takeRateLimit } from "@/lib/rate-limit"

const bodySchema = z.object({
  referenceCode: z.string().min(3).max(32),
})

function readInviteCookie(request: Request): string {
  const header = request.headers.get("cookie") || ""
  const parts = header.split(";")
  for (const part of parts) {
    const [rawName, ...rest] = part.trim().split("=")
    if (rawName === TRUSTPILOT_INVITE_COOKIE) {
      return decodeURIComponent(rest.join("=").trim())
    }
  }
  return ""
}

/**
 * One-shot Trustpilot invite claim. Requires the HttpOnly invite cookie set
 * only after verified payment / cash confirmation.
 */
export async function POST(request: Request) {
  const json = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 })
  }

  const referenceCode = parsed.data.referenceCode.trim().toUpperCase()
  const limited = takeRateLimit(
    `tp-invite:${referenceCode}`,
    10,
    60 * 1000,
  )
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    )
  }

  const token = readInviteCookie(request)
  if (!token) {
    return NextResponse.json({ error: "invalid" }, { status: 401 })
  }

  const result = await claimTrustpilotInvite({
    referenceCode,
    token,
  })

  if (!result.ok) {
    const status =
      result.code === "already_claimed"
        ? 409
        : result.code === "not_eligible"
          ? 403
          : 401
    const response = NextResponse.json({ error: result.code }, { status })
    if (result.code === "already_claimed" || result.code === "invalid") {
      clearTrustpilotInviteCookie(response)
    }
    return response
  }

  const response = NextResponse.json({
    recipientEmail: result.recipientEmail,
    recipientName: result.recipientName,
    referenceId: result.referenceId,
  })
  clearTrustpilotInviteCookie(response)
  return response
}
