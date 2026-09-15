import { NextResponse } from "next/server"
import { z } from "zod"

import {
  checkoutNonceMatches,
} from "@/lib/checkout-nonce"
import { clientIpFromRequest } from "@/lib/client-ip"
import { prisma } from "@/lib/db"
import {
  amountsMatch,
  capturePaypalOrder,
  isPaypalConfigured,
  parsePaypalCustomId,
} from "@/lib/paypal"
import { takeRateLimit } from "@/lib/rate-limit"
import { recordBookingPayment } from "@/lib/record-deposit"
import { jsonWithTrustpilotInviteCookieIfCheckoutBound } from "@/lib/trustpilot-invite-cookie"
import type { PaymentOption } from "@/lib/types"

const PAYPAL_CAPTURE_LIMIT = 20
const PAYPAL_CAPTURE_WINDOW_MS = 15 * 60 * 1000

const bodySchema = z.object({
  orderId: z.string().min(1),
  /** Ignored — kept for older clients; binding comes from PaypalOrderIntent. */
  bookingId: z.string().min(1).optional(),
  /** Ignored — kept for older clients. */
  paymentOption: z.enum(["deposit", "full"]).optional(),
})

export async function POST(request: Request) {
  if (!(await isPaypalConfigured())) {
    return NextResponse.json(
      { error: "PayPal is not configured." },
      { status: 503 },
    )
  }

  const ip = clientIpFromRequest(request)
  const limited = takeRateLimit(
    `paypal-capture:${ip}`,
    PAYPAL_CAPTURE_LIMIT,
    PAYPAL_CAPTURE_WINDOW_MS,
  )
  if (!limited.ok) {
    return NextResponse.json(
      {
        error: `Too many capture attempts. Try again in ${limited.retryAfterSec}s.`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    )
  }

  const json = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "orderId is required." }, { status: 400 })
  }

  const { orderId } = parsed.data

  const intent = await prisma.paypalOrderIntent.findUnique({
    where: { orderId },
  })
  // Same 404 for missing order and bad nonce — no orderId existence oracle.
  if (!intent || !checkoutNonceMatches(request, intent.checkoutNonce)) {
    return NextResponse.json(
      { error: "Unknown or inaccessible PayPal order. Start checkout again." },
      { status: 404 },
    )
  }

  const booking = await prisma.booking.findUnique({
    where: { id: intent.bookingId },
    select: {
      id: true,
      referenceCode: true,
      paymentStatus: true,
      customer: { select: { email: true } },
    },
  })

  const successBody = (extra: Record<string, unknown>) => ({
    ok: true as const,
    referenceCode: booking?.referenceCode ?? null,
    customerEmail: booking?.customer?.email ?? null,
    ...extra,
  })

  // Short-circuit before hitting PayPal again on retries.
  if (intent.status === "captured") {
    return jsonWithTrustpilotInviteCookieIfCheckoutBound(
      request,
      intent.checkoutNonce,
      booking?.id ?? null,
      successBody({ alreadyPaid: true }),
    )
  }

  if (!booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 })
  }

  if (
    booking.paymentStatus === "deposit_paid" ||
    booking.paymentStatus === "fully_paid"
  ) {
    // Booking already paid (e.g. Stripe race) — mark intent captured if still open.
    await prisma.paypalOrderIntent.updateMany({
      where: { orderId, status: "created" },
      data: { status: "captured" },
    })
    return jsonWithTrustpilotInviteCookieIfCheckoutBound(
      request,
      intent.checkoutNonce,
      booking.id,
      successBody({ alreadyPaid: true }),
    )
  }

  try {
    const capture = await capturePaypalOrder(orderId)

    if (capture.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "PayPal payment was not completed.", status: capture.status },
        { status: 402 },
      )
    }

    if (!capture.captureId || capture.capturedAmount == null) {
      return NextResponse.json(
        { error: "PayPal capture did not return an amount." },
        { status: 502 },
      )
    }

    const custom = parsePaypalCustomId(capture.customId)
    const boundBookingId =
      capture.bookingId ?? capture.referenceId ?? custom?.bookingId ?? null
    if (!boundBookingId || boundBookingId !== intent.bookingId) {
      return NextResponse.json(
        { error: "PayPal order does not match this booking." },
        { status: 400 },
      )
    }

    const paymentOption = (
      intent.paymentOption === "full" ? "full" : "deposit"
    ) as PaymentOption

    if (custom?.paymentOption && custom.paymentOption !== paymentOption) {
      return NextResponse.json(
        { error: "PayPal order payment option mismatch." },
        { status: 400 },
      )
    }

    const expected = Number(intent.expectedAmount)
    if (!amountsMatch(capture.capturedAmount, expected)) {
      return NextResponse.json(
        {
          error: "Captured amount does not match the expected charge.",
          code: "AMOUNT_MISMATCH",
        },
        { status: 400 },
      )
    }

    if (
      capture.capturedCurrency &&
      capture.capturedCurrency !== intent.currency.toUpperCase()
    ) {
      return NextResponse.json(
        { error: "Captured currency does not match the booking." },
        { status: 400 },
      )
    }

    // Claim intent (created → captured) in the same transaction as booking/payment writes.
    const recorded = await recordBookingPayment({
      bookingId: intent.bookingId,
      paymentIntentId: capture.captureId,
      provider: "paypal",
      paymentOption,
      gatewayAmount: capture.capturedAmount,
      claimPaypalOrderId: orderId,
    })

    return jsonWithTrustpilotInviteCookieIfCheckoutBound(
      request,
      intent.checkoutNonce,
      booking.id,
      successBody({ alreadyPaid: recorded.alreadyRecorded }),
    )
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "PayPal capture failed." },
      { status: 500 },
    )
  }
}
