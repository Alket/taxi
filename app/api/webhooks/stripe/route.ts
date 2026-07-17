import { NextResponse } from "next/server"
import Stripe from "stripe"

import { recordBookingPayment } from "@/lib/record-deposit"
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

async function recordBalancePayment({
  bookingId,
  paymentIntentId,
  paidAt,
  chargedBy,
}: {
  bookingId: string
  paymentIntentId: string
  paidAt: Date
  chargedBy: string
}) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } })
  if (!booking || booking.isBalanceCharged) return

  const existingPayment = await prisma.payment.findFirst({
    where: { externalId: paymentIntentId },
    select: { id: true },
  })
  if (existingPayment) return

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: bookingId },
      data: {
        isBalanceCharged: true,
        balanceChargedAt: paidAt,
        balanceChargedBy: chargedBy,
        paymentStatus: "fully_paid",
        balanceDue: 0,
      },
    })

    await tx.payment.create({
      data: {
        bookingId,
        type: "balance",
        amount: booking.balanceDue,
        currency: booking.currency,
        status: "paid",
        provider: "stripe",
        externalId: paymentIntentId,
        paidAt,
      },
    })
  })
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature")
  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature." },
      { status: 400 },
    )
  }

  const body = await request.text()

  let event: Stripe.Event
  try {
    const stripe = await getStripe()
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      await getStripeWebhookSecret(),
    )
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Invalid webhook signature." },
      { status: 400 },
    )
  }

  const paidAt = new Date(
    (event.created ?? Math.floor(Date.now() / 1000)) * 1000,
  )

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session

    if (session.mode === "payment" && session.payment_status === "paid") {
      const bookingId =
        session.metadata?.bookingId ?? session.client_reference_id ?? null
      const paymentType = session.metadata?.paymentType ?? "deposit"

      if (bookingId && session.payment_intent) {
        const paymentIntentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent.id

        if (paymentType === "balance") {
          await recordBalancePayment({
            bookingId,
            paymentIntentId,
            paidAt,
            chargedBy: "customer",
          })
        } else {
          await recordBookingPayment({
            bookingId,
            paymentIntentId,
            provider: "stripe",
            paymentOption: paymentType === "full" ? "full" : "deposit",
            paidAt,
          })
        }
      }
    }
  }

  // Embedded Elements deposit flow (PaymentStep).
  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object as Stripe.PaymentIntent
    const bookingId = intent.metadata?.bookingId
    const paymentType = intent.metadata?.paymentType ?? "deposit"

    if (bookingId) {
      if (paymentType === "balance") {
        await recordBalancePayment({
          bookingId,
          paymentIntentId: intent.id,
          paidAt,
          chargedBy: "customer",
        })
      } else {
        await recordBookingPayment({
          bookingId,
          paymentIntentId: intent.id,
          provider: "stripe",
          paymentOption: paymentType === "full" ? "full" : "deposit",
          paidAt,
        })
      }

      // Persist card for later off-session balance charges.
      if (intent.customer && intent.payment_method) {
        try {
          const customerId =
            typeof intent.customer === "string"
              ? intent.customer
              : intent.customer.id
          const paymentMethodId =
            typeof intent.payment_method === "string"
              ? intent.payment_method
              : intent.payment_method.id

          await (await getStripe()).customers.update(customerId, {
            invoice_settings: { default_payment_method: paymentMethodId },
          })
        } catch {
          // Non-fatal — admin can still send a new payment link.
        }
      }
    }
  }

  return NextResponse.json({ received: true })
}
