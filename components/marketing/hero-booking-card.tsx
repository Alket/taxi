"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import useSWR from "swr"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowRightIcon,
  ArrowUpDownIcon,
  BriefcaseIcon,
  CalendarIcon,
  CircleIcon,
  Loader2Icon,
  MapPinIcon,
  MinusIcon,
  PlusIcon,
  ShieldCheckIcon,
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
  airportPlaceKey,
  buildCorridorNeighborMap,
  buildPlaceOptions,
  deriveRouteFromPlaces,
  filterPlacesForOppositeEnd,
  placeKeyFromStore,
  zonePlaceKey,
  type BookingPlaceOption,
  type CityCorridorPair,
} from "@/lib/booking-places"
import {
  useBookingStore,
  VEHICLE_TYPES,
  type BookingLocation,
  type BookingState,
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
import type { ServiceZonePlace } from "@/components/booking/zone-place-select"
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
  cityCorridors?: CityCorridorPair[]
  vehicleCapacities?: import("@/lib/vehicles").VehicleCapacityConfig
  enabledVehicleTypes?: VehicleType[]
  sedanEnabled?: boolean
  minivanEnabled?: boolean
}

function emptyLocation(): BookingLocation {
  return { address: "", lat: null, lng: null }
}

function placeLocation(place: BookingPlaceOption): BookingLocation {
  return { address: place.label, lat: place.lat, lng: place.lng }
}

