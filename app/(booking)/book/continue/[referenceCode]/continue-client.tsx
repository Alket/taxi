"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Loader2Icon } from "lucide-react"

import { useBookingStore } from "@/lib/store/booking-store"
import type { Direction, VehicleType } from "@/lib/types"
import { Button } from "@/components/ui/button"

type ContinuePayload = {
  bookingId: string
  referenceCode: string
  depositAmount: number
  totalPrice: number
  currency: string
  direction: Direction
  pickupAddress: string
  dropoffAddress: string
  pickupDateTime: string
  flightNumber: string
  passengerCount: number
  luggageCount: number
  vehicleType: VehicleType
  zoneId: string
  meetAndGreet: boolean
  isRoundTrip: boolean
  customer: { name: string; email: string; phone: string }
}

export default function ContinueBookingPage() {
  const params = useParams<{ referenceCode: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const patch = useBookingStore((s) => s.patch)
  const setStep = useBookingStore((s) => s.setStep)

  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false

    async function run() {
      setLoading(true)
      setError(null)
      const referenceCode = decodeURIComponent(params.referenceCode || "")
      const token = searchParams.get("token") || ""
      if (!referenceCode || !token) {
        setError("This continue link is incomplete.")
        setLoading(false)
        return
      }

      try {
        const res = await fetch(
          `/api/bookings/continue/${encodeURIComponent(referenceCode)}?token=${encodeURIComponent(token)}`,
          { headers: { "ngrok-skip-browser-warning": "true" } },
        )
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(
            body?.error ||
              (body?.code === "SUPERSEDED"
                ? "This checkout was replaced by a newer booking."
                : "Could not resume this booking."),
          )
        }
        const data = body as ContinuePayload
        if (cancelled) return

        patch({
          direction: data.direction,
          selectedZoneId: data.zoneId,
          pickup: {
            address: data.pickupAddress,
            lat: 0,
            lng: 0,
          },
          dropoff: {
            address: data.dropoffAddress,
            lat: 0,
            lng: 0,
          },
          pickupDateTime: data.pickupDateTime,
          flightNumber: data.flightNumber || "",
          passengerCount: data.passengerCount,
          luggageCount: data.luggageCount,
          vehicleType: data.vehicleType,
          isRoundTrip: data.isRoundTrip,
          meetAndGreet: data.meetAndGreet,
          quotedPrice: data.totalPrice,
          quoteStatus: "success",
          customer: {
            name: data.customer.name,
            email: data.customer.email,
            phone: data.customer.phone,
            whatsappOptIn: true,
          },
          createdBookingId: data.bookingId,
          createdReferenceCode: data.referenceCode,
          createdDepositAmount: data.depositAmount,
          createdCurrency: data.currency,
          startedFromHero: false,
          currentStep: 2,
        })
        setStep(2)
        router.replace("/book")
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message || "Could not resume this booking.")
          setLoading(false)
        }
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [params.referenceCode, searchParams, patch, setStep, router])

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      {loading ? (
        <>
          <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Continuing your booking…
          </p>
        </>
      ) : (
        <>
          <h1 className="text-xl font-semibold tracking-tight">
            Cannot continue this booking
          </h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button asChild>
            <Link href="/">Start a new booking</Link>
          </Button>
        </>
      )}
    </div>
  )
}
