"use client"

import * as React from "react"
import useSWR from "swr"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { MinusIcon, PlusIcon, SearchIcon } from "lucide-react"

import { fetcher } from "@/lib/api"
import {
  createDetailsSchema,
  joinPhone,
  normalizeFlightNumber,
  splitPhone,
  toLocalInputValue,
  type DetailsFormValues,
} from "@/lib/booking-details"
import {
  CHILD_SEAT_OPTIONS,
  type ChildSeatKey,
  type ChildSeatPrices,
} from "@/lib/child-seats"
import { formatMoney } from "@/lib/format"
import { useBookingStore } from "@/lib/store/booking-store"
import { CountryCodeSelect } from "@/components/booking/country-code-select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"

const SEAT_COUNT_KEYS = {
  infantCarrier: "infantCarrierCount",
  childSeat: "childSeatCount",
  booster: "boosterCount",
} as const satisfies Record<
  ChildSeatKey,
  "infantCarrierCount" | "childSeatCount" | "boosterCount"
>

function SeatStepper({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (next: number) => void
}) {
  return (
    <div className="flex h-9 items-center rounded-md border border-border">
      <button
        type="button"
        className="flex size-9 items-center justify-center text-brand transition-colors hover:bg-muted disabled:opacity-40"
        disabled={value <= 0}
        onClick={() => onChange(Math.max(0, value - 1))}
        aria-label={`Decrease ${label}`}
      >
        <MinusIcon className="size-3.5" />
      </button>
      <span className="min-w-6 text-center text-sm font-bold tabular-nums text-brand">
        {value}
      </span>
      <button
        type="button"
        className="flex size-9 items-center justify-center text-brand transition-colors hover:bg-muted disabled:opacity-40"
        disabled={value >= 4}
        onClick={() => onChange(Math.min(4, value + 1))}
        aria-label={`Increase ${label}`}
      >
        <PlusIcon className="size-3.5" />
      </button>
    </div>
  )
}

