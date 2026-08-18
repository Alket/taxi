"use client"

import * as React from "react"
import useSWR from "swr"
import { useSearchParams } from "next/navigation"
import { PlaneTakeoffIcon, PlaneLandingIcon, CalendarIcon } from "lucide-react"

import { fetcher } from "@/lib/api"
import type { AirportWithCoords } from "@/lib/airports"
import { resolveAirportLocation } from "@/lib/airports"
import { resolveZoneFromDestinationParam } from "@/lib/booking-destination-param"
import { isPickupTooSoon } from "@/lib/pickup-lead-time"
import { useBookingFieldFocusListener } from "@/hooks/use-booking-field-focus"
import {
  useBookingStore,
  VEHICLE_TYPES,
  type BookingLocation,
  type VehicleQuote,
} from "@/lib/store/booking-store"
import type { Direction, VehicleType } from "@/lib/types"
import { useT } from "@/lib/i18n/use-locale"
import { cn } from "@/lib/utils"
import {
  ZonePlaceSelect,
  matchZoneId,
  type ResolvedZonePlace,
  type ServiceZonePlace,
} from "@/components/booking/zone-place-select"
import { formatHeroDateLabel, HeroDateTimePicker } from "@/components/marketing/hero-datetime-picker"
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

function airportLocation(airport: AirportWithCoords): BookingLocation {
  return {
    address: `${airport.name} (${airport.iataCode})`,
    lat: airport.lat,
    lng: airport.lng,
  }
}

function emptyLocation(): BookingLocation {
  return { address: "", lat: null, lng: null }
}

