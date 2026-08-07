"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"

import { apiPost } from "@/lib/api"
import { navigateToBookingConfirmation } from "@/lib/navigate-to-confirmation"
import { clearPokOrderId, readPokOrderId } from "@/lib/pok-order-storage"
import { BookingConfirmingScreen } from "@/components/booking/booking-confirming-screen"

export default function PokReturnClient() {
  const params = useSearchParams()
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    // POK may append its own order identifier; otherwise use the one stored
    // when the order was created. Either way the server re-verifies it.
    const orderId =
      params.get("sdkOrderId") ?? params.get("orderId") ?? readPokOrderId()

    if (!orderId) {
      setError("Missing POK return parameters.")
      return
    }

    let cancelled = false

    async function confirm() {
      try {
        const res = await apiPost<{ referenceCode: string }>(
          "/api/payments/pok/confirm",
          { orderId },
        )
        if (!cancelled) {
          clearPokOrderId()
          navigateToBookingConfirmation(res.referenceCode)
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message || "POK confirmation failed.")
        }
      }
    }

    void confirm()
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

  return <BookingConfirmingScreen message="Confirming POK payment…" />
}
