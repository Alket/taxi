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
  BOOKER_RELATION_LABELS,
  BOOKER_RELATION_VALUES,
  type BookerRelation,
} from "@/lib/booker-relation"
import {
  CHILD_SEAT_OPTIONS,
  type ChildSeatKey,
  type ChildSeatPrices,
} from "@/lib/child-seats"
import { formatMoney } from "@/lib/format"
import { useBookingStore } from "@/lib/store/booking-store"
import { useBookingFieldFocusListener } from "@/hooks/use-booking-field-focus"
import { useT } from "@/lib/i18n/use-locale"
import { cn } from "@/lib/utils"
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

/** Clickable text beside Base UI checkboxes — avoids htmlFor scroll/toggle bugs. */
function CheckboxText({
  onToggle,
  children,
  className,
}: {
  onToggle: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      className={
        className ??
        "min-w-0 flex-1 cursor-pointer text-left text-sm font-bold text-brand"
      }
      onClick={onToggle}
    >
      {children}
    </button>
  )
}

/** Clickable text beside radios — avoids Label htmlFor focus scroll-to-top. */
function RadioText({
  onSelect,
  children,
  className,
}: {
  onSelect: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      className={
        className ??
        "min-w-0 flex-1 cursor-pointer text-left text-sm font-bold text-brand"
      }
      onMouseDown={(e) => e.preventDefault()}
      onClick={onSelect}
    >
      {children}
    </button>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs text-red-500">{message}</p>
}

export function DetailsStep() {
  const tr = useT()
  const isRoundTrip = useBookingStore((s) => s.isRoundTrip)
  const returnDateTime = useBookingStore((s) => s.returnDateTime)
  const flightNumber = useBookingStore((s) => s.flightNumber)
  const customer = useBookingStore((s) => s.customer)
  const bookedForOther = useBookingStore((s) => s.bookedForOther)
  const passengerName = useBookingStore((s) => s.passengerName)
  const passengerEmail = useBookingStore((s) => s.passengerEmail)
  const passengerPhone = useBookingStore((s) => s.passengerPhone)
  const passengerNoEmail = useBookingStore((s) => s.passengerNoEmail)
  const bookerRelation = useBookingStore((s) => s.bookerRelation)
  const infantCarrierCount = useBookingStore((s) => s.infantCarrierCount)
  const childSeatCount = useBookingStore((s) => s.childSeatCount)
  const boosterCount = useBookingStore((s) => s.boosterCount)
  const driverNotes = useBookingStore((s) => s.driverNotes)
  const meetAndGreet = useBookingStore((s) => s.meetAndGreet)
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
  const passengerPhoneParts = splitPhone(passengerPhone)

  const form = useForm<DetailsFormValues>({
    resolver: zodResolver(schema),
    // Only show errors after the user touches a field (or Continue focuses it).
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: {
      pickupDateTime: toLocalInputValue(
        useBookingStore.getState().pickupDateTime,
      ),
      flightNumber: flightNumber || "",
      bookedForOther,
      name: customer.name,
      email: customer.email,
      phoneCountryCode: phoneParts.countryCode,
      phoneNational: phoneParts.national,
      passengerName,
      passengerEmail,
      passengerNoEmail,
      passengerPhoneCountryCode: passengerPhoneParts.countryCode,
      passengerPhoneNational: passengerPhoneParts.national,
      bookerRelation,
      whatsappOptIn: customer.whatsappOptIn,
    },
  })

  const {
    register,
    control,
    watch,
    trigger,
    setValue,
    clearErrors,
    formState: { errors },
  } = form

  const watchedBookedForOther = watch("bookedForOther")
  const watchedPassengerNoEmail = watch("passengerNoEmail")

  React.useEffect(() => {
    const subscription = watch((values) => {
      const phone =
        values.phoneCountryCode && values.phoneNational
          ? joinPhone(values.phoneCountryCode, values.phoneNational)
          : ""
      const forOther = Boolean(values.bookedForOther)
      const noEmail = Boolean(values.passengerNoEmail)
      const pPhone =
        forOther &&
        values.passengerPhoneCountryCode &&
        values.passengerPhoneNational
          ? joinPhone(
              values.passengerPhoneCountryCode,
              values.passengerPhoneNational,
            )
          : ""

      patch({
        flightNumber: normalizeFlightNumber(
          (values.flightNumber ?? "").toString(),
        ),
        bookedForOther: forOther,
        customer: {
          name: (values.name ?? "").toString(),
          email: (values.email ?? "").toString(),
          phone,
          whatsappOptIn: Boolean(values.whatsappOptIn),
        },
        passengerName: forOther
          ? (values.passengerName ?? "").toString()
          : "",
        passengerEmail:
          forOther && !noEmail
            ? (values.passengerEmail ?? "").toString()
            : "",
        passengerPhone: forOther ? pPhone : "",
        passengerNoEmail: forOther ? noEmail : false,
        bookerRelation: forOther
          ? ((values.bookerRelation as BookerRelation | null) ?? null)
          : null,
      })
    })
    return () => subscription.unsubscribe()
  }, [watch, patch])

  useBookingFieldFocusListener("flightNumber", () => {
    void trigger("flightNumber")
  })
  useBookingFieldFocusListener("name", () => {
    void trigger("name")
  })
  useBookingFieldFocusListener("email", () => {
    void trigger("email")
  })
  useBookingFieldFocusListener("phone", () => {
    void trigger(["phoneCountryCode", "phoneNational"])
  })
  useBookingFieldFocusListener("passengerName", () => {
    void trigger("passengerName")
  })
  useBookingFieldFocusListener("passengerEmail", () => {
    void trigger("passengerEmail")
  })
  useBookingFieldFocusListener("passengerPhone", () => {
    void trigger(["passengerPhoneCountryCode", "passengerPhoneNational"])
  })
  useBookingFieldFocusListener("bookerRelation", () => {
    void trigger("bookerRelation")
  })

  function setBookedForOther(next: boolean) {
    setValue("bookedForOther", next, { shouldValidate: false })
    if (!next) {
      setValue("passengerName", "", { shouldValidate: false })
      setValue("passengerEmail", "", { shouldValidate: false })
      setValue("passengerNoEmail", false, { shouldValidate: false })
      setValue("passengerPhoneNational", "", { shouldValidate: false })
      setValue("bookerRelation", null, { shouldValidate: false })
      clearErrors([
        "passengerName",
        "passengerEmail",
        "passengerPhoneNational",
        "passengerPhoneCountryCode",
        "bookerRelation",
      ])
    } else {
      clearErrors([
        "passengerName",
        "passengerEmail",
        "passengerPhoneNational",
        "passengerPhoneCountryCode",
        "bookerRelation",
      ])
    }
  }

  return (
    <form
      className="flex w-full flex-col gap-8"
      onSubmit={(e) => e.preventDefault()}
    >
      <div className="flex flex-col gap-2" data-booking-field="flightNumber">
        <Label
          htmlFor="flightNumber"
          className="text-sm font-bold text-brand"
        >
          {tr("book.flightNumber")}
        </Label>
        <div className="relative">
          <Input
            id="flightNumber"
            placeholder={tr("book.findMyFlight")}
            aria-invalid={errors.flightNumber ? true : undefined}
            className="h-12 border-border pr-10 shadow-none transition-all focus:border-brand-accent focus:ring-0"
            {...register("flightNumber")}
          />
          <SearchIcon className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
        </div>
        <p className="text-[11px] text-muted-foreground">
          {tr("book.flightNumberHint")}
        </p>
      </div>

      <RadioGroup
        value={watchedBookedForOther ? "false" : "true"}
        onValueChange={(value) => {
          if (value == null) return
          setBookedForOther(value === "false")
        }}
        className="flex flex-col gap-3"
      >
        <div className="flex items-center gap-3">
          <RadioGroupItem
            value="true"
            className="data-checked:border-brand-accent data-checked:text-brand-accent"
            onMouseDown={(e) => e.preventDefault()}
          />
          <RadioText onSelect={() => setBookedForOther(false)}>
            {tr("book.imMainPassenger")}
          </RadioText>
        </div>
        <div className="flex items-center gap-3">
          <RadioGroupItem
            value="false"
            className="data-checked:border-brand-accent data-checked:text-brand-accent"
            onMouseDown={(e) => e.preventDefault()}
          />
          <RadioText onSelect={() => setBookedForOther(true)}>
            {tr("book.bookingForOther")}
          </RadioText>
        </div>
      </RadioGroup>

      {watchedBookedForOther ? (
        <div className="flex flex-col gap-5 rounded-xl border border-border bg-brand-surface/40 p-4">
          <div>
            <p className="text-sm font-bold text-brand">{tr("book.passengerDetails")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Who will be traveling on this transfer
            </p>
          </div>

          <div
            className="flex flex-col gap-2"
            data-booking-field="passengerName"
          >
            <Label
              htmlFor="passengerName"
              className="text-sm font-bold text-brand"
            >
              {tr("book.passengerFullName")}
            </Label>
            <Input
              id="passengerName"
              placeholder={tr("book.enterPassengerName")}
              aria-invalid={errors.passengerName ? true : undefined}
              className="h-12 border-border shadow-none transition-all focus:border-brand-accent focus:ring-0"
              {...register("passengerName")}
            />
            <FieldError message={errors.passengerName?.message} />
          </div>

          <div
            className="flex flex-col gap-2"
            data-booking-field="passengerEmail"
          >
            <Label
              htmlFor="passengerEmail"
              className="text-sm font-bold text-brand"
            >
              {tr("book.passengerEmail")}
            </Label>
            <Input
              id="passengerEmail"
              type="email"
              placeholder={tr("book.enterPassengerEmail")}
              disabled={watchedPassengerNoEmail}
              aria-invalid={errors.passengerEmail ? true : undefined}
              className={cn(
                "h-12 border-border shadow-none transition-all focus:border-brand-accent focus:ring-0",
                watchedPassengerNoEmail && "opacity-50",
              )}
              {...register("passengerEmail")}
            />
            <div className="flex items-start gap-3 pt-1">
              <Controller
                control={control}
                name="passengerNoEmail"
                render={({ field }) => (
                  <>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        const on = Boolean(checked)
                        field.onChange(on)
                        if (on) {
                          setValue("passengerEmail", "", {
                            shouldValidate: false,
                          })
                          clearErrors("passengerEmail")
                        }
                      }}
                      className="mt-0.5 border-border data-checked:border-brand-accent data-checked:bg-brand-accent"
                    />
                    <CheckboxText
                      onToggle={() => {
                        const on = !field.value
                        field.onChange(on)
                        if (on) {
                          setValue("passengerEmail", "", {
                            shouldValidate: false,
                          })
                          clearErrors("passengerEmail")
                        }
                      }}
                      className="min-w-0 flex-1 cursor-pointer text-left text-sm font-semibold text-brand"
                    >
                      {tr("book.passengerNoEmail")}
                    </CheckboxText>
                  </>
                )}
              />
            </div>
            <FieldError message={errors.passengerEmail?.message} />
          </div>

          <div
            className="flex flex-col gap-2"
            data-booking-field="passengerPhone"
          >
            <Label
              htmlFor="passengerPhone"
              className="text-sm font-bold text-brand"
            >
              {tr("book.passengerPhone")}
            </Label>
            <div className="flex gap-2">
              <Controller
                control={control}
                name="passengerPhoneCountryCode"
                render={({ field }) => (
                  <CountryCodeSelect
                    value={field.value || "+355"}
                    onChange={field.onChange}
                  />
                )}
              />
              <Input
                id="passengerPhone"
                type="tel"
                placeholder="e.g. 66 123 4567"
                aria-invalid={
                  errors.passengerPhoneCountryCode ||
                  errors.passengerPhoneNational
                    ? true
                    : undefined
                }
                className="h-12 flex-1 border-border shadow-none transition-all focus:border-brand-accent focus:ring-0"
                {...register("passengerPhoneNational")}
              />
            </div>
            <FieldError
              message={
                errors.passengerPhoneCountryCode?.message ||
                errors.passengerPhoneNational?.message
              }
            />
          </div>

          <div
            className="flex flex-col gap-3"
            data-booking-field="bookerRelation"
          >
            <Label className="text-sm font-bold text-brand">
              {tr("book.relationToPassenger")}
            </Label>
            <Controller
              control={control}
              name="bookerRelation"
              render={({ field }) => (
                <RadioGroup
                  value={field.value ?? ""}
                  onValueChange={(value) => {
                    if (value == null || value === "") return
                    field.onChange(value as BookerRelation)
                  }}
                  className="flex flex-col gap-2.5"
                >
                  {BOOKER_RELATION_VALUES.map((value) => (
                    <div key={value} className="flex items-center gap-3">
                      <RadioGroupItem
                        value={value}
                        className="data-checked:border-brand-accent data-checked:text-brand-accent"
                        onMouseDown={(e) => e.preventDefault()}
                      />
                      <RadioText
                        className="min-w-0 flex-1 cursor-pointer text-left text-sm font-semibold text-brand"
                        onSelect={() => field.onChange(value)}
                      >
                        {BOOKER_RELATION_LABELS[value]}
                      </RadioText>
                    </div>
                  ))}
                </RadioGroup>
              )}
            />
            <FieldError message={errors.bookerRelation?.message} />
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-5">
        {watchedBookedForOther ? (
          <div>
            <p className="text-sm font-bold text-brand">{tr("book.yourDetails")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Booking contact for confirmation and updates
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-2" data-booking-field="name">
          <Label htmlFor="name" className="text-sm font-bold text-brand">
            {tr("book.yourFullName")}
          </Label>
          <Input
            id="name"
            placeholder={tr("book.enterFullName")}
            aria-invalid={errors.name ? true : undefined}
            className="h-12 border-border shadow-none transition-all focus:border-brand-accent focus:ring-0"
            {...register("name")}
          />
          <FieldError message={errors.name?.message} />
        </div>

        <div className="flex flex-col gap-2" data-booking-field="email">
          <Label htmlFor="email" className="text-sm font-bold text-brand">
            {tr("book.yourEmail")}
          </Label>
          <Input
            id="email"
            type="email"
            placeholder={tr("book.enterEmail")}
            aria-invalid={errors.email ? true : undefined}
            className="h-12 border-border shadow-none transition-all focus:border-brand-accent focus:ring-0"
            {...register("email")}
          />
          <FieldError message={errors.email?.message} />
        </div>

        <div className="flex flex-col gap-2" data-booking-field="phone">
          <Label htmlFor="phone" className="text-sm font-bold text-brand">
            {tr("book.phone")}
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
              aria-invalid={
                errors.phoneCountryCode || errors.phoneNational
                  ? true
                  : undefined
              }
              className="h-12 flex-1 border-border shadow-none transition-all focus:border-brand-accent focus:ring-0"
              {...register("phoneNational")}
            />
          </div>
          <FieldError
            message={
              errors.phoneCountryCode?.message ||
              errors.phoneNational?.message
            }
          />
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-border px-3.5 py-3">
          <Checkbox
            checked={meetAndGreet}
            onCheckedChange={(checked) =>
              patch({ meetAndGreet: Boolean(checked) })
            }
            className="mt-1 border-border data-checked:border-brand-accent data-checked:bg-brand-accent"
          />
          <CheckboxText
            onToggle={() => patch({ meetAndGreet: !meetAndGreet })}
            className="min-w-0 flex-1 cursor-pointer text-left"
          >
            <span className="block text-sm font-bold text-brand">
              {tr("book.meetAndGreet")}
            </span>
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
              Driver waits inside arrivals with a name sign
            </span>
          </CheckboxText>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <Controller
            control={control}
            name="whatsappOptIn"
            render={({ field }) => (
              <>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(checked) =>
                    field.onChange(Boolean(checked))
                  }
                  className="mt-1 border-border data-checked:border-brand-accent data-checked:bg-brand-accent"
                />
                <CheckboxText
                  onToggle={() => field.onChange(!field.value)}
                >
                  I agree to receive status updates via email
                </CheckboxText>
              </>
            )}
          />
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <Checkbox
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
            <CheckboxText
              onToggle={() => {
                const enabled = !seatsEnabled
                setSeatsEnabled(enabled)
                if (!enabled) {
                  patch({
                    infantCarrierCount: 0,
                    childSeatCount: 0,
                    boosterCount: 0,
                  })
                }
              }}
            >
              {tr("book.addChildSeats")}
            </CheckboxText>
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
              checked={notesEnabled}
              onCheckedChange={(checked) => {
                const enabled = Boolean(checked)
                setNotesEnabled(enabled)
                if (!enabled) patch({ driverNotes: "" })
              }}
              className="mt-1 border-border data-checked:border-brand-accent data-checked:bg-brand-accent"
            />
            <CheckboxText
              onToggle={() => {
                const enabled = !notesEnabled
                setNotesEnabled(enabled)
                if (!enabled) patch({ driverNotes: "" })
              }}
            >
              {tr("book.driverNotes")}
            </CheckboxText>
          </div>

          {notesEnabled && (
            <div className="flex w-full flex-col gap-1.5">
              <Textarea
                id="driver-notes-text"
                value={driverNotes}
                onChange={(e) =>
                  patch({ driverNotes: e.target.value.slice(0, 500) })
                }
                placeholder={tr("book.driverNotesPlaceholder")}
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
