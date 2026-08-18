"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import useSWR from "swr"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowDownIcon,
  BriefcaseIcon,
  CalendarIcon,
  CircleIcon,
  Loader2Icon,
  MapPinIcon,
  MinusIcon,
  PlusIcon,
  UsersIcon,
} from "lucide-react"

import {
  markMarketingPreloaderHandoff,
  MarketingPreloaderMark,
} from "@/components/marketing/marketing-preloader"

import { fetcher } from "@/lib/api"
import type { AirportWithCoords } from "@/lib/airports"
import { resolveAirportLocation } from "@/lib/airports"
import { resolveZoneFromDestinationParam } from "@/lib/booking-destination-param"
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
import { usePartyCapacityLimits } from "@/hooks/use-party-capacity-limits"
import { localePath } from "@/lib/i18n/locales"
import { useLocale, useT } from "@/lib/i18n/use-locale"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import { useBodyScrollLock, forceUnlockDocumentScroll } from "@/hooks/use-body-scroll-lock"
import {
  matchZoneId,
  type ServiceZonePlace,
} from "@/components/booking/zone-place-select"
import {
  formatHeroDateLabel,
  HeroDateTimePicker,
} from "@/components/marketing/hero-datetime-picker"
import { HeroFieldSelect } from "@/components/marketing/hero-field-select"
import { Button } from "@/components/ui/button"
import { useComboboxAnchor } from "@/components/ui/combobox"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

