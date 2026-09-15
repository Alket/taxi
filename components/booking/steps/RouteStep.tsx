"use client"

import * as React from "react"
import useSWR from "swr"
import { useSearchParams } from "next/navigation"
import { ArrowRightIcon, ArrowUpDownIcon, CalendarIcon } from "lucide-react"

import { fetcher } from "@/lib/api"
import type { AirportWithCoords } from "@/lib/airports"
import { resolveAirportLocation } from "@/lib/airports"
import { resolveZoneFromDestinationParam } from "@/lib/booking-destination-param"
import {
  buildPlaceOptions,
  deriveRouteFromPlaces,
  placeKeyFromStore,
  type BookingPlaceOption,
} from "@/lib/booking-places"
import { isPickupTooSoon } from "@/lib/pickup-lead-time"
import { useBookingFieldFocusListener } from "@/hooks/use-booking-field-focus"
import {
  useBookingStore,
  VEHICLE_TYPES,
  type VehicleQuote,
} from "@/lib/store/booking-store"
import type { Direction, VehicleType } from "@/lib/types"
import { useT } from "@/lib/i18n/use-locale"
import { cn } from "@/lib/utils"
import type { ServiceZonePlace } from "@/components/booking/zone-place-select"
import {
  formatHeroDateLabel,
  HeroDateTimePicker,
} from "@/components/marketing/hero-datetime-picker"
import { TripOptions } from "@/components/booking/steps/TripOptions"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type BookingConfig = {
  companyName: string
  supportEmail: string
  supportPhone: string
  airports: AirportWithCoords[]
  zones: ServiceZonePlace[]
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

export function RouteStep() {
  const tr = useT()
  const searchParams = useSearchParams()
  const direction = useBookingStore((s) => s.direction)
  const selectedAirportIata = useBookingStore((s) => s.selectedAirportIata)
  const selectedZoneId = useBookingStore((s) => s.selectedZoneId)
  const selectedToZoneId = useBookingStore((s) => s.selectedToZoneId)
  const pickup = useBookingStore((s) => s.pickup)
  const dropoff = useBookingStore((s) => s.dropoff)
  const pickupDateTime = useBookingStore((s) => s.pickupDateTime)
  const quoteStatus = useBookingStore((s) => s.quoteStatus)
  const quoteError = useBookingStore((s) => s.quoteError)
  const vehicleType = useBookingStore((s) => s.vehicleType)
  const patch = useBookingStore((s) => s.patch)
  const clearQuotes = useBookingStore((s) => s.clearQuotes)
  const appliedDestinationParam = React.useRef<string | null>(null)

  const { data: config } = useSWR<BookingConfig>(
    "/api/booking/config",
    fetcher,
  )

  const airports = config?.airports ?? []
  const zones = config?.zones ?? []
  const supportEmail = config?.supportEmail ?? "ops@transfers.co"
  const placeOptions = React.useMemo(
    () => buildPlaceOptions(airports, zones),
    [airports, zones],
  )

  const fromKey = placeKeyFromStore({
    direction,
    selectedAirportIata,
    selectedZoneId,
    selectedToZoneId,
    end: "from",
  })
  const toKey = placeKeyFromStore({
    direction,
    selectedAirportIata,
    selectedZoneId,
    selectedToZoneId,
    end: "to",
  })

  const destinationResolved = Boolean(
    direction === "zone_to_zone"
      ? selectedZoneId && selectedToZoneId
      : selectedZoneId && selectedAirportIata,
  )

  const applyPlaces = React.useCallback(
    (from: BookingPlaceOption, to: BookingPlaceOption) => {
      const derived = deriveRouteFromPlaces(from, to)
      if (!derived) {
        clearQuotes()
        patch({
          quoteStatus: "uncovered",
          quoteError: "Choose an airport and a city, or two different cities.",
          vehicleQuotes: {},
          quotedPrice: null,
          vehicleType: null,
        })
        return
      }
      clearQuotes()
      patch(derived)
    },
    [clearQuotes, patch],
  )

  // Default airport once config loads (Tirana if present / only option).
  React.useEffect(() => {
    if (!config || airports.length === 0) return
    if (selectedAirportIata || selectedZoneId) return

    const airport = resolveAirportLocation(airports, null)
    if (!airport) return
    const from = placeOptions.find((p) => p.key === `airport:${airport.iataCode}`)
    if (!from) return
    // Wait for user to pick To — seed From as airport only via store keys
    patch({
      direction: "airport_to_dest",
      selectedAirportIata: airport.iataCode,
      pickup: {
        address: from.label,
        lat: from.lat,
        lng: from.lng,
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once when airports arrive
  }, [config, airports.length])

  // Deep-link: /book?destination=sarande → TIA → zone
  React.useEffect(() => {
    if (!config || zones.length === 0 || airports.length === 0) return
    const param = searchParams.get("destination")?.trim()
    if (!param) return
    if (appliedDestinationParam.current === param) return
    const zone = resolveZoneFromDestinationParam(zones, param)
    if (!zone) return

    appliedDestinationParam.current = param
    const airport = resolveAirportLocation(airports, selectedAirportIata)
    if (!airport) return
    const from = placeOptions.find((p) => p.key === `airport:${airport.iataCode}`)
    const to = placeOptions.find((p) => p.key === `zone:${zone.id}`)
    if (!from || !to) return
    applyPlaces(from, to)
  }, [
    config,
    zones,
    airports,
    searchParams,
    selectedAirportIata,
    placeOptions,
    applyPlaces,
  ])

  const loadQuotes = React.useCallback(async () => {
    const state = useBookingStore.getState()
    const { direction: dir, selectedZoneId: zoneId, selectedToZoneId: toZoneId } =
      state
    if (!dir || !zoneId) return
    if (dir === "zone_to_zone" && !toZoneId) return

    const typesToQuote =
      config?.enabledVehicleTypes?.length
        ? config.enabledVehicleTypes
        : config?.sedanEnabled === false || config?.minivanEnabled === false
          ? VEHICLE_TYPES.filter((type) =>
              type === "sedan"
                ? config.sedanEnabled !== false
                : config.minivanEnabled !== false,
            )
          : VEHICLE_TYPES

    if (typesToQuote.length === 0) {
      patch({
        vehicleQuotes: {},
        quoteStatus: "uncovered",
        quoteError: null,
        quotedDistanceKm: null,
        quotedPrice: null,
        vehicleType: null,
      })
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

    const settled = await Promise.allSettled(
      typesToQuote.map((vt) =>
        fetchVehicleQuote({
          direction: dir,
          vehicleType: vt,
          zoneId,
          toZoneId: dir === "zone_to_zone" ? toZoneId : null,
        }),
      ),
    )

    const vehicleQuotes = {} as Record<VehicleType, VehicleQuote>
    let networkError: string | null = null
    for (let i = 0; i < settled.length; i++) {
      const result = settled[i]!
      const vt = typesToQuote[i]!
      if (result.status === "fulfilled") {
        vehicleQuotes[vt] = {
          price: result.value.price,
          distanceKm: result.value.distanceKm,
          durationMin: result.value.durationMin,
        }
        continue
      }
      const err = result.reason as Error & { code?: string; status?: number }
      if (
        err.status === 404 ||
        err.code === "OUTSIDE_SERVICE_AREA" ||
        err.code === "VEHICLE_DISABLED" ||
        err.status === 400
      ) {
        continue
      }
      networkError = err.message || tr("book.couldNotLoadPrices")
    }

    const quoted = Object.values(vehicleQuotes)
    if (quoted.length > 0) {
      patch({
        vehicleQuotes,
        quoteStatus: "success",
        quoteError: null,
        quotedDistanceKm: quoted[0]?.distanceKm ?? null,
      })
      return
    }

    if (networkError) {
      patch({
        vehicleQuotes: {},
        quoteStatus: "error",
        quoteError: networkError,
        quotedDistanceKm: null,
        quotedPrice: null,
        vehicleType: null,
      })
      return
    }

    patch({
      vehicleQuotes: {},
      quoteStatus: "uncovered",
      quoteError: null,
      quotedDistanceKm: null,
      quotedPrice: null,
      vehicleType: null,
    })
  }, [
    patch,
    tr,
    config?.enabledVehicleTypes,
    config?.sedanEnabled,
    config?.minivanEnabled,
  ])

  React.useEffect(() => {
    if (!direction || !selectedZoneId) return
    if (direction === "zone_to_zone" && !selectedToZoneId) return
    if (direction !== "zone_to_zone" && !selectedAirportIata) return
    void loadQuotes()
  }, [
    direction,
    selectedZoneId,
    selectedToZoneId,
    selectedAirportIata,
    loadQuotes,
  ])

  function onFromChange(key: string | null) {
    if (!key) return
    const from = placeOptions.find((p) => p.key === key)
    if (!from) return
    const to = toKey ? placeOptions.find((p) => p.key === toKey) : null
    if (!to) {
      // Partial selection: stash From only
      clearQuotes()
      if (from.kind === "airport") {
        patch({
          direction: "airport_to_dest",
          selectedAirportIata: from.id,
          selectedZoneId: null,
          selectedToZoneId: null,
          pickup: { address: from.label, lat: from.lat, lng: from.lng },
          dropoff: { address: "", lat: null, lng: null },
        })
      } else {
        patch({
          direction: "dest_to_airport",
          selectedAirportIata: null,
          selectedZoneId: from.id,
          selectedToZoneId: null,
          pickup: { address: from.label, lat: from.lat, lng: from.lng },
          dropoff: { address: "", lat: null, lng: null },
        })
      }
      return
    }
    applyPlaces(from, to)
  }

  function onToChange(key: string | null) {
    if (!key) return
    const to = placeOptions.find((p) => p.key === key)
    if (!to) return
    const from = fromKey ? placeOptions.find((p) => p.key === fromKey) : null
    if (!from) {
      clearQuotes()
      if (to.kind === "airport") {
        patch({
          direction: "dest_to_airport",
          selectedAirportIata: to.id,
          selectedZoneId: null,
          selectedToZoneId: null,
          dropoff: { address: to.label, lat: to.lat, lng: to.lng },
        })
      } else {
        patch({
          direction: "airport_to_dest",
          selectedZoneId: to.id,
          selectedToZoneId: null,
          dropoff: { address: to.label, lat: to.lat, lng: to.lng },
        })
      }
      return
    }
    applyPlaces(from, to)
  }

  function swapPlaces() {
    if (!fromKey || !toKey) return
    const from = placeOptions.find((p) => p.key === fromKey)
    const to = placeOptions.find((p) => p.key === toKey)
    if (!from || !to) return
    applyPlaces(to, from)
  }

  const startedFromHero = useBookingStore((s) => s.startedFromHero)
  const [calendarOpen, setCalendarOpen] = React.useState(false)
  const [pickupDateError, setPickupDateError] = React.useState<string | null>(
    null,
  )

  useBookingFieldFocusListener("destination")
  useBookingFieldFocusListener("pickupDateTime", (message) => {
    setPickupDateError(message ?? tr("book.selectPickupDateTime"))
    setCalendarOpen(true)
  })
  useBookingFieldFocusListener("quote")

  const toOptions = placeOptions.filter((p) => p.key !== fromKey)
  const fromOptions = placeOptions.filter((p) => p.key !== toKey)

  const heroRouteLabels = startedFromHero
    ? {
        from: pickup.address.trim(),
        to: dropoff.address.trim(),
      }
    : null

  return (
    <div className="flex flex-col gap-6">
      {heroRouteLabels && (heroRouteLabels.from || heroRouteLabels.to) && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              From
            </p>
            <p className="truncate text-sm font-bold text-brand">
              {heroRouteLabels.from || "—"}
            </p>
          </div>
          <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              To
            </p>
            <p className="truncate text-sm font-bold text-brand">
              {heroRouteLabels.to || "—"}
            </p>
          </div>
        </div>
      )}

      {startedFromHero && !selectedZoneId && (
        <div
          data-booking-field="destination"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-3 text-sm text-brand"
        >
          Destination missing — go back to the homepage to choose your route.
        </div>
      )}

      {startedFromHero &&
        selectedZoneId &&
        (!pickupDateTime || isPickupTooSoon(pickupDateTime)) && (
          <div
            data-booking-field="pickupDateTime"
            className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-3 text-sm text-brand"
          >
            Pickup time needs updating — go back to the homepage to change it.
          </div>
        )}

      {!startedFromHero && (
        <>
          <div
            className="flex flex-col gap-3"
            data-booking-field="destination"
          >
            <PlaceSelect
              id="from-place"
              label="From"
              placeholder="Select pickup"
              options={fromOptions}
              value={fromKey}
              loading={!config}
              onChange={onFromChange}
            />

            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={!fromKey || !toKey}
                onClick={swapPlaces}
                aria-label="Swap From and To"
              >
                <ArrowUpDownIcon className="size-4" />
                Swap
              </Button>
            </div>

            <PlaceSelect
              id="to-place"
              label="To"
              placeholder="Select dropoff"
              options={toOptions}
              value={toKey}
              loading={!config}
              onChange={onToChange}
            />
          </div>

          <div
            className="flex flex-col gap-1.5"
            data-booking-field="pickupDateTime"
          >
            <Label
              htmlFor="pickupDateTime"
              className="text-sm font-bold text-brand"
            >
              {tr("book.pickupTime")}
            </Label>
            <div className="relative">
              <HeroDateTimePicker
                value={pickupDateTime}
                open={calendarOpen}
                onOpenChange={(open) => {
                  setCalendarOpen(open)
                  if (open) setPickupDateError(null)
                }}
                onChange={(iso) => {
                  patch({ pickupDateTime: iso })
                  setPickupDateError(null)
                }}
                trigger={
                  <button
                    type="button"
                    onClick={() => setCalendarOpen(true)}
                    aria-invalid={pickupDateError ? true : undefined}
                    className={cn(
                      "flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors hover:bg-muted/50",
                      calendarOpen &&
                        "ring-2 ring-brand-accent ring-offset-2 border-brand-accent",
                      pickupDateError &&
                        "border-destructive ring-2 ring-destructive/30",
                    )}
                  >
                    <CalendarIcon className="size-4 text-muted-foreground" />
                    <span
                      className={cn(
                        "flex-1 text-left",
                        !pickupDateTime && "text-muted-foreground",
                      )}
                    >
                      {formatHeroDateLabel(pickupDateTime)}
                    </span>
                  </button>
                }
              />
            </div>
            {pickupDateError && (
              <p className="text-xs text-destructive">{pickupDateError}</p>
            )}
          </div>
        </>
      )}

      <TripOptions />

      {quoteStatus === "loading" && (
        <div
          data-booking-field="quote"
          className="rounded-lg border bg-muted/20 px-3 py-3 text-sm text-muted-foreground"
        >
          {tr("book.gettingPrices")}
        </div>
      )}

      {quoteStatus === "success" && !vehicleType && (
        <div
          data-booking-field="quote"
          className="rounded-lg border bg-muted/20 px-3 py-3 text-sm text-muted-foreground"
        >
          Calculating your price…
        </div>
      )}

      {quoteStatus === "uncovered" && (
        <div
          data-booking-field="quote"
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm"
        >
          <p className="font-medium text-foreground">
            {tr("book.notCovered")}
          </p>
          <p className="mt-1 text-muted-foreground">
            Contact us at{" "}
            <a
              href={`mailto:${supportEmail}`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {supportEmail}
            </a>{" "}
            and we&apos;ll see if we can help.
          </p>
        </div>
      )}

      {quoteStatus === "error" && (
        <div
          data-booking-field="quote"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-3 text-sm"
        >
          <p className="font-medium text-destructive">
            {tr("book.couldNotLoadPrices")}
          </p>
          <p className="mt-1 text-muted-foreground">
            {quoteError || tr("book.quoteFailedGeneric")}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={() => void loadQuotes()}
            disabled={!destinationResolved}
          >
            Retry
          </Button>
        </div>
      )}
    </div>
  )
}

function PlaceSelect({
  id,
  label,
  placeholder,
  options,
  value,
  loading,
  onChange,
}: {
  id: string
  label: string
  placeholder: string
  options: BookingPlaceOption[]
  value: string | null
  loading?: boolean
  onChange: (key: string | null) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-sm font-bold text-brand">
        {label}
      </Label>
      <Select
        value={value}
        disabled={loading || options.length === 0}
        onValueChange={(next) => onChange(next)}
      >
        <SelectTrigger
          id={id}
          className="w-full focus:ring-brand-accent focus:border-brand-accent"
        >
          <SelectValue
            placeholder={
              loading
                ? "Loading…"
                : options.length === 0
                  ? "No places available"
                  : placeholder
            }
          >
            {options.find((o) => o.key === value)?.label}
          </SelectValue>
        </SelectTrigger>
        <SelectContent variant="brand">
          {options.map((opt) => (
            <SelectItem key={opt.key} value={opt.key}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
