"use client"

import * as React from "react"
import useSWR from "swr"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowDownIcon,
  CalendarIcon,
  CircleIcon,
  Loader2Icon,
  MapPinIcon,
  MinusIcon,
  PlusIcon,
  SearchIcon,
  UsersIcon,
} from "lucide-react"

import { fetcher } from "@/lib/api"
import type { AirportWithCoords } from "@/lib/airports"
import { resolveAirportLocation } from "@/lib/airports"
import {
  useBookingStore,
  VEHICLE_TYPES,
  type BookingLocation,
  type VehicleQuote,
} from "@/lib/store/booking-store"
import type { Direction, VehicleType } from "@/lib/types"
import {
  isPickupTooSoon,
  pickupLeadTimeMessage,
} from "@/lib/pickup-lead-time"
import { autoSelectVehiclePatch } from "@/lib/vehicles"
import { cn } from "@/lib/utils"
import {
  matchZoneId,
  type ServiceZonePlace,
} from "@/components/booking/zone-place-select"
import {
  formatHeroDateLabel,
  HeroDateTimePicker,
} from "@/components/marketing/hero-datetime-picker"
import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from "@/components/ui/combobox"

type BookingConfig = {
  airports: AirportWithCoords[]
  zones: ServiceZonePlace[]
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
  pickupLat: number
  pickupLng: number
  dropoffLat: number
  dropoffLng: number
}) {
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
  return data as {
    vehicleType: VehicleType
    price: number
    distanceKm: number
    durationMin: number
  }
}

