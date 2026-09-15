import { NextResponse } from "next/server"
import Stripe from "stripe"

import { recordBalancePayment } from "@/lib/record-balance"
import { recordBookingPayment } from "@/lib/record-deposit"
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe"

export const runtime = "nodejs"

function stripeAmountMajor(intent: {
  amount_received?: number | null
  amount?: number | null
}): number | undefined {
  if (typeof intent.amount_received === "number") {
    return intent.amount_received / 100
  }
  if (typeof intent.amount === "number") {
    return intent.amount / 100
  }
  return undefined
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

        const intent =
          typeof session.payment_intent === "string"
            ? await (await getStripe()).paymentIntents.retrieve(paymentIntentId)
            : session.payment_intent

        const gatewayAmount = stripeAmountMajor(intent)

        if (paymentType === "balance") {
          await recordBalancePayment({
            bookingId,
            paymentIntentId,
            paidAt,
            chargedBy: "customer",
            gatewayAmount,
          })
        } else {
          await recordBookingPayment({
            bookingId,
            paymentIntentId,
            provider: "stripe",
            paymentOption: paymentType === "full" ? "full" : "deposit",
            gatewayAmount,
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
      const gatewayAmount = stripeAmountMajor(intent)

      if (paymentType === "balance") {
        await recordBalancePayment({
          bookingId,
          paymentIntentId: intent.id,
          paidAt,
          chargedBy: "customer",
          gatewayAmount,
        })
      } else {
        await recordBookingPayment({
          bookingId,
          paymentIntentId: intent.id,
          provider: "stripe",
          paymentOption: paymentType === "full" ? "full" : "deposit",
          gatewayAmount,
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