/** One end picked, other end still empty — keep the store coherent meanwhile. */
function partialRoutePatch(
  place: BookingPlaceOption,
  end: "from" | "to",
): Partial<BookingState> {
  const loc = placeLocation(place)
  const isFrom = end === "from"
  return {
    // Airport at pickup implies airport_to_dest; airport at dropoff implies the
    // reverse. A lone zone gets the corridor direction it would take to an
    // airport until the other end resolves the real direction.
    direction:
      place.kind === "airport"
        ? isFrom
          ? "airport_to_dest"
          : "dest_to_airport"
        : isFrom
          ? "dest_to_airport"
          : "airport_to_dest",
    selectedAirportIata: place.kind === "airport" ? place.id : null,
    selectedZoneId: place.kind === "zone" ? place.id : null,
    selectedToZoneId: null,
    pickup: isFrom ? loc : emptyLocation(),
    dropoff: isFrom ? emptyLocation() : loc,
  }
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
  toZoneId?: string | null
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
    <div className="flex flex-1 flex-col gap-1.5">
      <span className="text-xs font-extrabold tracking-wider text-brand/80 uppercase">
        {label}
      </span>
      <div className="flex h-11 items-center justify-between rounded-xl border border-border/80 bg-brand-page/40 px-1">
        <button
          type="button"
          className="flex size-9 items-center justify-center rounded-lg text-brand transition-colors hover:bg-brand-surface hover:text-brand-accent active:scale-95 disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-brand"
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          aria-label={`Decrease ${label}`}
        >
          <MinusIcon className="size-4" />
        </button>
        <span className="min-w-6 text-center font-mono text-sm font-extrabold tabular-nums text-brand">
          {value}
        </span>
        <button
          type="button"
          className="flex size-9 items-center justify-center rounded-lg text-brand transition-colors hover:bg-brand-surface hover:text-brand-accent active:scale-95 disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-brand"
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
  const selectedZoneId = useBookingStore((s) => s.selectedZoneId)
  const selectedToZoneId = useBookingStore((s) => s.selectedToZoneId)
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
  const [fromOpen, setFromOpen] = React.useState(false)
  const [toOpen, setToOpen] = React.useState(false)
  const [passengersOpen, setPassengersOpen] = React.useState(false)
  const [continuing, setContinuing] = React.useState(false)
  const [stepReloading, setStepReloading] = React.useState(false)
  const appliedDestinationParam = React.useRef<string | null>(null)

  const { data: config } = useSWR<BookingConfig>("/api/booking/config", fetcher)
  const airports = config?.airports ?? []
  const zones = config?.zones ?? []
  const cityCorridors = config?.cityCorridors ?? []
  const vehicleType = useBookingStore((s) => s.vehicleType)
  const { maxPassengers, maxLuggage, capacities, enabledTypes } =
    usePartyCapacityLimits()

  const placeOptions = React.useMemo(
    () => buildPlaceOptions(airports, zones),
    [airports, zones],
  )

  // Hero usually has no vehicle yet → union of corridors; once selected, filter.
  const corridorNeighbors = React.useMemo(
    () => buildCorridorNeighborMap(cityCorridors, vehicleType),
    [cityCorridors, vehicleType],
  )

  // `placeKeyFromStore` needs a zone to resolve either end, so an airport that
  // is picked before any city is only recoverable from the direction.
  const airportKey = selectedAirportIata
    ? airportPlaceKey(selectedAirportIata)
    : null
  const fromKey =
    placeKeyFromStore({
      direction,
      selectedAirportIata,
      selectedZoneId,
      selectedToZoneId,
      end: "from",
    }) ??
    (!selectedZoneId && direction === "airport_to_dest" ? airportKey : null)
  const toKey =
    placeKeyFromStore({
      direction,
      selectedAirportIata,
      selectedZoneId,
      selectedToZoneId,
      end: "to",
    }) ??
    (!selectedZoneId && direction === "dest_to_airport" ? airportKey : null)

  const routeReady =
    direction === "zone_to_zone"
      ? Boolean(
          selectedZoneId &&
            selectedToZoneId &&
            selectedZoneId !== selectedToZoneId,
        )
      : Boolean(selectedZoneId && selectedAirportIata)

  const applyPlaces = React.useCallback(
    (from: BookingPlaceOption, to: BookingPlaceOption) => {
      const derived = deriveRouteFromPlaces(from, to, corridorNeighbors)
      if (!derived) return false
      clearQuotes()
      patch(derived)
      return true
    },
    [clearQuotes, patch, corridorNeighbors],
  )

  // Seed the pickup airport (Tirana if present) so the card opens the same way
  // it always has: From filled, To waiting for a city.
  React.useEffect(() => {
    if (!config || airports.length === 0) return
    if (selectedAirportIata || selectedZoneId) return
    const airport = resolveAirportLocation(airports, null)
    if (!airport) return
    const from = placeOptions.find(
      (p) => p.key === airportPlaceKey(airport.iataCode),
    )
    if (!from) return
    patch(partialRoutePatch(from, "from"))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once when airports arrive
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
    if (!airport) return
    const from = placeOptions.find(
      (p) => p.key === airportPlaceKey(airport.iataCode),
    )
    const to = placeOptions.find((p) => p.key === zonePlaceKey(zone.id))
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
    const {
      direction: dir,
      selectedZoneId: zoneId,
      selectedToZoneId: toZoneId,
    } = state
    if (!dir || !zoneId) {
      return false
    }
    if (dir === "zone_to_zone" && !toZoneId) {
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
          toZoneId: dir === "zone_to_zone" ? toZoneId : null,
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

  function setRoundTrip(enabled: boolean) {
    patch({
      isRoundTrip: enabled,
      returnDateTime: enabled
        ? useBookingStore.getState().returnDateTime
        : null,
    })
    if (!enabled) setReturnCalendarOpen(false)
  }

  const isMobile = useIsMobile()

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

  function openCalendarAfterPlaces() {
    void runSheetTransition(() => {
      setFromOpen(false)
      setToOpen(false)
      setCalendarOpen(true)
    })
  }

  /** Chain to the other end on mobile, or to the calendar once both are set. */
  function afterPlaceSelect(end: "from" | "to") {
    const state = useBookingStore.getState()
    const complete =
      state.direction === "zone_to_zone"
        ? Boolean(state.selectedZoneId && state.selectedToZoneId)
        : Boolean(state.selectedZoneId && state.selectedAirportIata)
    if (complete) {
      openCalendarAfterPlaces()
      return
    }
    if (!isMobile) return
    void runSheetTransition(() => {
      setFromOpen(end === "to")
      setToOpen(end === "from")
    })
  }

  function onFromChange(key: string) {
    const from = placeOptions.find((p) => p.key === key)
    if (!from) return
    // Picking the current To → swap ends (Ksamil→Tirana becomes Tirana→Ksamil).
    if (toKey && key === toKey && fromKey) {
      const currentFrom = placeOptions.find((p) => p.key === fromKey)
      if (currentFrom && applyPlaces(from, currentFrom)) return
    }
    const to = toKey ? placeOptions.find((p) => p.key === toKey) : undefined
    if (to && applyPlaces(from, to)) return
    // No To yet, or an unsupported pair (airport → airport): keep From, drop To.
    clearQuotes()
    patch(partialRoutePatch(from, "from"))
  }

  function onToChange(key: string) {
    const to = placeOptions.find((p) => p.key === key)
    if (!to) return
    // Picking the current From → swap ends.
    if (fromKey && key === fromKey && toKey) {
      const currentTo = placeOptions.find((p) => p.key === toKey)
      if (currentTo && applyPlaces(currentTo, to)) return
    }
    const from = fromKey ? placeOptions.find((p) => p.key === fromKey) : undefined
    if (from && applyPlaces(from, to)) return
    clearQuotes()
    patch(partialRoutePatch(to, "to"))
  }

  function swapPlaces() {
    if (!fromKey || !toKey) return
    const from = placeOptions.find((p) => p.key === fromKey)
    const to = placeOptions.find((p) => p.key === toKey)
    if (!from || !to) return
    applyPlaces(to, from)
  }

  async function onContinue(opts?: { fromPassengersSheet?: boolean }) {
    if (continuing) return

    const state = useBookingStore.getState()
    const hasTime = Boolean(state.pickupDateTime)

    if (state.direction === "zone_to_zone") {
      // City ↔ city needs both cities and no airport / flight number.
      if (
        !state.selectedZoneId ||
        !state.selectedToZoneId ||
        state.selectedZoneId === state.selectedToZoneId
      ) {
        toast.error(tr("book.selectDestination"))
        return
      }
    } else {
      if (!state.selectedAirportIata) {
        toast.error(tr("book.selectAirport"))
        return
      }
      if (!state.selectedZoneId) {
        toast.error(tr("book.selectDestination"))
        return
      }
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

  // From: all places so the user can change mind (e.g. Saranda→Tirana → Berat).
  // To is cleared in onFromChange only when the new pair is incompatible.
  const fromOptions = React.useMemo(
    () => placeOptions.map((p) => ({ value: p.key, label: p.label })),
    [placeOptions],
  )
  const toOptions = React.useMemo(
    () =>
      filterPlacesForOppositeEnd(
        placeOptions,
        fromKey,
        corridorNeighbors,
        toKey,
      ).map((p) => ({ value: p.key, label: p.label })),
    [placeOptions, fromKey, toKey, corridorNeighbors],
  )

  const busy = continuing || quoteStatus === "loading"
  const showReloader = continuing || stepReloading
  const fromRowAnchor = useComboboxAnchor()
  const toRowAnchor = useComboboxAnchor()
  // Only lock while the passengers sheet is open — do NOT lock for the
  // continue/reloader cover. That cover is position:fixed itself, and locking
  // through navigation left body scroll broken on /book (especially iOS).
  useBodyScrollLock(Boolean(isMobile && passengersOpen))

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

  /** Prefer the route first — don't open date/time until both ends are chosen. */
  function requestPickupCalendar(open: boolean) {
    if (open && !routeReady) {
      setCalendarOpen(false)
      if (!fromKey) setFromOpen(true)
      else setToOpen(true)
      return
    }
    setCalendarOpen(open)
  }

  function requestReturnCalendar(open: boolean) {
    if (open && !routeReady) {
      setReturnCalendarOpen(false)
      if (!fromKey) setFromOpen(true)
      else setToOpen(true)
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
    <div className="relative z-20 w-full rounded-3xl border border-white/20 bg-brand-surface text-brand shadow-[0_24px_60px_rgba(0,0,0,0.32)]">
      {showReloader ? <HeroStepReloader /> : null}
      <div className="p-5 pb-5 sm:p-6 sm:pb-6">
        <div className="grid grid-cols-2 rounded-full border border-border/60 bg-brand-page p-1">
          <button
            type="button"
            onClick={() => setRoundTrip(false)}
            className={cn(
              "rounded-full py-2.5 text-sm font-extrabold transition-all duration-200",
              !isRoundTrip
                ? "bg-brand-surface text-brand shadow-xs"
                : "text-brand/65 hover:text-brand",
            )}
          >
            {tr("book.oneWay")}
          </button>
          <button
            type="button"
            onClick={() => setRoundTrip(true)}
            className={cn(
              "rounded-full py-2.5 text-sm font-extrabold transition-all duration-200",
              isRoundTrip
                ? "bg-brand-surface text-brand shadow-xs"
                : "text-brand/65 hover:text-brand",
            )}
          >
            {tr("book.return")}
          </button>
        </div>

        <div className="relative mt-4 rounded-2xl border border-border/90 bg-brand-surface shadow-2xs">
          <div className="relative">
            {/* Vertical dashed route connector between From and To icons */}
            <span
              aria-hidden
              className="pointer-events-none absolute top-[calc(25%+8px)] bottom-[calc(25%+8px)] left-[1.375rem] z-0 -translate-x-1/2 border-l-2 border-dashed border-brand-accent/40"
            />

            <div
              ref={fromRowAnchor}
              className="relative z-10 flex items-center gap-3 rounded-t-2xl border-b border-border/80 px-3.5 py-3.5 pr-14 transition-colors hover:bg-brand-page/40"
            >
              <CircleIcon className="size-4 shrink-0 fill-brand-surface stroke-brand-accent stroke-[2.75]" />
              <div className="min-w-0 flex-1">
                <HeroFieldSelect
                  value={fromKey}
                  valueLabel={
                    fromKey
                      ? placeOptions.find((p) => p.key === fromKey)?.label
                      : null
                  }
                  placeholder={tr("book.fromPlaceholder")}
                  options={fromOptions}
                  onChange={onFromChange}
                  anchor={fromRowAnchor}
                  mobileSheet
                  sheetTitle={tr("book.chooseDestination")}
                  open={fromOpen}
                  onOpenChange={setFromOpen}
                  onAfterSelect={() => afterPlaceSelect("from")}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={swapPlaces}
              disabled={!fromKey || !toKey || busy}
              aria-label={tr("book.swap")}
              title={tr("book.swap")}
              className={cn(
                "absolute top-1/2 right-3 z-20 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-border/90 bg-brand-surface text-brand shadow-xs transition-all duration-200",
                "hover:border-brand-accent/50 hover:bg-brand-page hover:text-brand-accent active:scale-95 disabled:pointer-events-none disabled:opacity-35",
              )}
            >
              <ArrowUpDownIcon className="size-4" />
            </button>

            <div
              ref={toRowAnchor}
              className="relative z-10 flex items-center gap-3 border-b border-border/80 px-3.5 py-3.5 pr-14 transition-colors hover:bg-brand-page/40"
            >
              <MapPinIcon className="size-4 shrink-0 text-brand-accent" />
              <div className="min-w-0 flex-1">
                <HeroFieldSelect
                  value={toKey}
                  valueLabel={
                    toKey
                      ? placeOptions.find((p) => p.key === toKey)?.label
                      : null
                  }
                  placeholder={tr("book.toPlaceholder")}
                  options={toOptions}
                  onChange={onToChange}
                  anchor={toRowAnchor}
                  mobileSheet
                  sheetTitle={tr("book.chooseDestination")}
                  open={toOpen}
                  onOpenChange={setToOpen}
                  onAfterSelect={() => afterPlaceSelect("to")}
                />
              </div>
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
                  "relative z-10 flex w-full items-center gap-3 px-3.5 py-3.5 text-left transition-colors hover:bg-brand-page/40",
                  isRoundTrip ? "border-b border-border/80" : "rounded-b-2xl",
                  calendarOpen && "ring-2 ring-inset ring-brand-accent",
                )}
              >
                <CalendarIcon className="size-4 shrink-0 text-brand-accent" />
                <span
                  className={cn(
                    "text-sm font-bold",
                    pickupDateTime ? "text-brand" : "text-brand/60",
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
                    "relative z-10 flex w-full items-center gap-3 rounded-b-2xl px-3.5 py-3.5 text-left transition-colors hover:bg-brand-page/40",
                    returnCalendarOpen && "ring-2 ring-inset ring-brand-accent",
                  )}
                >
                  <CalendarIcon className="size-4 shrink-0 text-brand-accent" />
                  <span
                    className={cn(
                      "text-sm font-bold",
                      returnDateTime ? "text-brand" : "text-brand/60",
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
                "mt-4 flex w-full items-center gap-3 rounded-2xl border border-border/90 bg-brand-page/40 px-3.5 py-3.5 text-left touch-manipulation transition-colors hover:bg-brand-page",
                passengersOpen && "ring-2 ring-inset ring-brand-accent",
              )}
            >
              <UsersIcon className="size-4 shrink-0 text-brand-accent" />
              <span className="min-w-0 flex-1 text-base font-bold text-[color:var(--brand-ink)]">
                {passengersLabel}
              </span>
              <BriefcaseIcon className="size-4 shrink-0 text-brand/60" />
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
                      className="h-12 w-full rounded-full bg-brand-accent text-base font-extrabold text-white shadow-sm hover:bg-brand-accent-hover active:scale-[0.98]"
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
          <div className="mt-4 grid grid-cols-2 gap-3.5">
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
          <p className="mt-3 text-center text-xs font-semibold text-amber-700">
            {tr("book.notCovered")}
          </p>
        )}
        {quoteStatus === "error" && (
          <p className="mt-3 text-center text-xs font-semibold text-red-600">
            {quoteError || tr("book.couldNotLoadPrices")}
          </p>
        )}

        <Button
          type="button"
          size="lg"
          className={cn(
            "group mt-5 h-12 w-full rounded-full bg-brand-accent text-base font-extrabold text-white",
            "shadow-[0_4px_14px_color-mix(in_srgb,var(--brand-accent)_35%,transparent)]",
            "transition-all duration-200 active:scale-[0.98]",
            "hover:-translate-y-0.5 hover:bg-brand-accent-hover hover:brightness-95",
            "hover:shadow-[0_6px_20px_color-mix(in_srgb,var(--brand-accent)_45%,transparent)]",
          )}
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
            <>
              <span>{tr("book.continue")}</span>
              <ArrowRightIcon
                className="size-4 transition-transform duration-200 group-hover:translate-x-1"
                data-icon="inline-end"
                aria-hidden
              />
            </>
          )}
        </Button>
      </div>

      <div className="flex items-center gap-3 rounded-b-3xl border-t border-border/70 bg-brand-page/70 px-5 py-3.5 text-xs font-bold leading-snug text-brand/80 sm:px-6">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-accent/15 text-brand-accent">
          <ShieldCheckIcon className="size-4" aria-hidden />
        </div>
        <span>{tr("book.fixedPrices")}</span>
      </div>
    </div>
  )
}