function Stepper({
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

type FieldOption = { value: string; label: string }

function FieldSelect({
  value,
  placeholder,
  options,
  onChange,
  anchor,
}: {
  value: string | null
  placeholder: string
  options: FieldOption[]
  onChange: (value: string) => void
  /** Full-width row/card element — popup matches its width and sits under it. */
  anchor: React.RefObject<HTMLElement | null>
}) {
  const selected =
    value != null
      ? (options.find((opt) => opt.value === value) ?? null)
      : null

  return (
    <Combobox
      items={options}
      value={selected}
      onValueChange={(item: FieldOption | null) => {
        if (item) onChange(item.value)
      }}
      itemToStringLabel={(item: FieldOption) => item.label}
      isItemEqualToValue={(a: FieldOption, b: FieldOption) =>
        a.value === b.value
      }
      autoHighlight
    >
      <ComboboxInput
        placeholder={placeholder}
        showTrigger
        className={cn(
          "h-auto w-full min-w-0 border-0 bg-transparent shadow-none",
          "has-[[data-slot=input-group-control]:focus-visible]:border-transparent",
          "has-[[data-slot=input-group-control]:focus-visible]:ring-0",
          "[&_[data-slot=input-group-control]]:h-auto",
          "[&_[data-slot=input-group-control]]:border-0",
          "[&_[data-slot=input-group-control]]:bg-transparent",
          "[&_[data-slot=input-group-control]]:px-0",
          "[&_[data-slot=input-group-control]]:py-0",
          "[&_[data-slot=input-group-control]]:text-base md:[&_[data-slot=input-group-control]]:text-sm",
          "[&_[data-slot=input-group-control]]:font-bold",
          "[&_[data-slot=input-group-control]]:text-[color:var(--brand-ink)]",
          "[&_[data-slot=input-group-control]]:shadow-none",
          "[&_[data-slot=input-group-control]]:placeholder:font-semibold",
          "[&_[data-slot=input-group-control]]:placeholder:text-muted-foreground",
          "[&_[data-slot=input-group-control]]:focus-visible:ring-0",
          "[&_[data-slot=input-group-addon]]:pr-0",
          "[&_[data-slot=combobox-trigger]_svg]:text-muted-foreground",
        )}
      />
      <ComboboxContent
        side="bottom"
        align="start"
        sideOffset={6}
        anchor={anchor}
        className="w-(--anchor-width) min-w-(--anchor-width) max-w-none rounded-xl bg-white p-0 text-[color:var(--brand-ink)] shadow-[0_16px_40px_rgba(15,23,42,0.16)] ring-1 ring-black/8 *:data-[slot=input-group]:hidden"
      >
        <div className="border-b border-border/70 px-3 py-2.5">
          <p className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            <SearchIcon className="size-3.5" />
            Type to search
          </p>
        </div>
        <ComboboxEmpty className="flex-col items-center gap-1.5 px-4 py-6">
          <SearchIcon className="size-5 opacity-50" />
          No matching places
        </ComboboxEmpty>
        <ComboboxList className="max-h-64 p-1.5">
          {(item: FieldOption) => (
            <ComboboxItem
              key={item.value}
              value={item}
              className="gap-2.5 rounded-lg px-2.5 py-2.5 text-sm font-semibold text-[color:var(--brand-ink)] data-highlighted:bg-[color-mix(in_srgb,var(--brand-accent)_14%,white)] data-highlighted:text-[color:var(--brand-ink)] not-data-[variant=destructive]:data-highlighted:**:text-[color:var(--brand-ink)]"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--brand-accent)_12%,white)] text-brand-accent">
                <MapPinIcon className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1 whitespace-normal">
                {item.label}
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

export function HeroBookingCard() {
  const direction = useBookingStore((s) => s.direction)
  const selectedAirportIata = useBookingStore((s) => s.selectedAirportIata)
  const pickup = useBookingStore((s) => s.pickup)
  const dropoff = useBookingStore((s) => s.dropoff)
  const pickupDateTime = useBookingStore((s) => s.pickupDateTime)
  const isRoundTrip = useBookingStore((s) => s.isRoundTrip)
  const passengerCount = useBookingStore((s) => s.passengerCount)
  const luggageCount = useBookingStore((s) => s.luggageCount)
  const quoteStatus = useBookingStore((s) => s.quoteStatus)
  const quoteError = useBookingStore((s) => s.quoteError)
  const patch = useBookingStore((s) => s.patch)
  const clearQuotes = useBookingStore((s) => s.clearQuotes)
  const setStep = useBookingStore((s) => s.setStep)

  const router = useRouter()
  const [calendarOpen, setCalendarOpen] = React.useState(false)
  const [continuing, setContinuing] = React.useState(false)

  const { data: config } = useSWR<BookingConfig>("/api/booking/config", fetcher)
  const airports = config?.airports ?? []
  const zones = config?.zones ?? []

  const destinationLocation =
    direction === "dest_to_airport"
      ? { address: pickup.address, lat: pickup.lat, lng: pickup.lng }
      : { address: dropoff.address, lat: dropoff.lat, lng: dropoff.lng }
  const selectedZoneId = matchZoneId(zones, destinationLocation)

  const applyEndpoints = React.useCallback(
    (
      nextDirection: Direction,
      airport: AirportWithCoords | null,
      destination: BookingLocation | null,
    ) => {
      const airportLoc = airport ? airportLocation(airport) : emptyLocation()
      const destLoc = destination ?? emptyLocation()
      if (nextDirection === "airport_to_dest") {
        patch({
          direction: nextDirection,
          selectedAirportIata: airport?.iataCode ?? null,
          pickup: airportLoc,
          dropoff: destLoc,
        })
      } else {
        patch({
          direction: nextDirection,
          selectedAirportIata: airport?.iataCode ?? null,
          pickup: destLoc,
          dropoff: airportLoc,
        })
      }
    },
    [patch],
  )

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, airports.length])

  const loadQuotes = React.useCallback(async () => {
    const state = useBookingStore.getState()
    const { direction: dir, pickup: from, dropoff: to } = state
    if (
      !dir ||
      from.lat == null ||
      from.lng == null ||
      to.lat == null ||
      to.lng == null
    ) {
      return false
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
      const results = await Promise.all(
        VEHICLE_TYPES.map((vehicleType) =>
          fetchVehicleQuote({
            direction: dir,
            vehicleType,
            pickupLat: from.lat!,
            pickupLng: from.lng!,
            dropoffLat: to.lat!,
            dropoffLng: to.lng!,
          }),
        ),
      )
      const vehicleQuotes = {} as Record<VehicleType, VehicleQuote>
      for (const result of results) {
        vehicleQuotes[result.vehicleType] = {
          price: result.price,
          distanceKm: result.distanceKm,
          durationMin: result.durationMin,
        }
      }
      patch({
        vehicleQuotes,
        quoteStatus: "success",
        quoteError: null,
        quotedDistanceKm: results[0]?.distanceKm ?? null,
      })
      return true
    } catch (err) {
      const error = err as Error & { code?: string; status?: number }
      if (error.status === 404 || error.code === "OUTSIDE_SERVICE_AREA") {
        patch({
          vehicleQuotes: {},
          quoteStatus: "uncovered",
          quoteError: null,
          quotedPrice: null,
          vehicleType: null,
        })
        return false
      }
      patch({
        vehicleQuotes: {},
        quoteStatus: "error",
        quoteError: error.message || "Could not load prices.",
        quotedPrice: null,
        vehicleType: null,
      })
      return false
    }
  }, [patch])

  React.useEffect(() => {
    if (
      !direction ||
      pickup.lat == null ||
      dropoff.lat == null ||
      !pickup.address ||
      !dropoff.address
    ) {
      return
    }
    void loadQuotes()
  }, [
    direction,
    pickup.lat,
    pickup.lng,
    pickup.address,
    dropoff.lat,
    dropoff.lng,
    dropoff.address,
    loadQuotes,
  ])

  function setRoundTrip(enabled: boolean) {
    patch({
      isRoundTrip: enabled,
      returnDateTime: enabled
        ? useBookingStore.getState().returnDateTime
        : null,
    })
  }

  function setDirection(next: Direction) {
    const airport = resolveAirportLocation(airports, selectedAirportIata)
    const dest: BookingLocation =
      direction === "dest_to_airport"
        ? { address: pickup.address, lat: pickup.lat, lng: pickup.lng }
        : { address: dropoff.address, lat: dropoff.lat, lng: dropoff.lng }
    clearQuotes()
    applyEndpoints(next, airport, dest)
  }

  function onZonePicked(zoneId: string) {
    const zone = zones.find((z) => z.id === zoneId)
    if (!zone) return
    const airport = resolveAirportLocation(airports, selectedAirportIata)
    applyEndpoints(direction ?? "airport_to_dest", airport, {
      address: zone.name,
      lat: zone.lat,
      lng: zone.lng,
    })
  }

  function onAirportPicked(iata: string) {
    const airport = resolveAirportLocation(airports, iata)
    if (!airport) return
    const dest: BookingLocation =
      direction === "dest_to_airport"
        ? { address: pickup.address, lat: pickup.lat, lng: pickup.lng }
        : { address: dropoff.address, lat: dropoff.lat, lng: dropoff.lng }
    clearQuotes()
    applyEndpoints(direction ?? "airport_to_dest", airport, dest)
  }

  async function onContinue() {
    if (continuing) return

    const state = useBookingStore.getState()
    const hasZone = Boolean(
      state.direction === "dest_to_airport"
        ? state.pickup.lat != null && state.pickup.address
        : state.dropoff.lat != null && state.dropoff.address,
    )
    const hasAirport = Boolean(state.selectedAirportIata)
    const hasTime = Boolean(state.pickupDateTime)

    if (!hasAirport) {
      toast.error("Select an airport.")
      return
    }
    if (!hasZone) {
      toast.error("Select a destination.")
      return
    }
    if (!hasTime) {
      toast.error("Add a pickup date and time.")
      setCalendarOpen(true)
      return
    }
    if (isPickupTooSoon(state.pickupDateTime)) {
      toast.error(pickupLeadTimeMessage())
      setCalendarOpen(true)
      return
    }

    setContinuing(true)
    try {
      let latest = useBookingStore.getState()
      if (latest.quoteStatus !== "success") {
        const quoted = await loadQuotes()
        if (!quoted) {
          latest = useBookingStore.getState()
          if (latest.quoteStatus === "uncovered") {
            toast.error("That destination isn't covered yet.")
          } else {
            toast.error(
              latest.quoteError ||
              "Could not get prices for this route. Try again.",
            )
          }
          return
        }
        latest = useBookingStore.getState()
      }

      // Auto-pick vehicle from passengers + luggage, then continue to booking details.
      patch({
        ...autoSelectVehiclePatch(
          latest.passengerCount,
          latest.luggageCount,
          latest.vehicleQuotes,
          latest.isRoundTrip,
        ),
        startedFromHero: true,
      })
      setStep(1)
      router.push("/book")
    } finally {
      setContinuing(false)
    }
  }

  const fromIsAirport = direction !== "dest_to_airport"
  const airportOptions = airports.map((a) => ({
    value: a.iataCode,
    label: `${a.name} (${a.iataCode})`,
  }))
  const zoneOptions = zones.map((z) => ({
    value: z.id,
    label: z.name,
  }))

  const busy = continuing || quoteStatus === "loading"
  const fromRowAnchor = useComboboxAnchor()
  const toRowAnchor = useComboboxAnchor()

  return (
    <div className="relative z-20 w-full rounded-2xl bg-brand-surface text-brand shadow-[0_20px_50px_rgba(0,0,0,0.28)]">
      <div className="p-5 sm:p-6 pb-4 sm:pb-5">
        <div className="grid grid-cols-2 rounded-full bg-muted p-1">
          <button
            type="button"
            onClick={() => setRoundTrip(false)}
            className={cn(
              "rounded-full py-2.5 text-sm font-bold transition-all",
              !isRoundTrip
                ? "bg-brand-surface text-brand shadow-sm"
                : "text-muted-foreground hover:text-brand",
            )}
          >
            One Way
          </button>
          <button
            type="button"
            onClick={() => setRoundTrip(true)}
            className={cn(
              "rounded-full py-2.5 text-sm font-bold transition-all",
              isRoundTrip
                ? "bg-brand-surface text-brand shadow-sm"
                : "text-muted-foreground hover:text-brand",
            )}
          >
            Return
          </button>
        </div>

        <div className="relative mt-4 rounded-xl border border-border">
          <div
            ref={fromRowAnchor}
            className="relative z-10 flex items-center gap-3 border-b border-border px-3 py-3.5"
          >
            <CircleIcon className="size-4 shrink-0 fill-none stroke-muted-foreground stroke-[2.5]" />
            <div className="min-w-0 flex-1">
              {fromIsAirport ? (
                <FieldSelect
                  value={selectedAirportIata}
                  placeholder="From (airport, port, address)"
                  options={airportOptions}
                  onChange={onAirportPicked}
                  anchor={fromRowAnchor}
                />
              ) : (
                <FieldSelect
                  value={selectedZoneId}
                  placeholder="From (airport, port, address)"
                  options={zoneOptions}
                  onChange={onZonePicked}
                  anchor={fromRowAnchor}
                />
              )}
            </div>
            <button
              type="button"
              className="shrink-0 text-[11px] font-semibold text-muted-foreground hover:text-brand uppercase"
              onClick={() =>
                setDirection(
                  fromIsAirport ? "dest_to_airport" : "airport_to_dest",
                )
              }
            >
              Swap
            </button>
          </div>

          <div
            ref={toRowAnchor}
            className="relative z-10 flex items-center gap-3 border-b border-border px-3 py-3.5"
          >
            <MapPinIcon className="size-4 shrink-0 text-brand" />
            <div className="min-w-0 flex-1">
              {fromIsAirport ? (
                <FieldSelect
                  value={selectedZoneId}
                  placeholder="To (airport, port, address)"
                  options={zoneOptions}
                  onChange={onZonePicked}
                  anchor={toRowAnchor}
                />
              ) : (
                <FieldSelect
                  value={selectedAirportIata}
                  placeholder="To (airport, port, address)"
                  options={airportOptions}
                  onChange={onAirportPicked}
                  anchor={toRowAnchor}
                />
              )}
            </div>
          </div>

          <HeroDateTimePicker
            value={pickupDateTime}
            open={calendarOpen}
            onOpenChange={setCalendarOpen}
            onChange={(iso) => patch({ pickupDateTime: iso })}
            trigger={
              <button
                type="button"
                onClick={() => setCalendarOpen(true)}
                className={cn(
                  "relative z-10 flex w-full items-center gap-3 rounded-b-xl px-3 py-3.5 text-left transition-colors hover:bg-muted",
                  calendarOpen && "ring-2 ring-inset ring-black",
                )}
              >
                <CalendarIcon className="size-4 shrink-0 text-brand" />
                <span
                  className={cn(
                    "text-sm font-bold",
                    pickupDateTime ? "text-brand" : "text-muted-foreground",
                  )}
                >
                  {formatHeroDateLabel(pickupDateTime)}
                </span>
              </button>
            }
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <Stepper
            label="Passengers"
            value={passengerCount}
            min={1}
            max={8}
            onChange={(n) => patch({ passengerCount: n })}
          />
          <Stepper
            label="Luggage pieces"
            value={luggageCount}
            min={0}
            max={10}
            onChange={(n) => patch({ luggageCount: n })}
          />
        </div>

        {quoteStatus === "uncovered" && (
          <p className="mt-3 text-xs text-amber-700 text-center font-medium">
            That destination isn&apos;t covered yet.
          </p>
        )}
        {quoteStatus === "error" && (
          <p className="mt-3 text-xs text-red-600 text-center font-medium">
            {quoteError || "Could not load prices."}
          </p>
        )}

        <Button
          type="button"
          size="lg"
          className="mt-5 h-12 w-full rounded-xl bg-brand-accent text-base font-extrabold text-white hover:bg-brand-accent-hover transition-all shadow-sm"
          disabled={busy}
          onClick={() => void onContinue()}
        >
          {busy ? (
            <>
              <Loader2Icon className="animate-spin" data-icon="inline-start" />
              {quoteStatus === "loading" ? "Getting prices…" : "Continue…"}
            </>
          ) : (
            "Continue"
          )}
        </Button>
      </div>

      <div className="mt-1 flex items-center gap-3 rounded-b-2xl bg-brand-surface px-5 py-4 text-[13px] leading-tight text-muted-foreground sm:px-6">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-surface shadow-sm">
          <UsersIcon className="size-4 text-muted-foreground" />
        </div>
        <span>
          <span className="font-semibold text-brand">24561</span> travelers in 348 destinations booked a ride today
        </span>
      </div>
    </div>
  )
}
