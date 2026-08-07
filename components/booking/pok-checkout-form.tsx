"use client"

import * as React from "react"
import { GuestCheckoutForm } from "@nebula-ltd/pok-payments-js/react"
import type {
  PaymentErrorResponse,
  PaymentFormData,
} from "@nebula-ltd/pok-payments-js"

import "@nebula-ltd/pok-payments-js/lib/index.css"

/**
 * POK guest card form. It collects the card, runs 3-D Secure and captures the
 * order created server-side; `onPaid` then asks our API to verify the capture
 * against POK before the booking is treated as paid.
 */
export default function PokCheckoutForm({
  orderId,
  environment,
  locale,
  initialState,
  onPaid,
  onFailed,
}: {
  orderId: string
  environment: "staging" | "production"
  locale?: "en" | "it" | "al"
  /** Prefill; POK types this as the full form but accepts partial values. */
  initialState?: Partial<PaymentFormData>
  onPaid: () => void
  onFailed: (error: PaymentErrorResponse) => void
}) {
  return (
    <GuestCheckoutForm
      orderId={orderId}
      onSuccess={onPaid}
      onError={onFailed}
      options={{
        env: environment,
        locale: locale ?? "en",
        countrySelect: "modal",
        ...(initialState
          ? { initialState: initialState as PaymentFormData }
          : {}),
      }}
    />
  )
}