export function DetailsStep() {
  const isRoundTrip = useBookingStore((s) => s.isRoundTrip)
  const returnDateTime = useBookingStore((s) => s.returnDateTime)
  const flightNumber = useBookingStore((s) => s.flightNumber)
  const customer = useBookingStore((s) => s.customer)
  const infantCarrierCount = useBookingStore((s) => s.infantCarrierCount)
  const childSeatCount = useBookingStore((s) => s.childSeatCount)
  const boosterCount = useBookingStore((s) => s.boosterCount)
  const driverNotes = useBookingStore((s) => s.driverNotes)
  const patch = useBookingStore((s) => s.patch)

  const { data: config } = useSWR<ChildSeatPrices>(
    "/api/booking/config",
    fetcher,
  )

  const seatCounts: Record<ChildSeatKey, number> = {
    infantCarrier: infantCarrierCount,
    childSeat: childSeatCount,
    booster: boosterCount,
  }
  const childSeats =
    seatCounts.infantCarrier + seatCounts.childSeat + seatCounts.booster > 0

  const [isMainPassenger, setIsMainPassenger] = React.useState("true")
  const [seatsEnabled, setSeatsEnabled] = React.useState(childSeats)
  const [notesEnabled, setNotesEnabled] = React.useState(
    Boolean(driverNotes.trim()),
  )

  React.useEffect(() => {
    if (childSeats) setSeatsEnabled(true)
  }, [childSeats])

  React.useEffect(() => {
    if (driverNotes.trim()) setNotesEnabled(true)
  }, [driverNotes])

  const schema = React.useMemo(
    () => createDetailsSchema({ isRoundTrip, returnDateTime }),
    [isRoundTrip, returnDateTime],
  )

  const phoneParts = splitPhone(customer.phone)

  const form = useForm<DetailsFormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      pickupDateTime: toLocalInputValue(
        useBookingStore.getState().pickupDateTime,
      ),
      flightNumber: flightNumber || "",
      name: customer.name,
      email: customer.email,
      phoneCountryCode: phoneParts.countryCode,
      phoneNational: phoneParts.national,
      whatsappOptIn: customer.whatsappOptIn,
    },
  })

  const {
    register,
    control,
    watch,
    trigger,
    formState: { errors },
  } = form

  React.useEffect(() => {
    const subscription = watch((values) => {
      const phone =
        values.phoneCountryCode && values.phoneNational
          ? joinPhone(values.phoneCountryCode, values.phoneNational)
          : ""

      patch({
        flightNumber: normalizeFlightNumber(
          (values.flightNumber ?? "").toString(),
        ),
        customer: {
          name: (values.name ?? "").toString(),
          email: (values.email ?? "").toString(),
          phone,
          whatsappOptIn: Boolean(values.whatsappOptIn),
        },
      })
    })
    return () => subscription.unsubscribe()
  }, [watch, patch])

  React.useEffect(() => {
    void trigger()
  }, [trigger])

  return (
    <form
      className="flex max-w-xl flex-col gap-8"
      onSubmit={(e) => e.preventDefault()}
    >
      <div className="flex flex-col gap-2">
        <Label
          htmlFor="flightNumber"
          className="text-sm font-bold text-brand"
        >
          Flight number
        </Label>
        <div className="relative">
          <Input
            id="flightNumber"
            placeholder="Find my flight"
            className="h-12 border-border pr-10 shadow-none transition-all focus:border-brand-accent focus:ring-0"
            {...register("flightNumber")}
          />
          <SearchIcon className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Adding your flight number lets us track delays automatically and
          adjust your pickup time.
        </p>
      </div>

      <RadioGroup
        value={isMainPassenger}
        onValueChange={(value) => {
          if (value != null) setIsMainPassenger(String(value))
        }}
        className="flex flex-col gap-3"
      >
        <div className="flex items-center gap-3">
          <RadioGroupItem
            value="true"
            id="p-main"
            className="data-checked:border-brand-accent data-checked:text-brand-accent"
          />
          <Label
            htmlFor="p-main"
            className="text-sm font-bold text-brand"
          >
            I&apos;m the main passenger
          </Label>
        </div>
        <div className="flex items-center gap-3">
          <RadioGroupItem
            value="false"
            id="p-other"
            className="data-checked:border-brand-accent data-checked:text-brand-accent"
          />
          <Label
            htmlFor="p-other"
            className="text-sm font-bold text-brand"
          >
            This booking is for another person
          </Label>
        </div>
      </RadioGroup>

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label
            htmlFor="name"
            className="text-sm font-bold text-brand"
          >
            Your full name
          </Label>
          <Input
            id="name"
            placeholder="Enter your full name"
            className="h-12 border-border shadow-none transition-all focus:border-brand-accent focus:ring-0"
            {...register("name")}
          />
          {errors.name && (
            <p className="text-xs text-red-500">{errors.name.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label
            htmlFor="email"
            className="text-sm font-bold text-brand"
          >
            Your email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="Enter your email"
            className="h-12 border-border shadow-none transition-all focus:border-brand-accent focus:ring-0"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-xs text-red-500">{errors.email.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label
            htmlFor="phone"
            className="text-sm font-bold text-brand"
          >
            Your phone number
          </Label>
          <div className="flex gap-2">
            <Controller
              control={control}
              name="phoneCountryCode"
              render={({ field }) => (
                <CountryCodeSelect
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <Input
              id="phone"
              type="tel"
              placeholder="e.g. 66 123 4567"
              className="h-12 flex-1 border-border shadow-none transition-all focus:border-brand-accent focus:ring-0"
              {...register("phoneNational")}
            />
          </div>
          {(errors.phoneCountryCode || errors.phoneNational) && (
            <p className="text-xs text-red-500">
              {errors.phoneCountryCode?.message ||
                errors.phoneNational?.message}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <Controller
            control={control}
            name="whatsappOptIn"
            render={({ field }) => (
              <Checkbox
                id="opt-in"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                className="mt-1 border-border data-checked:border-brand-accent data-checked:bg-brand-accent"
              />
            )}
          />
          <Label
            htmlFor="opt-in"
            className="text-sm font-bold text-brand"
          >
            I agree to receive status updates via email & sms
          </Label>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="child-seats"
              checked={seatsEnabled}
              onCheckedChange={(checked) => {
                const enabled = Boolean(checked)
                setSeatsEnabled(enabled)
                if (!enabled) {
                  patch({
                    infantCarrierCount: 0,
                    childSeatCount: 0,
                    boosterCount: 0,
                  })
                }
              }}
              className="mt-1 border-border data-checked:border-brand-accent data-checked:bg-brand-accent"
            />
            <Label
              htmlFor="child-seats"
              className="text-sm font-bold text-brand"
            >
              Add child seats
            </Label>
          </div>

          {seatsEnabled && (
            <div className="flex w-full flex-col gap-4">
              {CHILD_SEAT_OPTIONS.map((option) => {
                const unitPrice = config?.[option.priceKey] ?? 0
                return (
                  <div
                    key={option.key}
                    className="flex w-full items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-brand">
                        {option.label}
                      </p>
                      <p className="text-xs font-semibold text-muted-foreground">
                        {option.age}
                        {unitPrice > 0
                          ? ` · ${formatMoney(unitPrice)} each`
                          : " · Included"}
                      </p>
                    </div>
                    <SeatStepper
                      label={option.label}
                      value={seatCounts[option.key]}
                      onChange={(next) =>
                        patch({ [SEAT_COUNT_KEYS[option.key]]: next })
                      }
                    />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <Checkbox
              id="driver-notes"
              checked={notesEnabled}
              onCheckedChange={(checked) => {
                const enabled = Boolean(checked)
                setNotesEnabled(enabled)
                if (!enabled) patch({ driverNotes: "" })
              }}
              className="mt-1 border-border data-checked:border-brand-accent data-checked:bg-brand-accent"
            />
            <Label
              htmlFor="driver-notes"
              className="text-sm font-bold text-brand"
            >
              Add notes for the driver
            </Label>
          </div>

          {notesEnabled && (
            <div className="flex w-full flex-col gap-1.5">
              <Textarea
                id="driver-notes-text"
                value={driverNotes}
                onChange={(e) =>
                  patch({ driverNotes: e.target.value.slice(0, 500) })
                }
                placeholder="e.g. Flight terminal, luggage help, meeting point…"
                rows={3}
                className="min-h-24 resize-y text-sm font-semibold text-brand placeholder:font-semibold"
              />
              <p className="text-xs font-semibold text-muted-foreground">
                {driverNotes.length}/500
              </p>
            </div>
          )}
        </div>
      </div>
    </form>
  )
}
