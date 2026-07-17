import type { Customer } from "@prisma/client"
import Stripe from "stripe"

import { prisma } from "@/lib/db"
import { getStripe } from "@/lib/stripe"

type BookingForCheckout = {
  id: string
  referenceCode: string
  pickupAddress: string
  dropoffAddress: string
  currency: string
  depositAmount: { toString(): string } | number
  balanceDue: { toString(): string } | number
  depositPaid: { toString(): string } | number
  isBalanceCharged: boolean
  customer: Customer
}

export async function ensureStripeCustomer(customer: Customer): Promise<string> {
  if (customer.stripeCustomerId) {
    return customer.stripeCustomerId
  }

  const stripe = await getStripe()
  const stripeCustomer = await stripe.customers.create({
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    metadata: {
      customerId: customer.id,
    },
  })

  await prisma.customer.update({
    where: { id: customer.id },
    data: { stripeCustomerId: stripeCustomer.id },
  })

  return stripeCustomer.id
}

export async function getSavedPaymentMethodId(
  stripeCustomerId: string,
): Promise<string> {
  const stripe = await getStripe()
  const customer = await stripe.customers.retrieve(stripeCustomerId)

  if (customer.deleted) {
    throw new Error("Stripe customer no longer exists.")
  }

  const defaultPaymentMethod = customer.invoice_settings?.default_payment_method
  if (defaultPaymentMethod) {
    return typeof defaultPaymentMethod === "string"
      ? defaultPaymentMethod
      : defaultPaymentMethod.id
  }

  const paymentMethods = await stripe.paymentMethods.list({
    customer: stripeCustomerId,
    type: "card",
    limit: 1,
  })

  const paymentMethodId = paymentMethods.data[0]?.id
  if (!paymentMethodId) {
    throw new Error(
      "No saved payment method on file. Send a payment link instead.",
    )
  }

  return paymentMethodId
}

export function mapStripeChargeError(error: unknown): {
  message: string
  code: "authentication_required" | "card_declined" | "unknown"
} {
  if (error instanceof Stripe.errors.StripeCardError) {
    if (
      error.code === "authentication_required" ||
      error.decline_code === "authentication_required"
    ) {
      return {
        message:
          "Card requires authentication — send a new payment link instead.",
        code: "authentication_required",
      }
    }

    return {
      message: "Card declined.",
      code: "card_declined",
    }
  }

  if (error instanceof Stripe.errors.StripeInvalidRequestError) {
    if (error.code === "payment_intent_authentication_failure") {
      return {
        message:
          "Card requires authentication — send a new payment link instead.",
        code: "authentication_required",
      }
    }
  }

  return {
    message:
      error instanceof Error ? error.message : "Failed to charge balance.",
    code: "unknown",
  }
}

export async function createBookingCheckoutSession({
  booking,
  paymentType,
  origin,
}: {
  booking: BookingForCheckout
  paymentType: "deposit" | "balance"
  origin: string
}): Promise<string> {
  const stripeCustomerId = await ensureStripeCustomer(booking.customer)
  const stripe = await getStripe()

  const amount =
    paymentType === "deposit"
      ? Number(booking.depositAmount)
      : Number(booking.balanceDue)

  if (amount <= 0) {
    throw new Error(
      paymentType === "deposit"
        ? "This booking does not have a deposit to collect."
        : "This booking does not have a balance to collect.",
    )
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: stripeCustomerId,
    client_reference_id: booking.id,
    success_url: `${origin}/bookings/${booking.id}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/bookings/${booking.id}/payment/cancel`,
    payment_method_collection: "always",
    payment_intent_data: {
      ...(paymentType === "deposit"
        ? { setup_future_usage: "off_session" as const }
        : {}),
      metadata: {
        bookingId: booking.id,
        paymentType,
      },
    },
    metadata: {
      bookingId: booking.id,
      paymentType,
      referenceCode: booking.referenceCode,
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: booking.currency.toLowerCase(),
          product_data: {
            name:
              paymentType === "deposit"
                ? `Transfer deposit for ${booking.referenceCode}`
                : `Transfer balance for ${booking.referenceCode}`,
            description: `${booking.pickupAddress} -> ${booking.dropoffAddress}`,
          },
          unit_amount: Math.round(amount * 100),
        },
      },
    ],
  })

  if (!session.url) {
    throw new Error("Stripe did not return a Checkout URL.")
  }

  return session.url
}
