"use client"

import * as React from "react"
import useSWR from "swr"
import {
  CalendarIcon,
  MinusIcon,
  PlusIcon,
} from "lucide-react"

import { fetcher } from "@/lib/api"
import {
  formatHeroDateLabel,
  HeroDateTimePicker,
} from "@/components/marketing/hero-datetime-picker"
import { formatMoney } from "@/lib/format"
import { useBookingStore } from "@/lib/store/booking-store"
import { cn } from "@/lib/utils"
import { useAutoSelectVehicle } from "@/hooks/use-auto-select-vehicle"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useBookingFieldFocusListener } from "@/hooks/use-booking-field-focus"

type BookingConfig = {
  roundTripDiscountPercent?: number
}

function Stepper({
  id,
  label,
  value,
  min,
  max,
  onChange,
}: {
  id: string
  label: string
  value: number
  min: number
  max: number
  onChange: (next: number) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
      <Label htmlFor={id} className="text-sm font-bold text-brand">
        {label}
      </Label>
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          aria-label={`Decrease ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="focus:ring-brand-accent"
        >
          <MinusIcon />
        </Button>
        <Input
          id={id}
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => {
            const parsed = Number.parseInt(e.target.value, 10)
            if (!Number.isFinite(parsed)) return
            onChange(Math.min(max, Math.max(min, parsed)))
          }}
          className="h-7 w-12 px-1 text-center tabular-nums focus:border-brand-accent focus:ring-brand-accent"
        />
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          aria-label={`Increase ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="focus:ring-brand-accent"
        >
          <PlusIcon />
        </Button>
      </div>
    </div>
  )
}

/** Passengers, luggage, round-trip, meet & greet — vehicle is auto-selected. */
export function TripOptions() {
  const vehicleType = useBookingStore((s) => s.vehicleType)
  const vehicleQuotes = useBookingStore((s) => s.vehicleQuotes)
  const passengerCount = useBookingStore((s) => s.passengerCount)
  const luggageCount = useBookingStore((s) => s.luggageCount)
  const isRoundTrip = useBookingStore((s) => s.isRoundTrip)
  const returnDateTime = useBookingStore((s) => s.returnDateTime)
  const pickupDateTime = useBookingStore((s) => s.pickupDateTime)
  const quotedPrice = useBookingStore((s) => s.quotedPrice)
  const startedFromHero = useBookingStore((s) => s.startedFromHero)
  const patch = useBookingStore((s) => s.patch)

  const { data: config } = useSWR<BookingConfig>("/api/booking/config", fetcher)
  const discountPercent = config?.roundTripDiscountPercent ?? 0

  useAutoSelectVehicle(discountPercent)

  const [calendarOpen, setCalendarOpen] = React.useState(false)
  const [returnDateError, setReturnDateError] = React.useState<string | null>(
    null,
  )
  const returnDateFieldRef = React.useRef<HTMLDivElement>(null)

  useBookingFieldFocusListener("returnDateTime", (message) => {
    setReturnDateError(message ?? "Select a return date & time.")
    setCalendarOpen(true)
  })

  const oneWayPrice =
    vehicleType && vehicleQuotes[vehicleType]
      ? vehicleQuotes[vehicleType]!.price
      : null
  const combinedBeforeDiscount =
    oneWayPrice != null && isRoundTrip ? oneWayPrice * 2 : null

  function setRoundTrip(enabled: boolean) {
    patch({
      isRoundTrip: enabled,
      returnDateTime: enabled ? returnDateTime : null,
    })
    if (!enabled) setReturnDateError(null)
  }

  return (
    <div className="flex flex-col gap-6">
      {!startedFromHero && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Stepper
            id="passengerCount"
            label="Passengers"
            value={passengerCount}
            min={1}
            max={8}
            onChange={(next) => patch({ passengerCount: next })}
          />
          <Stepper
            id="luggageCount"
            label="Luggage"
            value={luggageCount}
            min={0}
            max={10}
            onChange={(next) => patch({ luggageCount: next })}
          />
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-xl border p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Label
              htmlFor="roundTrip"
              className="text-sm font-bold text-brand"
            >
              Round trip
            </Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Creates two linked bookings (outbound + return).
            </p>
          </div>
          <Switch
            id="roundTrip"
            checked={isRoundTrip}
            onCheckedChange={(checked) => setRoundTrip(Boolean(checked))}
            className="data-checked:bg-brand-accent"
          />
        </div>

        {isRoundTrip && (
          <div
            ref={returnDateFieldRef}
            id="return-date-field"
            data-booking-field="returnDateTime"
            className="flex flex-col gap-1.5 border-t pt-3"
          >
            <Label htmlFor="returnDateTime" className="text-sm font-bold text-brand">
              Return date & time
            </Label>
            <div className="relative">
              <HeroDateTimePicker
                value={returnDateTime}
                open={calendarOpen}
                onOpenChange={setCalendarOpen}
                onChange={(iso) => {
                  patch({ returnDateTime: iso })
                  setReturnDateError(null)
                }}
                minDate={
                  pickupDateTime ? new Date(pickupDateTime) : new Date()
                }
                variant="compact"
                trigger={
                  <button
                    type="button"
                    id="returnDateTime"
                    onClick={() => setCalendarOpen(true)}
                    aria-invalid={Boolean(returnDateError)}
                    className={cn(
                      "flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-brand transition-colors hover:bg-muted/50",
                      calendarOpen &&
                        "border-brand-accent ring-2 ring-brand-accent ring-offset-2",
                      returnDateError &&
                        "border-red-500 ring-2 ring-red-500/30 ring-offset-2",
                    )}
                  >
                    <CalendarIcon className="size-4 text-muted-foreground" />
                    <span
                      className={cn(
                        "flex-1 text-left",
                        !returnDateTime && "text-muted-foreground",
                      )}
                    >
                      {formatHeroDateLabel(returnDateTime)}
                    </span>
                  </button>
                }
              />
            </div>
            {returnDateError && (
              <p className="text-xs text-red-500">{returnDateError}</p>
            )}
            {discountPercent > 0 && combinedBeforeDiscount != null && (
              <p className="text-xs text-muted-foreground">
                {discountPercent}% round-trip discount applied
                {quotedPrice != null && (
                  <>
                    {" "}
                    (
                    <span className="line-through">
                      {formatMoney(combinedBeforeDiscount)}
                    </span>{" "}
                    → {formatMoney(quotedPrice)})
                  </>
                )}
              </p>
            )}
            {discountPercent <= 0 && oneWayPrice != null && (
              <p className="text-xs text-muted-foreground">
                Combined total: {formatMoney(oneWayPrice * 2)} (two one-way
                fares)
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
