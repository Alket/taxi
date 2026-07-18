"use client"

import * as React from "react"
import Image from "next/image"
import useSWR from "swr"
import {
  CalendarIcon,
  MapPinIcon,
  UsersIcon,
  BriefcaseIcon,
  CarIcon,
  CheckIcon,
} from "lucide-react"

import { fetcher } from "@/lib/api"
import {
  CHILD_SEAT_OPTIONS,
  computeChildSeatTotal,
  type ChildSeatPrices,
} from "@/lib/child-seats"
import { formatDateTime, formatMoney } from "@/lib/format"
import { useBookingStore } from "@/lib/store/booking-store"
import { cn } from "@/lib/utils"
import { round2 } from "@/lib/vehicles"
import { Separator } from "@/components/ui/separator"

const VEHICLE_LABELS: Record<string, string> = {
  sedan: "Sedan",
  comfort: "Comfort",
  minivan: "Minivan",
  premium: "Premium",
}

function SummaryTimelineItem({
  label,
  address,
  isLast = false,
}: {
  label: string
  address: string
  isLast?: boolean
}) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="size-2 rounded-full border-2 border-brand-accent bg-brand-surface" />
        {!isLast && <div className="h-full w-0.5 bg-brand-accent/30" />}
      </div>
      <div className="pb-4">
        <p className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
          {label}
        </p>
        <p className="text-xs font-medium leading-tight text-brand">
          {address}
        </p>
      </div>
    </div>
  )
}

export function BookingSummaryContent() {
  const pickup = useBookingStore((s) => s.pickup)
  const dropoff = useBookingStore((s) => s.dropoff)
  const pickupDateTime = useBookingStore((s) => s.pickupDateTime)
  const vehicleType = useBookingStore((s) => s.vehicleType)
  const passengerCount = useBookingStore((s) => s.passengerCount)
  const luggageCount = useBookingStore((s) => s.luggageCount)
  const quotedPrice = useBookingStore((s) => s.quotedPrice)
  const infantCarrierCount = useBookingStore((s) => s.infantCarrierCount)
  const childSeatCount = useBookingStore((s) => s.childSeatCount)
  const boosterCount = useBookingStore((s) => s.boosterCount)
  const createdBookingId = useBookingStore((s) => s.createdBookingId)
  const setStep = useBookingStore((s) => s.setStep)

  const { data: config } = useSWR<ChildSeatPrices>("/api/booking/config", fetcher)
  const seatPrices: ChildSeatPrices = {
    infantCarrierPrice: config?.infantCarrierPrice ?? 0,
    childSeatPrice: config?.childSeatPrice ?? 0,
    boosterSeatPrice: config?.boosterSeatPrice ?? 0,
  }
  const seatCounts = {
    infantCarrier: infantCarrierCount,
    childSeat: childSeatCount,
    booster: boosterCount,
  }
  const seatAddon = computeChildSeatTotal(seatCounts, seatPrices)
  // After checkout create, quotedPrice is already the full charged total.
  const displayTotal =
    quotedPrice == null
      ? null
      : createdBookingId
        ? quotedPrice
        : round2(quotedPrice + seatAddon)

  return (
    <div className="flex flex-col">
      {/* Header Image Section */}
      <div className="relative h-28 w-full overflow-hidden rounded-t-xl bg-muted">
        <Image
          src="/hero_photo_desktop_2.jpg"
          alt="Summary"
          fill
          className="object-cover brightness-50"
        />
        <div className="absolute inset-0 flex flex-col justify-between p-4 text-white">
          <h2 className="text-sm font-bold uppercase tracking-wider">Order Summary</h2>
          <div className="rounded bg-brand-surface/20 px-2 py-0.5 backdrop-blur-md w-fit text-xs font-bold uppercase">
            {dropoff.address ? dropoff.address.split(',')[0] : "Your Destination"}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5 border-x border-b rounded-b-xl bg-brand-surface p-5">
        {/* Date & Time */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarIcon className="size-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-brand">
              {pickupDateTime ? formatDateTime(pickupDateTime) : "Set date & time"}
            </span>
          </div>
          <button
            onClick={() => setStep(1)}
            className="text-[11px] font-bold text-muted-foreground uppercase hover:text-brand"
          >
            Edit
          </button>
        </div>

        {/* Timeline */}
        <div className="flex flex-col">
          <SummaryTimelineItem
            label="Pickup"
            address={pickup.address || "Select pickup"}
          />
          <SummaryTimelineItem
            label="Dropoff"
            address={dropoff.address || "Select dropoff"}
            isLast
          />
        </div>

        {/* Vehicle Specs */}
        <div className="flex items-center gap-4 text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <CarIcon className="size-4" />
            <span className="text-xs font-medium">
              {vehicleType ? VEHICLE_LABELS[vehicleType] : "—"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <UsersIcon className="size-4" />
            <span className="text-xs font-medium">{passengerCount}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <BriefcaseIcon className="size-4" />
            <span className="text-xs font-medium">{luggageCount}</span>
          </div>
        </div>

        <Separator />

        {seatAddon > 0 && !createdBookingId && (
          <div className="flex flex-col gap-1.5 text-xs">
            {CHILD_SEAT_OPTIONS.map((option) => {
              const count = seatCounts[option.key]
              if (count <= 0) return null
              const unit = seatPrices[option.priceKey]
              return (
                <div
                  key={option.key}
                  className="flex items-center justify-between gap-3 text-muted-foreground"
                >
                  <span>
                    {option.label} ×{count}
                  </span>
                  <span className="font-medium tabular-nums text-brand">
                    {formatMoney(unit * count)}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Price Section */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-brand">Total price</p>
            <p className="text-[10px] text-muted-foreground">Taxes & fees included</p>
          </div>
          <div className="text-2xl font-bold text-brand-accent">
            {displayTotal != null ? formatMoney(displayTotal) : "—"}
          </div>
        </div>

        {/* Small Note */}
        <p className="text-[10px] leading-tight text-muted-foreground">
          Free cancellation until 24 hours before pickup.
          No hidden fees.
        </p>
      </div>

      {/* Flexible Card */}
      <div className="mt-4 rounded-xl border bg-brand-surface p-5 shadow-sm">
        <h3 className="text-sm font-bold text-brand">Book now and be flexible</h3>
        <ul className="mt-4 space-y-3">
          {[
            "Modify your dates & times, at anytime for free",
            "Secure this price now; prices may change soon.",
            "Easily add more guests to your booking anytime.",
          ].map((text, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-brand-accent" />
              <span className="text-xs font-medium leading-normal text-brand">
                {text}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** Desktop sticky summary card */
export function BookingSummaryPanel({ className }: { className?: string }) {
  return (
    <aside className={cn("sticky top-6", className)}>
      <BookingSummaryContent />
    </aside>
  )
}