type BookingConfig = {
  airports: AirportWithCoords[]
  zones: ServiceZonePlace[]
  vehicleCapacities?: import("@/lib/vehicles").VehicleCapacityConfig
  enabledVehicleTypes?: VehicleType[]
  sedanEnabled?: boolean
  minivanEnabled?: boolean
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

/** Full-viewport branded cover — portaled above sheet open/close animations. */
function HeroStepReloader() {
  // Portal immediately (no useEffect mount gate) so the cover is present on
  // the same paint as the sheet swap — otherwise the hero flashes for a frame.
  if (typeof document === "undefined") return null

  return createPortal(
    <MarketingPreloaderMark
      className="z-[9999] h-[100dvh] w-screen"
      style={{
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        width: "100vw",
        height: "100dvh",
      }}
    />,
    document.body,
  )
}

async function fetchVehicleQuote(body: {
  direction: Direction
  vehicleType: VehicleType
  zoneId: string
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

export function HeroBookingCard() {
  const direction = useBookingStore((s) => s.direction)
  const selectedAirportIata = useBookingStore((s) => s.selectedAirportIata)
  const selectedZoneIdFromStore = useBookingStore((s) => s.selectedZoneId)
  const pickup = useBookingStore((s) => s.pickup)
  const dropoff = useBookingStore((s) => s.dropoff)
  const pickupDateTime = useBookingStore((s) => s.pickupDateTime)
  const isRoundTrip = useBookingStore((s) => s.isRoundTrip)
  const returnDateTime = useBookingStore((s) => s.returnDateTime)
  const passengerCount = useBookingStore((s) => s.passengerCount)
  const luggageCount = useBookingStore((s) => s.luggageCount)
  const quoteStatus = useBookingStore((s) => s.quoteStatus)
  const quoteError = useBookingStore((s) => s.quoteError)
  const patch = useBookingStore((s) => s.patch)
  const clearQuotes = useBookingStore((s) => s.clearQuotes)
  const setStep = useBookingStore((s) => s.setStep)

  const router = useRouter()
  const searchParams = useSearchParams()
  const locale = useLocale()
  const tr = useT()
  const [calendarOpen, setCalendarOpen] = React.useState(false)
  const [returnCalendarOpen, setReturnCalendarOpen] = React.useState(false)
  const [destinationOpen, setDestinationOpen] = React.useState(false)
  const [passengersOpen, setPassengersOpen] = React.useState(false)
  const [continuing, setContinuing] = React.useState(false)
  const [stepReloading, setStepReloading] = React.useState(false)
  const appliedDestinationParam = React.useRef<string | null>(null)

  const { data: config } = useSWR<BookingConfig>("/api/booking/config", fetcher)
  const airports = config?.airports ?? []
  const zones = config?.zones ?? []
  const { maxPassengers, maxLuggage, capacities, enabledTypes } =
    usePartyCapacityLimits()

  const destinationLocation =
    direction === "dest_to_airport"
      ? { address: pickup.address }
      : { address: dropoff.address }
  const selectedZoneId = matchZoneId(
    zones,
    destinationLocation,
    selectedZoneIdFromStore,
  )

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

  // Deep-link: /?destination=sarande#book (also accepts zone name / transfer slug)
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
      return false
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
        quotedPrice: null,
        vehicleType: null,
      })
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
        // Missing rule / disabled vehicle — skip; zone may still be covered.
        continue
      }
      networkError = err.message || "Could not load prices."
    }

    const quoted = Object.values(vehicleQuotes)
    if (quoted.length > 0) {
      patch({
        vehicleQuotes,
        quoteStatus: "success",
        quoteError: null,
        quotedDistanceKm: quoted[0]?.distanceKm ?? null,
      })
      return true
    }

    if (networkError) {
      patch({
        vehicleQuotes: {},
        quoteStatus: "error",
        quoteError: networkError,
        quotedPrice: null,
        vehicleType: null,
      })
      return false
    }

    patch({
      vehicleQuotes: {},
      quoteStatus: "uncovered",
      quoteError: null,
      quotedPrice: null,
      vehicleType: null,
    })
    return false
  }, [
    patch,
    config?.enabledVehicleTypes,
    config?.sedanEnabled,
    config?.minivanEnabled,
  ])

  React.useEffect(() => {
    if (!direction || !selectedZoneId) {
      return
    }
    void loadQuotes()
  }, [direction, selectedZoneId, loadQuotes])

  function setRoundTrip(enabled: boolean) {
    patch({
      isRoundTrip: enabled,
      returnDateTime: enabled
        ? useBookingStore.getState().returnDateTime
        : null,
    })
    if (!enabled) setReturnCalendarOpen(false)
  }

  function setDirection(next: Direction) {
    const airport = resolveAirportLocation(airports, selectedAirportIata)
    const dest: BookingLocation =
      direction === "dest_to_airport"
        ? { address: pickup.address, lat: pickup.lat, lng: pickup.lng }
        : { address: dropoff.address, lat: dropoff.lat, lng: dropoff.lng }
    clearQuotes()
    applyEndpoints(next, airport, dest, selectedZoneId)
  }

  function onZonePicked(zoneId: string) {
    const zone = zones.find((z) => z.id === zoneId)
    if (!zone) return
    const airport = resolveAirportLocation(airports, selectedAirportIata)
    // Placeholder coords (airport) keep booking payload valid; price uses zoneId.
    applyEndpoints(
      direction ?? "airport_to_dest",
      airport,
      {
        address: zone.name,
        lat: airport?.lat ?? 0,
        lng: airport?.lng ?? 0,
      },
      zoneId,
    )
  }

  function onAirportPicked(iata: string) {
    const airport = resolveAirportLocation(airports, iata)
    if (!airport) return
    const dest: BookingLocation =
      direction === "dest_to_airport"
        ? { address: pickup.address, lat: pickup.lat, lng: pickup.lng }
        : { address: dropoff.address, lat: dropoff.lat, lng: dropoff.lng }
    clearQuotes()
    applyEndpoints(direction ?? "airport_to_dest", airport, dest, selectedZoneId)
  }

  async function onContinue(opts?: { fromPassengersSheet?: boolean }) {
    if (continuing) return

    const state = useBookingStore.getState()
    const hasZone = Boolean(state.selectedZoneId)
    const hasAirport = Boolean(state.selectedAirportIata)
    const hasTime = Boolean(state.pickupDateTime)

    if (!hasAirport) {
      toast.error(tr("book.selectAirport"))
      return
    }
    if (!hasZone) {
      toast.error(tr("book.selectDestination"))
      return
    }
    if (!hasTime) {
      toast.error(tr("book.addPickupRequired"))
      if (opts?.fromPassengersSheet) setPassengersOpen(false)
      setCalendarOpen(true)
      return
    }
    if (isPickupTooSoon(state.pickupDateTime)) {
      toast.error(pickupLeadTimeMessage())
      if (opts?.fromPassengersSheet) setPassengersOpen(false)
      setCalendarOpen(true)
      return
    }
    if (state.isRoundTrip) {
      if (!state.returnDateTime) {
        toast.error(tr("book.addReturnRequired"))
        if (opts?.fromPassengersSheet) setPassengersOpen(false)
        setReturnCalendarOpen(true)
        return
      }
      const pickupMs = new Date(state.pickupDateTime!).getTime()
      const returnMs = new Date(state.returnDateTime).getTime()
      if (Number.isNaN(returnMs) || returnMs <= pickupMs) {
        toast.error(tr("book.returnAfterPickup"))
        if (opts?.fromPassengersSheet) setPassengersOpen(false)
        setReturnCalendarOpen(true)
        return
      }
    }

    setContinuing(true)
    if (opts?.fromPassengersSheet) setPassengersOpen(false)
    try {
      let latest = useBookingStore.getState()
      if (latest.quoteStatus !== "success") {
        const quoted = await loadQuotes()
        if (!quoted) {
          latest = useBookingStore.getState()
          if (latest.quoteStatus === "uncovered") {
            toast.error(tr("book.notCovered"))
          } else {
            toast.error(
              latest.quoteError || tr("book.quoteRetry"),
            )
          }
          setContinuing(false)
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
          0,
          capacities,
          enabledTypes,
        ),
        startedFromHero: true,
      })
      setStep(1)
      // One branded cover through the handoff; skip /book layout preloader.
      markMarketingPreloaderHandoff()
      // Clear sheet/Base UI body locks before route change — otherwise /book
      // can inherit position:fixed / overflow:hidden and refuse to scroll.
      forceUnlockDocumentScroll({ scrollTop: 0 })
      router.push(localePath("/book", locale))
      // Leave continuing on so the cover stays until this tree unmounts.
    } catch {
      setContinuing(false)
    }
  }

  const fromIsAirport = direction !== "dest_to_airport"
  const airportOptions = airports.map((a) => ({
    value: a.iataCode,
    label: `${a.name} (${a.iataCode})`,
  }))
  const selectedAirportLabel =
    airportOptions.find((o) => o.value === selectedAirportIata)?.label ??
    (airports[0] ? `${airports[0].name} (${airports[0].iataCode})` : null)
  const singleAirportOnly = airports.length <= 1
  const zoneOptions = zones.map((z) => ({
    value: z.id,
    label: z.name,
  }))

  const busy = continuing || quoteStatus === "loading"
  const showReloader = continuing || stepReloading
  const fromRowAnchor = useComboboxAnchor()
  const toRowAnchor = useComboboxAnchor()
  const isMobile = useIsMobile()
  // Only lock while the passengers sheet is open — do NOT lock for the
  // continue/reloader cover. That cover is position:fixed itself, and locking
  // through navigation left body scroll broken on /book (especially iOS).
  useBodyScrollLock(Boolean(isMobile && passengersOpen))

  async function runSheetTransition(openNext: () => void) {
    if (!isMobile) {
      openNext()
      return
    }
    setStepReloading(true)
    // Wait two frames so the cover paints before sheets swap underneath.
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
    openNext()
    // Keep covering until the next sheet has finished opening.
    await new Promise((resolve) => setTimeout(resolve, 320))
    setStepReloading(false)
  }

  function openCalendarAfterDestination() {
    void runSheetTransition(() => {
      setDestinationOpen(false)
      setCalendarOpen(true)
    })
  }

  function openPassengersAfterCalendar() {
    void runSheetTransition(() => {
      setCalendarOpen(false)
      setReturnCalendarOpen(false)
      setPassengersOpen(true)
    })
  }

  function openReturnOrPassengersAfterPickup() {
    if (useBookingStore.getState().isRoundTrip) {
      void runSheetTransition(() => {
        setCalendarOpen(false)
        setReturnCalendarOpen(true)
      })
      return
    }
    openPassengersAfterCalendar()
  }

  /** Prefer destination first — don't open date/time until an address is chosen. */
  function requestPickupCalendar(open: boolean) {
    if (open && !selectedZoneId) {
      setCalendarOpen(false)
      setDestinationOpen(true)
      return
    }
    setCalendarOpen(open)
  }

  function requestReturnCalendar(open: boolean) {
    if (open && !selectedZoneId) {
      setReturnCalendarOpen(false)
      setDestinationOpen(true)
      return
    }
    setReturnCalendarOpen(open)
  }

  function onPickupDateChange(iso: string) {
    const currentReturn = useBookingStore.getState().returnDateTime
    const returnTooSoon =
      currentReturn != null &&
      new Date(currentReturn).getTime() <= new Date(iso).getTime()
    patch({
      pickupDateTime: iso,
      ...(returnTooSoon ? { returnDateTime: null } : {}),
    })
  }

  React.useEffect(() => {
    router.prefetch(localePath("/book", locale))
  }, [router, locale])

  const passengersLabel =
    passengerCount === 1
      ? tr("book.passengersSummary", {
          count: passengerCount,
          luggage: luggageCount,
        })
      : tr("book.passengersSummaryPlural", {
          count: passengerCount,
          luggage: luggageCount,
        })

  return (
    <div className="relative z-20 w-full rounded-2xl bg-brand-surface text-brand shadow-[0_20px_50px_rgba(0,0,0,0.28)]">
      {showReloader ? <HeroStepReloader /> : null}
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
            {tr("book.oneWay")}
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
            {tr("book.return")}
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
                singleAirportOnly ? (
                  <p className="truncate text-sm font-bold text-brand">
                    {selectedAirportLabel ?? "Tirana International (TIA)"}
                  </p>
                ) : (
                  <HeroFieldSelect
                    value={selectedAirportIata}
                    placeholder={tr("book.fromPlaceholder")}
                    options={airportOptions}
                    onChange={onAirportPicked}
                    anchor={fromRowAnchor}
                  />
                )
              ) : (
                <HeroFieldSelect
                  value={selectedZoneId}
                  placeholder={tr("book.fromPlaceholder")}
                  options={zoneOptions}
                  onChange={onZonePicked}
                  anchor={fromRowAnchor}
                  mobileSheet
                  sheetTitle={tr("book.chooseDestination")}
                  open={destinationOpen}
                  onOpenChange={setDestinationOpen}
                  onAfterSelect={openCalendarAfterDestination}
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
              {tr("book.swap")}
            </button>
          </div>

          <div
            ref={toRowAnchor}
            className="relative z-10 flex items-center gap-3 border-b border-border px-3 py-3.5"
          >
            <MapPinIcon className="size-4 shrink-0 text-brand" />
            <div className="min-w-0 flex-1">
              {fromIsAirport ? (
                <HeroFieldSelect
                  value={selectedZoneId}
                  placeholder={tr("book.toPlaceholder")}
                  options={zoneOptions}
                  onChange={onZonePicked}
                  anchor={toRowAnchor}
                  mobileSheet
                  sheetTitle={tr("book.chooseDestination")}
                  open={destinationOpen}
                  onOpenChange={setDestinationOpen}
                  onAfterSelect={openCalendarAfterDestination}
                />
              ) : singleAirportOnly ? (
                <p className="truncate text-sm font-bold text-brand">
                  {selectedAirportLabel ?? "Tirana International (TIA)"}
                </p>
              ) : (
                <HeroFieldSelect
                  value={selectedAirportIata}
                  placeholder={tr("book.toPlaceholder")}
                  options={airportOptions}
                  onChange={onAirportPicked}
                  anchor={toRowAnchor}
                  mobileSheet
                  sheetTitle={tr("book.chooseDestination")}
                  onAfterSelect={openCalendarAfterDestination}
                />
              )}
            </div>
          </div>

          <HeroDateTimePicker
            value={pickupDateTime}
            open={calendarOpen}
            onOpenChange={requestPickupCalendar}
            onChange={onPickupDateChange}
            onAfterConfirm={openReturnOrPassengersAfterPickup}
            trigger={
              <button
                type="button"
                onClick={() => requestPickupCalendar(true)}
                className={cn(
                  "relative z-10 flex w-full items-center gap-3 px-3 py-3.5 text-left transition-colors hover:bg-muted",
                  isRoundTrip ? "border-b border-border" : "rounded-b-xl",
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
                  {pickupDateTime
                    ? formatHeroDateLabel(pickupDateTime)
                    : tr("book.addPickup")}
                </span>
              </button>
            }
          />

          {isRoundTrip ? (
            <HeroDateTimePicker
              value={returnDateTime}
              open={returnCalendarOpen}
              onOpenChange={requestReturnCalendar}
              onChange={(iso) => patch({ returnDateTime: iso })}
              onAfterConfirm={openPassengersAfterCalendar}
              minDate={
                pickupDateTime ? new Date(pickupDateTime) : new Date()
              }
              trigger={
                <button
                  type="button"
                  onClick={() => requestReturnCalendar(true)}
                  className={cn(
                    "relative z-10 flex w-full items-center gap-3 rounded-b-xl px-3 py-3.5 text-left transition-colors hover:bg-muted",
                    returnCalendarOpen && "ring-2 ring-inset ring-black",
                  )}
                >
                  <CalendarIcon className="size-4 shrink-0 text-brand" />
                  <span
                    className={cn(
                      "text-sm font-bold",
                      returnDateTime ? "text-brand" : "text-muted-foreground",
                    )}
                  >
                    {returnDateTime
                      ? formatHeroDateLabel(returnDateTime)
                      : tr("book.addReturn")}
                  </span>
                </button>
              }
            />
          ) : null}
        </div>

        {isMobile ? (
          <>
            <button
              type="button"
              onClick={() => setPassengersOpen(true)}
              className={cn(
                "mt-4 flex w-full items-center gap-3 rounded-xl border border-border px-3 py-3.5 text-left touch-manipulation transition-colors hover:bg-muted",
                passengersOpen && "ring-2 ring-inset ring-black",
              )}
            >
              <UsersIcon className="size-4 shrink-0 text-brand" />
              <span className="min-w-0 flex-1 text-base font-bold text-[color:var(--brand-ink)]">
                {passengersLabel}
              </span>
              <BriefcaseIcon className="size-4 shrink-0 text-muted-foreground" />
            </button>

            <Sheet
              open={passengersOpen}
              onOpenChange={(open) => {
                if (continuing) return
                setPassengersOpen(open)
              }}
            >
              <SheetContent
                side="bottom"
                showCloseButton={!continuing}
                className="flex h-[100dvh] max-h-[100dvh] flex-col gap-0 rounded-none border-0 bg-brand-surface p-0 text-[color:var(--brand-ink)] data-[side=bottom]:h-[100dvh]"
              >
                <SheetHeader className="shrink-0 border-b border-border px-4 py-3 pr-14">
                  <SheetTitle className="text-base font-bold text-brand">
                    {tr("book.passengersLuggage")}
                  </SheetTitle>
                </SheetHeader>

                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
                    <div className="flex flex-col gap-5">
                      <Stepper
                        label={tr("book.passengers")}
                        value={passengerCount}
                        min={1}
                        max={maxPassengers}
                        onChange={(n) => patch({ passengerCount: n })}
                      />
                      <Stepper
                        label={tr("book.luggage")}
                        value={luggageCount}
                        min={0}
                        max={maxLuggage}
                        onChange={(n) => patch({ luggageCount: n })}
                      />
                    </div>
                  </div>

                  <div className="shrink-0 border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                    <Button
                      type="button"
                      size="lg"
                      className="h-12 w-full rounded-xl bg-brand-accent text-base font-extrabold text-white hover:bg-brand-accent-hover"
                      disabled={busy}
                      onClick={() => void onContinue({ fromPassengersSheet: true })}
                    >
                      {busy ? (
                        <>
                          <Loader2Icon
                            className="animate-spin"
                            data-icon="inline-start"
                          />
                          {tr("book.continueEllipsis")}
                        </>
                      ) : (
                        tr("book.confirm")
                      )}
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-4">
            <Stepper
              label={tr("book.passengers")}
              value={passengerCount}
              min={1}
              max={maxPassengers}
              onChange={(n) => patch({ passengerCount: n })}
            />
            <Stepper
              label={tr("book.luggage")}
              value={luggageCount}
              min={0}
              max={maxLuggage}
              onChange={(n) => patch({ luggageCount: n })}
            />
          </div>
        )}

        {quoteStatus === "uncovered" && (
          <p className="mt-3 text-xs text-amber-700 text-center font-medium">
            {tr("book.notCovered")}
          </p>
        )}
        {quoteStatus === "error" && (
          <p className="mt-3 text-xs text-red-600 text-center font-medium">
            {quoteError || tr("book.couldNotLoadPrices")}
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
              {quoteStatus === "loading"
                ? tr("book.gettingPrices")
                : tr("book.continueEllipsis")}
            </>
          ) : (
            tr("book.continue")
          )}
        </Button>
      </div>

      <div className="mt-1 flex items-center gap-3 rounded-b-2xl bg-brand-surface px-5 py-4 text-[13px] leading-tight text-muted-foreground sm:px-6">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-surface shadow-sm">
          <UsersIcon className="size-4 text-muted-foreground" />
        </div>
        <span>
          {tr("book.fixedPrices")}
        </span>
      </div>
    </div>
  )
}