async function fetchVehicleQuote(body: {
  direction: Direction
  vehicleType: VehicleType
  zoneId: string
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
  const selectedZoneIdFromStore = useBookingStore((s) => s.selectedZoneId)
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

  const destinationLocation =
    direction === "dest_to_airport"
      ? { address: pickup.address }
      : { address: dropoff.address }

  const selectedZoneId = matchZoneId(
    zones,
    destinationLocation,
    selectedZoneIdFromStore,
  )

  const destinationResolved = Boolean(selectedZoneId)

  const applyEndpoints = React.useCallback(
    (
      nextDirection: Direction,
      airport: AirportWithCoords | null,
      destination: BookingLocation | null,
      zoneId?: string | null,
    ) => {
      const airportLoc = airport ? airportLocation(airport) : emptyLocation()
      const destLoc = destination ?? emptyLocation()

      if (nextDirection === "airport_to_dest") {
        patch({
          direction: nextDirection,
          selectedAirportIata: airport?.iataCode ?? null,
          selectedZoneId: zoneId ?? null,
          pickup: airportLoc,
          dropoff: destLoc,
        })
      } else {
        patch({
          direction: nextDirection,
          selectedAirportIata: airport?.iataCode ?? null,
          selectedZoneId: zoneId ?? null,
          pickup: destLoc,
          dropoff: airportLoc,
        })
      }
    },
    [patch],
  )

  // Default airport once config loads (Tirana if present / only option).
  React.useEffect(() => {
    if (!config || airports.length === 0) return
    if (selectedAirportIata) return

    const airport = resolveAirportLocation(airports, null)
    if (!airport) return

    const dest: BookingLocation =
      direction === "dest_to_airport"
        ? { address: pickup.address, lat: pickup.lat, lng: pickup.lng }
        : { address: dropoff.address, lat: dropoff.lat, lng: dropoff.lng }

    applyEndpoints(direction ?? "airport_to_dest", airport, dest)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once when airports arrive
  }, [config, airports.length])

  // Deep-link: /book?destination=sarande (also accepts zone name / transfer slug)
  React.useEffect(() => {
    if (!config || zones.length === 0 || airports.length === 0) return
    const param = searchParams.get("destination")?.trim()
    if (!param) return
    if (appliedDestinationParam.current === param) return
    const zone = resolveZoneFromDestinationParam(zones, param)
    if (!zone) return

    appliedDestinationParam.current = param
    const airport = resolveAirportLocation(airports, selectedAirportIata)
    applyEndpoints(
      "airport_to_dest",
      airport,
      {
        address: zone.name,
        lat: airport?.lat ?? 0,
        lng: airport?.lng ?? 0,
      },
      zone.id,
    )
  }, [
    config,
    zones,
    airports,
    searchParams,
    selectedAirportIata,
    applyEndpoints,
  ])

  const loadQuotes = React.useCallback(async () => {
    const state = useBookingStore.getState()
    const { direction: dir, selectedZoneId: zoneId } = state
    if (!dir || !zoneId) {
      return
    }

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
      typesToQuote.map((vehicleType) =>
        fetchVehicleQuote({
          direction: dir,
          vehicleType,
          zoneId,
        }),
      ),
    )

    const vehicleQuotes = {} as Record<VehicleType, VehicleQuote>
    let networkError: string | null = null
    for (let i = 0; i < settled.length; i++) {
      const result = settled[i]!
      const vehicleType = typesToQuote[i]!
      if (result.status === "fulfilled") {
        vehicleQuotes[vehicleType] = {
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
  }, [patch, tr, config?.enabledVehicleTypes, config?.sedanEnabled, config?.minivanEnabled])

  // Auto-quote once a destination zone is selected.
  React.useEffect(() => {
    if (!direction || !selectedZoneId) {
      return
    }

    void loadQuotes()
  }, [direction, selectedZoneId, loadQuotes])

  function setDirection(next: Direction) {
    const airport = resolveAirportLocation(airports, selectedAirportIata)
    const dest: BookingLocation =
      direction === "dest_to_airport"
        ? { address: pickup.address, lat: pickup.lat, lng: pickup.lng }
        : { address: dropoff.address, lat: dropoff.lat, lng: dropoff.lng }

    clearQuotes()
    applyEndpoints(next, airport, dest, selectedZoneId)
  }

  function setAirport(iata: string) {
    const airport = resolveAirportLocation(airports, iata)
    if (!airport) return

    const dest: BookingLocation =
      direction === "dest_to_airport"
        ? { address: pickup.address, lat: pickup.lat, lng: pickup.lng }
        : { address: dropoff.address, lat: dropoff.lat, lng: dropoff.lng }

    clearQuotes()
    applyEndpoints(direction ?? "airport_to_dest", airport, dest, selectedZoneId)
  }

  function onDestinationResolved(place: ResolvedZonePlace) {
    const airport = resolveAirportLocation(airports, selectedAirportIata)
    applyEndpoints(
      direction ?? "airport_to_dest",
      airport,
      {
        address: place.address,
        lat: airport?.lat ?? 0,
        lng: airport?.lng ?? 0,
      },
      place.zoneId,
    )
  }

  function onDestinationCleared() {
    const airport = resolveAirportLocation(airports, selectedAirportIata)
    clearQuotes()
    applyEndpoints(direction ?? "airport_to_dest", airport, emptyLocation(), null)
  }

  const startedFromHero = useBookingStore((s) => s.startedFromHero)
  const showAirportSelect = airports.length > 1
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

  return (
    <div className="flex flex-col gap-6">
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
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-bold text-brand">Direction</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              <DirectionButton
                active={direction === "airport_to_dest"}
                icon={PlaneLandingIcon}
                title={tr("book.airportToDest")}
                description={tr("book.airportToDestDesc")}
                onClick={() => setDirection("airport_to_dest")}
              />
              <DirectionButton
                active={direction === "dest_to_airport"}
                icon={PlaneTakeoffIcon}
                title={tr("book.destToAirport")}
                description={tr("book.destToAirportDesc")}
                onClick={() => setDirection("dest_to_airport")}
              />
            </div>
          </div>

          {showAirportSelect && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="airport" className="text-sm font-bold text-brand">
                Airport
              </Label>
              <Select
                value={selectedAirportIata}
                onValueChange={(value) => {
                  if (value) setAirport(value)
                }}
              >
                <SelectTrigger id="airport" className="w-full focus:ring-brand-accent focus:border-brand-accent">
                  <SelectValue placeholder={tr("book.selectAirportPlaceholder")} />
                </SelectTrigger>
                <SelectContent variant="brand">
                  {airports.map((airport) => (
                    <SelectItem key={airport.iataCode} value={airport.iataCode}>
                      {airport.name} ({airport.iataCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!showAirportSelect && airports[0] && (
            <div className="rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Airport
              </p>
              <p className="font-medium">
                {airports[0].name} ({airports[0].iataCode})
              </p>
            </div>
          )}

          <div className="flex flex-col gap-1.5" data-booking-field="destination">
            <ZonePlaceSelect
              label={
                direction === "dest_to_airport"
                  ? tr("book.pickupAddress")
                  : tr("book.destinationAddress")
              }
              placeholder={tr("book.selectServiceArea")}
              zones={zones}
              value={selectedZoneId}
              loading={!config}
              onResolved={onDestinationResolved}
              onCleared={onDestinationCleared}
            />
          </div>

          <div className="flex flex-col gap-1.5" data-booking-field="pickupDateTime">
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
                      calendarOpen && "ring-2 ring-brand-accent ring-offset-2 border-brand-accent",
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
          <p className="font-medium text-destructive">{tr("book.couldNotLoadPrices")}</p>
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

function DirectionButton({
  active,
  icon: Icon,
  title,
  description,
  onClick,
}: {
  active: boolean
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-1 rounded-xl border px-3.5 py-3 text-left transition-colors",
        active
          ? "border-brand-accent bg-brand-accent/5 ring-1 ring-brand-accent/30"
          : "hover:bg-muted/50",
      )}
      aria-pressed={active}
    >
      <Icon
        className={cn(
          "size-4",
          active ? "text-brand-accent" : "text-muted-foreground",
        )}
      />
      <span className="text-sm font-medium">{title}</span>
      <span className="text-xs text-muted-foreground">{description}</span>
    </button>
  )
}

