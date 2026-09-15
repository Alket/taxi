import { NextResponse } from "next/server"
import { z } from "zod"

import { checkoutNonceMatches } from "@/lib/checkout-nonce"
import { clientIpFromRequest } from "@/lib/client-ip"
import { prisma } from "@/lib/db"
import { isPokConfigured } from "@/lib/pok"
import { confirmPokOrder } from "@/lib/pok-confirm"
import { takeRateLimit } from "@/lib/rate-limit"
import { jsonWithTrustpilotInviteCookieIfCheckoutBound } from "@/lib/trustpilot-invite-cookie"

/** Caps per-order confirm polling/retries that would otherwise spam the POK API. */
const POK_CONFIRM_LIMIT = 10
const POK_CONFIRM_WINDOW_MS = 60 * 1000
const POK_CONFIRM_IP_LIMIT = 40
const POK_CONFIRM_IP_WINDOW_MS = 15 * 60 * 1000

const bodySchema = z.object({
  orderId: z.string().min(1).max(128),
})

export async function POST(request: Request) {
  if (!(await isPokConfigured())) {
    return NextResponse.json({ error: "POK is not configured." }, { status: 503 })
  }

  const ip = clientIpFromRequest(request)
  const ipLimited = takeRateLimit(
    `pok-confirm-ip:${ip}`,
    POK_CONFIRM_IP_LIMIT,
    POK_CONFIRM_IP_WINDOW_MS,
  )
  if (!ipLimited.ok) {
    return NextResponse.json(
      {
        error: `Too many confirmation attempts. Try again in ${ipLimited.retryAfterSec}s.`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(ipLimited.retryAfterSec) },
      },
    )
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
      {
        error:
          "Too many confirmation attempts for this order. Try again shortly.",
      },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    )
  }

  const intent = await prisma.pokOrderIntent.findUnique({
    where: { orderId: parsed.data.orderId },
    select: { checkoutNonce: true, bookingId: true },
  })
  // Same 404 for missing order and bad nonce — no orderId existence oracle.
  if (!intent || !checkoutNonceMatches(request, intent.checkoutNonce)) {
    return NextResponse.json(
      { error: "Unknown or inaccessible POK order. Start checkout again." },
      { status: 404 },
    )
  }

  const result = await confirmPokOrder(parsed.data.orderId)

  // Attach email only after nonce gate — confirmPokOrder itself never puts it in body
  // (webhook shares that helper and must not leak PII).
  if (result.status >= 200 && result.status < 300 && result.inviteBookingId) {
    const booking = await prisma.booking.findUnique({
      where: { id: result.inviteBookingId },
      select: {
        referenceCode: true,
        customer: { select: { email: true } },
      },
    })
    const body = {
      ...result.body,
      referenceCode:
        (result.body.referenceCode as string | null | undefined) ??
        booking?.referenceCode ??
        null,
      customerEmail: booking?.customer.email ?? null,
    }
    return jsonWithTrustpilotInviteCookieIfCheckoutBound(
      request,
      intent.checkoutNonce,
      result.inviteBookingId,
      body,
      { status: result.status },
    )
  }

  return NextResponse.json(result.body, { status: result.status })
}
