"use client"

import * as React from "react"
import useSWR from "swr"
import {
  BriefcaseIcon,
  CalendarIcon,
  CarIcon,
  CheckIcon,
  Loader2Icon,
  MapPinIcon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  UsersIcon,
} from "lucide-react"

import { fetcher } from "@/lib/api"
import type { AirportWithCoords } from "@/lib/airports"
import {
  buildPlaceOptions,
  deriveRouteFromPlaces,
  placeKeyFromStore,
} from "@/lib/booking-places"
import {
  CHILD_SEAT_OPTIONS,
  computeChildSeatTotal,
  type ChildSeatPrices,
} from "@/lib/child-seats"
import { formatDateTime, formatMoney } from "@/lib/format"
import { useT } from "@/lib/i18n/use-locale"
import {
  useBookingStore,
  VEHICLE_TYPES,
  type VehicleQuote,
} from "@/lib/store/booking-store"
import type { Direction, VehicleType } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  round2,
  partyStepperLimits,
  clampPartyToLimits,
  DEFAULT_VEHICLE_CAPACITIES,
  getEnabledVehicleTypes,
  VEHICLE_TYPE_VALUES,
} from "@/lib/vehicles"
import {
  formatHeroDateLabel,
  HeroDateTimePicker,
} from "@/components/marketing/hero-datetime-picker"
import { HeroFieldSelect } from "@/components/marketing/hero-field-select"
import type { ServiceZonePlace } from "@/components/booking/zone-place-select"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const SUMMARY_IMAGE_FALLBACK =
  "/uploads/pages/book-your-tirana-airport-transfer-08b1cc.webp"

const VEHICLE_LABELS: Record<string, string> = {
  sedan: "Sedan",
  minivan: "Minivan",
}

type SummaryConfig = ChildSeatPrices & {
  airports?: AirportWithCoords[]
  zones?: ServiceZonePlace[]
  vehicleCapacities?: import("@/lib/vehicles").VehicleCapacityConfig
  enabledVehicleTypes?: VehicleType[]
  sedanEnabled?: boolean
  minivanEnabled?: boolean
}

type QuoteResponse = {
  vehicleType: VehicleType
  price: number
  distanceKm: number
  durationMin: number
}

async function fetchVehicleQuote(body: {
  direction: Direction
  vehicleType: VehicleType
  zoneId: string
  toZoneId?: string | null
}): Promise<QuoteResponse> {
  const res = await fetch("/api/pricing/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const error = new Error(data.error || "Quote failed") as Error & {
      code?: string
      status?: number
    }
    error.code = data.code
    error.status = res.status
    throw error
  }
  return data as QuoteResponse
}

/** Matches homepage hero steppers for Passengers / Luggage. */
function HeroStyleStepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (n: number) => void
}) {
  return (
    <div className="flex flex-1 flex-col gap-2">
      <span className="text-sm font-bold text-brand">{label}</span>
      <div className="flex h-11 items-center justify-between rounded-xl border border-border px-1">
        <button
          type="button"
          className="flex size-9 items-center justify-center rounded-lg text-brand hover:bg-muted disabled:opacity-40"
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          aria-label={`Decrease ${label}`}
        >
          <MinusIcon className="size-4" />
        </button>
        <span className="min-w-6 text-center text-sm font-bold tabular-nums">
          {value}
        </span>
        <button
          type="button"
          className="flex size-9 items-center justify-center rounded-lg text-brand hover:bg-muted disabled:opacity-40"
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          aria-label={`Increase ${label}`}
        >
          <PlusIcon className="size-4" />
        </button>
      </div>
    </div>
  )
}

function EditSection({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border bg-brand-surface p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent">
          <Icon className="size-3.5" strokeWidth={2} />
        </span>
        <h3 className="text-sm font-extrabold tracking-tight text-brand">
          {title}
        </h3>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
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
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <span
          className={
            isLast
              ? "mt-1.5 size-2.5 shrink-0 rounded-full bg-brand-accent"
              : "mt-1.5 size-2.5 shrink-0 rounded-full border-2 border-brand"
          }
        />
        {!isLast ? (
          <span className="my-1 w-px flex-1 bg-border" aria-hidden />
        ) : null}
      </div>
      <div className={"min-w-0 pb-3 " + (isLast ? "" : "")}>
        <p className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
          {label}
        </p>
        <p className="truncate text-sm font-semibold text-brand">{address}</p>
      </div>
    </div>
  )
}

function SummaryEditDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const tr = useT()
  const direction = useBookingStore((s) => s.direction)
  const isRoundTrip = useBookingStore((s) => s.isRoundTrip)
  const selectedAirportIata = useBookingStore((s) => s.selectedAirportIata)
  const selectedZoneId = useBookingStore((s) => s.selectedZoneId)
  const selectedToZoneId = useBookingStore((s) => s.selectedToZoneId)
  const pickupDateTime = useBookingStore((s) => s.pickupDateTime)
  const returnDateTime = useBookingStore((s) => s.returnDateTime)
  const passengerCount = useBookingStore((s) => s.passengerCount)
  const luggageCount = useBookingStore((s) => s.luggageCount)
  const patch = useBookingStore((s) => s.patch)

  const { data: config } = useSWR<SummaryConfig>("/api/booking/config", fetcher)
  const airports = config?.airports ?? []
  const zones = config?.zones ?? []
  const placeOptions = React.useMemo(
    () => buildPlaceOptions(airports, zones),
    [airports, zones],
  )
  const enabledTypes = React.useMemo(() => {
    if (config?.enabledVehicleTypes?.length) {
      return config.enabledVehicleTypes.filter((type): type is VehicleType =>
        (VEHICLE_TYPE_VALUES as readonly string[]).includes(type),
      )
    }
    return getEnabledVehicleTypes({
      sedanEnabled: config?.sedanEnabled,
      minivanEnabled: config?.minivanEnabled,
    })
  }, [
    config?.enabledVehicleTypes,
    config?.sedanEnabled,
    config?.minivanEnabled,
  ])
  const { maxPassengers, maxLuggage } = partyStepperLimits(
    config?.vehicleCapacities ?? DEFAULT_VEHICLE_CAPACITIES,
    enabledTypes,
  )

  const [draftFromKey, setDraftFromKey] = React.useState<string | null>(null)
  const [draftToKey, setDraftToKey] = React.useState<string | null>(null)
  const [draftDateTime, setDraftDateTime] = React.useState<string | null>(null)
  const [draftReturnDateTime, setDraftReturnDateTime] = React.useState<
    string | null
  >(null)
  const [draftPassengers, setDraftPassengers] = React.useState(1)
  const [draftLuggage, setDraftLuggage] = React.useState(0)
  const [calendarOpen, setCalendarOpen] = React.useState(false)
  const [returnCalendarOpen, setReturnCalendarOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    const clamped = clampPartyToLimits(passengerCount, luggageCount, {
      maxPassengers,
      maxLuggage,
    })
    const store = {
      direction,
      selectedAirportIata,
      selectedZoneId,
      selectedToZoneId,
    }
    setDraftFromKey(placeKeyFromStore({ ...store, end: "from" }))
    setDraftToKey(placeKeyFromStore({ ...store, end: "to" }))
    setDraftDateTime(pickupDateTime)
    setDraftReturnDateTime(returnDateTime)
    setDraftPassengers(clamped.passengerCount)
    setDraftLuggage(clamped.luggageCount)
    setCalendarOpen(false)
    setReturnCalendarOpen(false)
    setError(null)
  }, [
    open,
    direction,
    selectedAirportIata,
    selectedZoneId,
    selectedToZoneId,
    pickupDateTime,
    returnDateTime,
    passengerCount,
    luggageCount,
    maxPassengers,
    maxLuggage,
  ])

  function onDraftPickupChange(iso: string) {
    const returnTooSoon =
      draftReturnDateTime != null &&
      new Date(draftReturnDateTime).getTime() <= new Date(iso).getTime()
    setDraftDateTime(iso)
    if (returnTooSoon) setDraftReturnDateTime(null)
  }

  function onFromChange(key: string | null) {
    setDraftFromKey(key)
    if (key && key === draftToKey) setDraftToKey(null)
  }

  function onToChange(key: string | null) {
    setDraftToKey(key)
    if (key && key === draftFromKey) setDraftFromKey(null)
  }

  async function save() {
    const from = placeOptions.find((p) => p.key === draftFromKey)
    const to = placeOptions.find((p) => p.key === draftToKey)
    if (!from || !to) {
      setError("Select From and To.")
      return
    }
    const route = deriveRouteFromPlaces(from, to)
    if (!route) {
      setError("Choose two different places.")
      return
    }
    if (!draftDateTime) {
      setError(tr("book.selectPickupDateTime"))
      return
    }
    if (isRoundTrip) {
      if (!draftReturnDateTime) {
        setError(tr("book.addReturnRequired"))
        return
      }
      const pickupMs = new Date(draftDateTime).getTime()
      const returnMs = new Date(draftReturnDateTime).getTime()
      if (Number.isNaN(returnMs) || returnMs <= pickupMs) {
        setError(tr("book.returnAfterPickup"))
        return
      }
    }

    setSaving(true)
    setError(null)

    const datePatch = {
      pickupDateTime: draftDateTime,
      passengerCount: draftPassengers,
      luggageCount: draftLuggage,
      returnDateTime: isRoundTrip ? draftReturnDateTime : null,
    }

    patch({
      ...route,
      ...datePatch,
    })

    const routeChanged =
      route.direction !== direction ||
      route.selectedZoneId !== selectedZoneId ||
      route.selectedToZoneId !== selectedToZoneId ||
      route.selectedAirportIata !== selectedAirportIata

    if (routeChanged || !useBookingStore.getState().quotedPrice) {
      const typesToQuote =
        enabledTypes.length > 0 ? enabledTypes : VEHICLE_TYPES

      if (typesToQuote.length === 0) {
        patch({
          vehicleQuotes: {},
          quoteStatus: "uncovered",
          quoteError: null,
          quotedDistanceKm: null,
          quotedPrice: null,
          vehicleType: null,
        })
        setSaving(false)
        onOpenChange(false)
        return
      }

      patch({
        quoteStatus: "loading",
        quoteError: null,
        vehicleQuotes: {},
        quotedPrice: null,
        quotedDistanceKm: null,
        vehicleType: null,
      })

      try {
        const settled = await Promise.allSettled(
          typesToQuote.map((vehicleType) =>
            fetchVehicleQuote({
              direction: route.direction,
              vehicleType,
              zoneId: route.selectedZoneId,
              toZoneId:
                route.direction === "zone_to_zone"
                  ? route.selectedToZoneId
                  : null,
            }),
          ),
        )

        const vehicleQuotes = {} as Record<VehicleType, VehicleQuote>
        for (let i = 0; i < settled.length; i++) {
          const result = settled[i]!
          const vehicleType = typesToQuote[i]!
          if (result.status === "fulfilled") {
            vehicleQuotes[vehicleType] = {
              price: result.value.price,
              distanceKm: result.value.distanceKm,
              durationMin: result.value.durationMin,
            }
          }
        }

        const quoted = Object.values(vehicleQuotes)
        if (quoted.length > 0) {
          const preferred =
            vehicleQuotes.sedan ?? vehicleQuotes.minivan
          const selectedType = (
            Object.entries(vehicleQuotes).find(
              ([, quote]) => quote === preferred,
            )?.[0] ?? typesToQuote[0]!
          ) as VehicleType

          patch({
            vehicleQuotes,
            quoteStatus: "success",
            quoteError: null,
            quotedDistanceKm: quoted[0]?.distanceKm ?? null,
            vehicleType: selectedType,
            quotedPrice: preferred?.price ?? null,
          })
        } else {
          patch({
            vehicleQuotes: {},
            quoteStatus: "uncovered",
            quoteError: null,
            quotedDistanceKm: null,
            quotedPrice: null,
            vehicleType: null,
          })
        }
      } catch {
        patch({
          quoteStatus: "error",
          quoteError: tr("book.couldNotLoadPrices"),
        })
      }
    }

    setSaving(false)
    onOpenChange(false)
  }

  const fromOptions = placeOptions.filter((p) => p.key !== draftToKey)
  const toOptions = placeOptions.filter((p) => p.key !== draftFromKey)
  const fromRowRef = React.useRef<HTMLDivElement>(null)
  const toRowRef = React.useRef<HTMLDivElement>(null)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden rounded-3xl border-0 bg-brand-page p-0 ring-1 ring-black/5 sm:max-w-lg">
        <div className="px-4 pt-5 sm:px-5 sm:pt-6">
          <DialogTitle className="font-brand text-xl font-extrabold tracking-tight text-brand">
            Edit your trip
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            Adjust route, pickup time, and party size. Price updates when your
            places change.
          </DialogDescription>
        </div>

        <div className="flex max-h-[min(60dvh,28rem)] flex-col gap-3 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          <EditSection icon={MapPinIcon} title={tr("book.route")}>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-bold text-muted-foreground">
                From
              </Label>
              <div
                ref={fromRowRef}
                className="flex items-center gap-3 rounded-xl border border-border bg-brand-page px-3 py-3.5"
              >
                <MapPinIcon className="size-4 shrink-0 text-brand" />
                <div className="min-w-0 flex-1">
                  <HeroFieldSelect
                    value={draftFromKey}
                    placeholder="Select pickup"
                    options={fromOptions.map((p) => ({
                      value: p.key,
                      label: p.label,
                    }))}
                    onChange={onFromChange}
                    anchor={fromRowRef}
                    mobileSheet
                    sheetTitle="From"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-bold text-muted-foreground">
                To
              </Label>
              <div
                ref={toRowRef}
                className="flex items-center gap-3 rounded-xl border border-border bg-brand-page px-3 py-3.5"
              >
                <MapPinIcon className="size-4 shrink-0 text-brand" />
                <div className="min-w-0 flex-1">
                  <HeroFieldSelect
                    value={draftToKey}
                    placeholder="Select dropoff"
                    options={toOptions.map((p) => ({
                      value: p.key,
                      label: p.label,
                    }))}
                    onChange={onToChange}
                    anchor={toRowRef}
                    mobileSheet
                    sheetTitle="To"
                  />
                </div>
              </div>
            </div>
          </EditSection>

          <EditSection
            icon={CalendarIcon}
            title={isRoundTrip ? tr("book.dates") : tr("book.pickupTime")}
          >
            <div className="flex flex-col gap-1.5">
              {isRoundTrip ? (
                <Label className="text-xs font-bold text-muted-foreground">
                  {tr("book.pickup")}
                </Label>
              ) : null}
              <HeroDateTimePicker
                inDialog
                value={draftDateTime}
                open={calendarOpen}
                onOpenChange={(next) => {
                  setCalendarOpen(next)
                  if (next) setReturnCalendarOpen(false)
                }}
                onChange={onDraftPickupChange}
                variant="compact"
                trigger={
                  <button
                    type="button"
                    onClick={() => {
                      setReturnCalendarOpen(false)
                      setCalendarOpen(true)
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border border-border bg-brand-page px-3 py-3.5 text-left transition-colors hover:bg-muted",
                      calendarOpen && "ring-2 ring-inset ring-black",
                    )}
                  >
                    <CalendarIcon className="size-4 shrink-0 text-brand" />
                    <span
                      className={cn(
                        "text-sm font-bold",
                        draftDateTime ? "text-brand" : "text-muted-foreground",
                      )}
                    >
                      {draftDateTime
                        ? formatHeroDateLabel(draftDateTime)
                        : tr("book.addPickup")}
                    </span>
                  </button>
                }
              />
            </div>

            {isRoundTrip ? (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-bold text-muted-foreground">
                  {tr("book.return")}
                </Label>
                <HeroDateTimePicker
                  inDialog
                  value={draftReturnDateTime}
                  open={returnCalendarOpen}
                  onOpenChange={(next) => {
                    setReturnCalendarOpen(next)
                    if (next) setCalendarOpen(false)
                  }}
                  onChange={setDraftReturnDateTime}
                  minDate={
                    draftDateTime ? new Date(draftDateTime) : new Date()
                  }
                  variant="compact"
                  trigger={
                    <button
                      type="button"
                      onClick={() => {
                        setCalendarOpen(false)
                        setReturnCalendarOpen(true)
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border border-border bg-brand-page px-3 py-3.5 text-left transition-colors hover:bg-muted",
                        returnCalendarOpen && "ring-2 ring-inset ring-black",
                      )}
                    >
                      <CalendarIcon className="size-4 shrink-0 text-brand" />
                      <span
                        className={cn(
                          "text-sm font-bold",
                          draftReturnDateTime
                            ? "text-brand"
                            : "text-muted-foreground",
                        )}
                      >
                        {draftReturnDateTime
                          ? formatHeroDateLabel(draftReturnDateTime)
                          : tr("book.addReturn")}
                      </span>
                    </button>
                  }
                />
              </div>
            ) : null}
          </EditSection>

          <EditSection icon={UsersIcon} title={tr("book.party")}>
            <div className="grid grid-cols-2 gap-4">
              <HeroStyleStepper
                label={tr("book.passengers")}
                value={draftPassengers}
                min={1}
                max={maxPassengers}
                onChange={setDraftPassengers}
              />
              <HeroStyleStepper
                label={tr("book.luggage")}
                value={draftLuggage}
                min={0}
                max={maxLuggage}
                onChange={setDraftLuggage}
              />
            </div>
          </EditSection>

          {error ? (
            <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter className="mx-0 mb-0 gap-2 rounded-none border-border bg-brand-surface p-4 sm:justify-stretch sm:px-5">
          <DialogClose
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-12 min-h-12 w-full flex-1 rounded-xl font-bold touch-manipulation sm:h-11 sm:min-h-11",
            )}
          >
            Cancel
          </DialogClose>
          <Button
            disabled={saving}
            className="h-12 min-h-12 w-full flex-1 rounded-xl bg-brand-accent text-base font-extrabold text-white touch-manipulation hover:bg-brand-accent-hover sm:h-11 sm:min-h-11"
            onClick={() => void save()}
          >
            {saving ? (
              <>
                <Loader2Icon className="animate-spin" data-icon="inline-start" />
                {tr("book.saving")}
              </>
            ) : (
              tr("book.saveChanges")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


export function BookingSummaryContent() {
  const tr = useT()
  const [editOpen, setEditOpen] = React.useState(false)
  const pickup = useBookingStore((s) => s.pickup)
  const dropoff = useBookingStore((s) => s.dropoff)
  const pickupDateTime = useBookingStore((s) => s.pickupDateTime)
  const isRoundTrip = useBookingStore((s) => s.isRoundTrip)
  const returnDateTime = useBookingStore((s) => s.returnDateTime)
  const vehicleType = useBookingStore((s) => s.vehicleType)
  const passengerCount = useBookingStore((s) => s.passengerCount)
  const luggageCount = useBookingStore((s) => s.luggageCount)
  const quotedPrice = useBookingStore((s) => s.quotedPrice)
  const infantCarrierCount = useBookingStore((s) => s.infantCarrierCount)
  const childSeatCount = useBookingStore((s) => s.childSeatCount)
  const boosterCount = useBookingStore((s) => s.boosterCount)
  const createdBookingId = useBookingStore((s) => s.createdBookingId)
  const selectedZoneId = useBookingStore((s) => s.selectedZoneId)

  const { data: config } = useSWR<SummaryConfig>("/api/booking/config", fetcher)
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
  const displayTotal =
    quotedPrice == null
      ? null
      : createdBookingId
        ? quotedPrice
        : round2(quotedPrice + seatAddon)

  const selectedZone = config?.zones?.find((zone) => zone.id === selectedZoneId)
  const summaryImage = selectedZone?.image || SUMMARY_IMAGE_FALLBACK
  const destinationLabel =
    selectedZone?.name ||
    (dropoff.address ? dropoff.address.split(",")[0] : tr("book.yourDestination"))

  return (
    <div className="flex flex-col">
      <div className="relative h-28 w-full overflow-hidden rounded-t-xl bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={summaryImage}
          alt={destinationLabel}
          className="absolute inset-0 size-full object-cover brightness-50"
        />
        <div className="absolute inset-0 flex flex-col justify-between p-4 text-white">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-sm font-bold tracking-wider uppercase">
              {tr("book.orderSummary")}
            </h2>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-md transition-colors hover:bg-white/25"
            >
              <PencilIcon className="size-3" strokeWidth={2.5} />
              {tr("book.edit")}
            </button>
          </div>
          <div className="w-fit rounded bg-brand-surface/20 px-2 py-0.5 text-xs font-bold uppercase backdrop-blur-md">
            {destinationLabel}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5 rounded-b-xl border-x border-b bg-brand-surface p-5">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="text-xs font-semibold text-brand">
              {pickupDateTime
                ? formatDateTime(pickupDateTime)
                : tr("book.setDateTime")}
            </span>
          </div>
          {isRoundTrip ? (
            <div className="flex items-center gap-2 pl-6">
              <span className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
                {tr("book.return")}
              </span>
              <span className="text-xs font-semibold text-brand">
                {returnDateTime
                  ? formatDateTime(returnDateTime)
                  : tr("book.setReturnDate")}
              </span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col">
          <SummaryTimelineItem
            label={tr("book.pickup")}
            address={pickup.address || tr("book.selectPickup")}
          />
          <SummaryTimelineItem
            label={tr("book.dropoff")}
            address={dropoff.address || tr("book.selectDropoff")}
            isLast
          />
        </div>

        <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
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

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-brand">{tr("book.totalPrice")}</p>
            <p className="text-[10px] text-muted-foreground">
              {tr("book.taxesIncluded")}
            </p>
          </div>
          <div className="text-2xl font-bold text-brand-accent">
            {displayTotal != null ? formatMoney(displayTotal) : "—"}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border bg-brand-surface p-5 shadow-sm">
        <h3 className="text-sm font-bold text-brand">{tr("book.bookFlexible")}</h3>
        <ul className="mt-4 space-y-3">
          {[tr("book.flexBullet1"), tr("book.flexBullet2"), tr("book.flexBullet3")].map((text, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-brand-accent" />
              <span className="text-xs font-medium leading-normal text-brand">
                {text}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <SummaryEditDialog open={editOpen} onOpenChange={setEditOpen} />
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
