"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import useSWR from "swr"
import { useRouter } from "next/navigation"
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
import { useIsMobile } from "@/hooks/use-mobile"
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock"
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
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

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

/** Full-viewport white reloader — portaled above sheet open/close animations. */
function HeroStepReloader() {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex h-[100dvh] w-screen items-center justify-center bg-white"
      style={{
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        width: "100vw",
        height: "100dvh",
      }}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading"
    >
      <Loader2Icon
        className="size-10 animate-spin"
        style={{ color: "var(--brand-accent)" }}
      />
    </div>,
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

type FieldOption = { value: string; label: string }

function FieldSelect({
  value,
  placeholder,
  options,
  onChange,
  anchor,
  mobileSheet = false,
  sheetTitle,
  onAfterSelect,
}: {
  value: string | null
  placeholder: string
  options: FieldOption[]
  onChange: (value: string) => void
  /** Full-width row/card element — popup matches its width and sits under it. */
  anchor: React.RefObject<HTMLElement | null>
  /** Mobile-only: open destinations in a full-screen sheet. */
  mobileSheet?: boolean
  sheetTitle?: string
  onAfterSelect?: () => void
}) {
  const isMobile = useIsMobile()
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  useBodyScrollLock(Boolean(mobileSheet && isMobile && sheetOpen))

  const selected =
    value != null
      ? (options.find((opt) => opt.value === value) ?? null)
      : null

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((opt) => opt.label.toLowerCase().includes(q))
  }, [options, query])

  React.useEffect(() => {
    if (!sheetOpen) setQuery("")
  }, [sheetOpen])

  function pick(next: string) {
    onChange(next)
    // Open the next sheet first so scroll-lock ref-count never drops to 0.
    onAfterSelect?.()
    setSheetOpen(false)
  }

  if (mobileSheet && isMobile) {
    return (
      <>
        <button
          type="button"
          className="flex w-full min-w-0 items-center justify-between gap-2 text-left touch-manipulation"
          onClick={() => setSheetOpen(true)}
        >
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-base font-bold",
              selected
                ? "text-[color:var(--brand-ink)]"
                : "font-semibold text-muted-foreground",
            )}
          >
            {selected?.label ?? placeholder}
          </span>
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
        </button>

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent
            side="bottom"
            showCloseButton
            className="flex h-[100dvh] max-h-[100dvh] flex-col gap-0 rounded-none border-0 bg-brand-surface p-0 text-[color:var(--brand-ink)] data-[side=bottom]:h-[100dvh]"
          >
            <SheetHeader className="shrink-0 border-b border-border px-4 py-3 pr-14">
              <SheetTitle className="text-base font-bold text-brand">
                {sheetTitle ?? "Choose destination"}
              </SheetTitle>
            </SheetHeader>

            <div className="shrink-0 border-b border-border px-4 py-3">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Type to search"
                  autoFocus
                  className="h-11 rounded-xl border-border bg-muted/40 pl-9 text-base font-semibold"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-1.5 px-4 py-10 text-sm text-muted-foreground">
                  <SearchIcon className="size-5 opacity-50" />
                  No matching places
                </div>
              ) : (
                <ul className="flex flex-col gap-0.5">
                  {filtered.map((item) => {
                    const isSelected = item.value === value
                    return (
                      <li key={item.value}>
                        <button
                          type="button"
                          onClick={() => pick(item.value)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left touch-manipulation transition-colors",
                            isSelected
                              ? "bg-[color-mix(in_srgb,var(--brand-accent)_14%,white)]"
                              : "hover:bg-muted active:bg-muted",
                          )}
                        >
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--brand-accent)_12%,white)] text-brand-accent">
                            <MapPinIcon className="size-4" />
                          </span>
                          <span className="min-w-0 flex-1 text-base font-semibold whitespace-normal text-[color:var(--brand-ink)]">
                            {item.label}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </>
    )
  }

  return (
    <Combobox
      items={options}
      value={selected}
      onValueChange={(item: FieldOption | null) => {
        if (item) {
          onChange(item.value)
          onAfterSelect?.()
        }
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
  const selectedZoneIdFromStore = useBookingStore((s) => s.selectedZoneId)
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
  const [passengersOpen, setPassengersOpen] = React.useState(false)
  const [continuing, setContinuing] = React.useState(false)
  const [stepReloading, setStepReloading] = React.useState(false)

  const { data: config } = useSWR<BookingConfig>("/api/booking/config", fetcher)
  const airports = config?.airports ?? []
  const zones = config?.zones ?? []

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

  const loadQuotes = React.useCallback(async () => {
    const state = useBookingStore.getState()
    const { direction: dir, selectedZoneId: zoneId } = state
    if (!dir || !zoneId) {
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
      VEHICLE_TYPES.map((vehicleType) =>
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
      const vehicleType = VEHICLE_TYPES[i]!
      if (result.status === "fulfilled") {
        vehicleQuotes[vehicleType] = {
          price: result.value.price,
          distanceKm: result.value.distanceKm,
          durationMin: result.value.durationMin,
        }
        continue
      }
      const err = result.reason as Error & { code?: string; status?: number }
      if (err.status === 404 || err.code === "OUTSIDE_SERVICE_AREA") {
        // Missing rule for this vehicle — skip; zone may still be covered.
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
  }, [patch])

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
      toast.error("Select an airport.")
      return
    }
    if (!hasZone) {
      toast.error("Select a destination.")
      return
    }
    if (!hasTime) {
      toast.error("Add a pickup date and time.")
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

    setContinuing(true)
    if (opts?.fromPassengersSheet) setPassengersOpen(false)
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
        ),
        startedFromHero: true,
      })
      setStep(1)
      router.push("/book")
      // Leave continuing on so the white reloader stays until unmount.
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
  useBodyScrollLock(
    Boolean((isMobile && passengersOpen) || showReloader),
  )

  async function runSheetTransition(openNext: () => void) {
    if (!isMobile) {
      openNext()
      return
    }
    setStepReloading(true)
    // Cover previous sheet close animation completely.
    await new Promise((resolve) => setTimeout(resolve, 320))
    openNext()
    // Keep covering until the next sheet has finished opening.
    await new Promise((resolve) => setTimeout(resolve, 280))
    setStepReloading(false)
  }

  function openCalendarAfterDestination() {
    void runSheetTransition(() => setCalendarOpen(true))
  }

  function openPassengersAfterCalendar() {
    void runSheetTransition(() => setPassengersOpen(true))
  }

  React.useEffect(() => {
    router.prefetch("/book")
  }, [router])

  const passengersLabel = `${passengerCount} passenger${passengerCount === 1 ? "" : "s"} · ${luggageCount} luggage`

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
                singleAirportOnly ? (
                  <p className="truncate text-sm font-bold text-brand">
                    {selectedAirportLabel ?? "Tirana International (TIA)"}
                  </p>
                ) : (
                  <FieldSelect
                    value={selectedAirportIata}
                    placeholder="From (airport, port, address)"
                    options={airportOptions}
                    onChange={onAirportPicked}
                    anchor={fromRowAnchor}
                  />
                )
              ) : (
                <FieldSelect
                  value={selectedZoneId}
                  placeholder="From (airport, port, address)"
                  options={zoneOptions}
                  onChange={onZonePicked}
                  anchor={fromRowAnchor}
                  mobileSheet
                  sheetTitle="Choose destination"
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
                  mobileSheet
                  sheetTitle="Choose destination"
                  onAfterSelect={openCalendarAfterDestination}
                />
              ) : singleAirportOnly ? (
                <p className="truncate text-sm font-bold text-brand">
                  {selectedAirportLabel ?? "Tirana International (TIA)"}
                </p>
              ) : (
                <FieldSelect
                  value={selectedAirportIata}
                  placeholder="To (airport, port, address)"
                  options={airportOptions}
                  onChange={onAirportPicked}
                  anchor={toRowAnchor}
                  mobileSheet
                  sheetTitle="Choose destination"
                  onAfterSelect={openCalendarAfterDestination}
                />
              )}
            </div>
          </div>

          <HeroDateTimePicker
            value={pickupDateTime}
            open={calendarOpen}
            onOpenChange={setCalendarOpen}
            onChange={(iso) => patch({ pickupDateTime: iso })}
            onAfterConfirm={openPassengersAfterCalendar}
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
                    Passengers & luggage
                  </SheetTitle>
                </SheetHeader>

                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
                    <div className="flex flex-col gap-5">
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
                          Continue…
                        </>
                      ) : (
                        "Confirm"
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
        )}

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
