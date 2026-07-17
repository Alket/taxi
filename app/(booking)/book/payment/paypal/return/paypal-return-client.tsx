"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"

import { apiPost } from "@/lib/api"
import { navigateToBookingConfirmation } from "@/lib/navigate-to-confirmation"
import { BookingConfirmingScreen } from "@/components/booking/booking-confirming-screen"

export default function PaypalReturnClient() {
  const params = useSearchParams()
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const bookingId = params.get("bookingId")
    const orderId = params.get("token")
    const paymentOption =
      params.get("paymentOption") === "full" ? "full" : "deposit"

    if (!bookingId || !orderId) {
      setError("Missing PayPal return parameters.")
      return
    }

    let cancelled = false

    async function capture() {
      try {
        const res = await apiPost<{ referenceCode: string }>(
          "/api/payments/paypal/capture",
          { bookingId, orderId, paymentOption },
        )
        if (!cancelled) {
          navigateToBookingConfirmation(res.referenceCode)
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message || "PayPal capture failed.")
        }
      }
    }

    void capture()
    return () => {
      cancelled = true
    }
  }, [params])

  if (error) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-md flex-col justify-center gap-3 p-6 text-center">
        <h1 className="text-lg font-semibold">Payment incomplete</h1>
        <p className="text-sm text-muted-foreground">{error}</p>
        <a
          href="/"
          className="text-sm font-medium underline-offset-4 hover:underline"
        >
          Back to booking
        </a>
      </div>
    )
  }

  return <BookingConfirmingScreen message="Confirming PayPal payment…" />
}
