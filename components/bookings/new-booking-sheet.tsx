"use client"

import * as React from "react"
import useSWR from "swr"
import { toast } from "sonner"
import {
  ArrowLeftRightIcon,
  CalendarClockIcon,
  CarIcon,
  LuggageIcon,
  MapPinIcon,
  PhoneIcon,
  PlaneIcon,
  PlusIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react"

import { apiPost, fetcher } from "@/lib/api"
import type { AirportWithCoords } from "@/lib/airports"
import { resolveAirportLocation } from "@/lib/airports"
import { joinPhone } from "@/lib/booking-details"
import { DIRECTION_LABELS, VEHICLE_LABELS } from "@/lib/format"
import type { Direction, VehicleType } from "@/lib/types"
import {
  DEFAULT_VEHICLE_CAPACITIES,
  partyStepperLimits,
} from "@/lib/vehicles"
import { cn } from "@/lib/utils"
import type { ServiceZonePlace } from "@/components/booking/zone-place-select"
import { CountryCodeSelect } from "@/components/booking/country-code-select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AdminDateTimeField,
  toDateTimeInputValue,
} from "@/components/admin/date-field"
import { AdminFilterSelectField } from "@/components/admin/filter-select-field"

type QuoteResponse = {
  totalPrice: number
  depositAmount: number
  balanceDue: number
}

type BookingConfig = {
  airports: AirportWithCoords[]
  zones: ServiceZonePlace[]
  vehicleCapacities?: import("@/lib/vehicles").VehicleCapacityConfig
}

type Endpoint = {
  address: string
  lat: number | null
  lng: number | null
}

const DIRECTION_ITEMS = DIRECTION_LABELS

const VEHICLE_ITEMS = Object.fromEntries(
  (Object.keys(VEHICLE_LABELS) as VehicleType[]).map((v) => [
    v,
    VEHICLE_LABELS[v],
  ]),
) as Record<VehicleType, string>

const FIELD_CONTROL =
  "h-10 w-full text-base touch-manipulation md:h-9 md:text-sm"

function useDebounced<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

function parseIntSafe(v: string) {
  const n = Number.parseInt(v, 10)
  return Number.isFinite(n) ? n : null
}

function airportEndpoint(airport: AirportWithCoords): Endpoint {
  return {
    address: `${airport.name} (${airport.iataCode})`,
    lat: airport.lat,
    lng: airport.lng,
  }
}

function zoneEndpoint(
  zone: ServiceZonePlace,
  airport: AirportWithCoords | null,
): Endpoint {
  return {
    address: zone.name,
    // Placeholder coords — pricing uses zoneId, not map distance.
    lat: airport?.lat ?? 0,
    lng: airport?.lng ?? 0,
  }
}

function emptyEndpoint(): Endpoint {
  return { address: "", lat: null, lng: null }
}

export function NewBookingSheet({
  onCreated,
}: {
  onCreated: () => void
}) {
  const [open, setOpen] = React.useState(false)

  const [customerName, setCustomerName] = React.useState("")
  const [customerEmail, setCustomerEmail] = React.useState("")
  const [phoneCountryCode, setPhoneCountryCode] = React.useState("+355")
  const [phoneNational, setPhoneNational] = React.useState("")

  const [direction, setDirection] = React.useState<Direction>("airport_to_dest")
  const [selectedAirportIata, setSelectedAirportIata] = React.useState<
    string | null
  >(null)
  const [selectedZoneId, setSelectedZoneId] = React.useState<string | null>(
    null,
  )

  const [pickupDateTime, setPickupDateTime] = React.useState(() =>
    toDateTimeInputValue(new Date(Date.now() + 3 * 60 * 60 * 1000)),
  )

  const [flightNumber, setFlightNumber] = React.useState("")

  const [passengerCount, setPassengerCount] = React.useState("2")
  const [luggageCount, setLuggageCount] = React.useState("2")

  const [vehicleType, setVehicleType] = React.useState<VehicleType>("sedan")

  const [isRoundTrip, setIsRoundTrip] = React.useState(false)
  const [meetAndGreet, setMeetAndGreet] = React.useState(false)
  const [markAsPaid, setMarkAsPaid] = React.useState(false)

  const { data: config, isLoading: configLoading } = useSWR<BookingConfig>(
    open ? "/api/booking/config" : null,
    fetcher,
  )

  const airports = config?.airports ?? []
  const zones = config?.zones ?? []
  const { maxPassengers, maxLuggage } = partyStepperLimits(
    config?.vehicleCapacities ?? DEFAULT_VEHICLE_CAPACITIES,
  )

  const airportItems = React.useMemo(
    () =>
      airports.map((a) => ({
        value: a.iataCode,
        label: `${a.name} (${a.iataCode})`,
      })),
    [airports],
  )

  const zoneOptions = React.useMemo(
    () => zones.map((z) => ({ value: z.id, label: z.name })),
    [zones],
  )

  const directionOptions = React.useMemo(
    () =>
      (Object.keys(DIRECTION_ITEMS) as Direction[]).map((value) => ({
        value,
        label: DIRECTION_ITEMS[value],
      })),
    [],
  )

  const vehicleOptions = React.useMemo(
    () =>
      (Object.keys(VEHICLE_ITEMS) as VehicleType[]).map((value) => ({
        value,
        label: VEHICLE_ITEMS[value],
      })),
    [],
  )

  // Seed default airport once config loads.
  React.useEffect(() => {
    if (!open || !config || airports.length === 0) return
    if (selectedAirportIata) return
    const airport = resolveAirportLocation(airports, null)
    if (airport) setSelectedAirportIata(airport.iataCode)
  }, [open, config, airports, selectedAirportIata])

  const airport = resolveAirportLocation(airports, selectedAirportIata)
  const zone = zones.find((z) => z.id === selectedZoneId) ?? null

  const pickup: Endpoint =
    direction === "airport_to_dest"
      ? airport
        ? airportEndpoint(airport)
        : emptyEndpoint()
      : zone
        ? zoneEndpoint(zone, airport)
        : emptyEndpoint()

  const dropoff: Endpoint =
    direction === "airport_to_dest"
      ? zone
        ? zoneEndpoint(zone, airport)
        : emptyEndpoint()
      : airport
        ? airportEndpoint(airport)
        : emptyEndpoint()

  const debouncedVehicleType = useDebounced(vehicleType)
  const debouncedZoneId = useDebounced(selectedZoneId)

  const quoteEnabled = Boolean(debouncedVehicleType && debouncedZoneId)

  const { data: quote, isLoading: quoteLoading } = useSWR<QuoteResponse>(
    quoteEnabled
      ? `/api/admin/bookings/quote?vehicleType=${encodeURIComponent(
          debouncedVehicleType,
        )}&zoneId=${encodeURIComponent(debouncedZoneId!)}`
      : null,
    fetcher,
  )

  function reset() {
    setCustomerName("")
    setCustomerEmail("")
    setPhoneCountryCode("+355")
    setPhoneNational("")
    setDirection("airport_to_dest")
    setSelectedAirportIata(null)
    setSelectedZoneId(null)
    setFlightNumber("")
    setPassengerCount("2")
    setLuggageCount("2")
    setVehicleType("sedan")
    setIsRoundTrip(false)
    setMeetAndGreet(false)
    setMarkAsPaid(false)
    setPickupDateTime(
      toDateTimeInputValue(new Date(Date.now() + 3 * 60 * 60 * 1000)),
    )
  }

  function onDirectionChange(next: Direction | null) {
    if (!next) return
    setDirection(next)
  }

  function onZoneChange(zoneId: string | null) {
    if (!zoneId) {
      setSelectedZoneId(null)
      return
    }
    setSelectedZoneId(zoneId)
  }

  async function submit() {
    const pCount = parseIntSafe(passengerCount)
    const lCount = parseIntSafe(luggageCount)
    const dt = new Date(pickupDateTime)
    const customerPhone = joinPhone(phoneCountryCode, phoneNational)

    if (!customerName.trim()) return toast.error("Customer name is required.")
    if (!customerEmail.trim()) return toast.error("Customer email is required.")
    if (!phoneNational.trim()) return toast.error("Customer phone is required.")
    if (!airport) return toast.error("Select an airport.")
    if (!zone) return toast.error("Select a destination from pricing zones.")
    if (!pickup.address || pickup.lat == null || pickup.lng == null) {
      return toast.error("Pickup location is incomplete.")
    }
    if (!dropoff.address || dropoff.lat == null || dropoff.lng == null) {
      return toast.error("Drop-off location is incomplete.")
    }
    if (Number.isNaN(dt.getTime())) return toast.error("Pickup date/time is invalid.")
    if (pCount === null || pCount <= 0) {
      return toast.error("Passenger count must be > 0.")
    }
    if (pCount > maxPassengers) {
      return toast.error(`Passengers must be at most ${maxPassengers}.`)
    }
    if (lCount === null || lCount < 0) {
      return toast.error("Luggage count must be >= 0.")
    }
    if (lCount > maxLuggage) {
      return toast.error(`Luggage must be at most ${maxLuggage}.`)
    }

    const payload = {
      customer: {
        name: customerName.trim(),
        email: customerEmail.trim(),
        phone: customerPhone,
      },
      direction,
      pickupAddress: pickup.address,
      pickupLat: pickup.lat,
      pickupLng: pickup.lng,
      dropoffAddress: dropoff.address,
      dropoffLat: dropoff.lat,
      dropoffLng: dropoff.lng,
      pickupDateTime,
      flightNumber: flightNumber.trim() || null,
      passengerCount: pCount,
      luggageCount: lCount,
      vehicleType,
      zoneId: zone.id,
      isRoundTrip,
      meetAndGreet,
      markAsPaid,
    }

    try {
      const res = await apiPost<{ bookings: { referenceCode: string }[] }>(
        "/api/admin/bookings",
        payload,
      )
      toast.success(
        `Created booking ${res.bookings[0]?.referenceCode ?? ""}.`,
      )
      setOpen(false)
      reset()
      onCreated()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const showAirportSelect = airports.length > 1
  const destinationLabel =
    direction === "dest_to_airport" ? "Pickup address" : "Drop-off address"
  const airportRoleLabel =
    direction === "airport_to_dest" ? "Pickup address" : "Drop-off address"

  return (
    <>
      <Button
        size="sm"
        className="h-10 w-full touch-manipulation sm:h-8 sm:w-auto"
        onClick={() => setOpen(true)}
      >
        <PlusIcon data-icon="inline-start" />
        New Booking
      </Button>
      <Sheet
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) reset()
        }}
      >
        <SheetContent
          side="right"
          className="flex h-dvh max-w-none flex-col gap-0 rounded-none border-0 p-0 sm:max-w-lg sm:border-l sm:data-[side=right]:max-w-lg"
        >
          <SheetHeader className="border-b bg-muted/20 p-4 pr-12">
            <SheetTitle className="text-sm font-medium">
              Create booking
            </SheetTitle>
            <SheetDescription>
              Manual booking from a priced destination — same fields as the
              public flow, filled by ops.
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-4 p-4">
              <SectionCard icon={UsersIcon} title="Customer">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField label="Full name" required>
                    <Input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Customer full name"
                      className={FIELD_CONTROL}
                      autoComplete="name"
                    />
                  </FormField>
                  <FormField label="Email" required>
                    <Input
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="customer@example.com"
                      type="email"
                      className={FIELD_CONTROL}
                      autoComplete="email"
                    />
                  </FormField>
                  <FormField
                    label="Phone"
                    required
                    className="sm:col-span-2"
                  >
                    <div className="flex gap-2">
                      <CountryCodeSelect
                        variant="admin"
                        value={phoneCountryCode}
                        onChange={setPhoneCountryCode}
                      />
                      <div className="relative min-w-0 flex-1">
                        <PhoneIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={phoneNational}
                          onChange={(e) => setPhoneNational(e.target.value)}
                          placeholder="66 123 4567"
                          type="tel"
                          inputMode="tel"
                          className={cn(FIELD_CONTROL, "pl-8")}
                          autoComplete="tel-national"
                        />
                      </div>
                    </div>
                  </FormField>
                </div>
              </SectionCard>

              <SectionCard icon={MapPinIcon} title="Route">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <AdminFilterSelectField
                    label="Direction"
                    icon={ArrowLeftRightIcon}
                    value={direction}
                    onChange={(value) =>
                      onDirectionChange(value as Direction)
                    }
                    options={directionOptions}
                    allowClear={false}
                  />
                  <AdminFilterSelectField
                    label="Vehicle"
                    icon={CarIcon}
                    value={vehicleType}
                    onChange={(value) =>
                      setVehicleType(value as VehicleType)
                    }
                    options={vehicleOptions}
                    allowClear={false}
                  />
                </div>

                {showAirportSelect ? (
                  <AdminFilterSelectField
                    label={`${airportRoleLabel} · Airport`}
                    icon={PlaneIcon}
                    value={selectedAirportIata ?? ""}
                    onChange={(value) => {
                      if (value) setSelectedAirportIata(value)
                    }}
                    options={airportItems}
                    allowClear={false}
                    disabled={configLoading || airports.length === 0}
                    placeholder="Select airport"
                    emptyMessage="No airport configured in settings."
                  />
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs text-muted-foreground">
                      {airportRoleLabel} · Airport
                    </span>
                    <div className="flex h-11 items-center gap-2 rounded-lg border border-input px-3 text-sm md:h-10">
                      <PlaneIcon className="size-4 shrink-0 text-muted-foreground" />
                      {configLoading ? (
                        <Skeleton className="h-4 w-40" />
                      ) : airport ? (
                        <span className="truncate font-medium">
                          {airport.name} ({airport.iataCode})
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          No airport configured in settings.
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <AdminFilterSelectField
                    label={`${destinationLabel} · Pricing zone`}
                    icon={MapPinIcon}
                    value={selectedZoneId ?? ""}
                    onChange={(value) => onZoneChange(value || null)}
                    options={zoneOptions}
                    allValue=""
                    allowClear
                    disabled={configLoading || zones.length === 0}
                    placeholder={
                      configLoading
                        ? "Loading zones…"
                        : zones.length === 0
                          ? "No pricing zones available"
                          : "Select destination"
                    }
                    emptyMessage="No pricing zones available."
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Addresses come from active pricing zones.
                  </p>
                </div>

                <ol className="flex flex-col gap-0 overflow-hidden rounded-lg border bg-muted/20">
                  <li className="flex items-start gap-3 border-b px-3 py-2.5">
                    <span className="mt-1.5 size-2.5 shrink-0 rounded-full border-2 border-primary" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                        Pickup
                      </p>
                      <p className="truncate text-sm font-medium">
                        {pickup.address || "—"}
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3 px-3 py-2.5">
                    <MapPinIcon className="mt-0.5 size-3.5 shrink-0 text-success" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                        Drop-off
                      </p>
                      <p className="truncate text-sm font-medium">
                        {dropoff.address || "—"}
                      </p>
                    </div>
                  </li>
                </ol>
              </SectionCard>

              <SectionCard icon={CalendarClockIcon} title="Trip details">
                <AdminDateTimeField
                  label="Pickup time"
                  value={pickupDateTime}
                  onChange={setPickupDateTime}
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FactField
                    icon={PlaneIcon}
                    label="Flight"
                    className="sm:col-span-2"
                    input={
                      <Input
                        className={FIELD_CONTROL}
                        value={flightNumber}
                        onChange={(e) => setFlightNumber(e.target.value)}
                        placeholder="e.g. OS847"
                      />
                    }
                  />
                  <FactField
                    icon={UsersIcon}
                    label="Passengers"
                    input={
                      <Input
                        type="number"
                        min={1}
                        max={maxPassengers}
                        inputMode="numeric"
                        className={FIELD_CONTROL}
                        value={passengerCount}
                        onChange={(e) => setPassengerCount(e.target.value)}
                      />
                    }
                  />
                  <FactField
                    icon={LuggageIcon}
                    label="Luggage"
                    input={
                      <Input
                        type="number"
                        min={0}
                        max={maxLuggage}
                        inputMode="numeric"
                        className={FIELD_CONTROL}
                        value={luggageCount}
                        onChange={(e) => setLuggageCount(e.target.value)}
                      />
                    }
                  />
                </div>
              </SectionCard>

              <SectionCard icon={PlaneIcon} title="Trip options">
                <div className="flex flex-col divide-y overflow-hidden rounded-lg border">
                  <OptionRow
                    label="Round trip"
                    description="Create a linked return booking automatically."
                    checked={isRoundTrip}
                    onCheckedChange={setIsRoundTrip}
                  />
                  <OptionRow
                    label="Meet and greet"
                    description="Add airport meet-and-greet to the booking notes."
                    checked={meetAndGreet}
                    onCheckedChange={setMeetAndGreet}
                  />
                </div>
              </SectionCard>

              <SectionCard icon={WalletIcon} title="Fare">
                <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3.5 py-3">
                  <span className="text-sm font-medium">Total</span>
                  {quoteLoading ? (
                    <Skeleton className="h-6 w-20" />
                  ) : quote ? (
                    <span className="text-lg font-semibold tabular-nums">
                      €{quote.totalPrice.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {quoteEnabled ? "Unavailable" : "Select destination"}
                    </span>
                  )}
                </div>

                <FormField label="Payment status">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={!markAsPaid ? "default" : "outline"}
                      className="h-10 touch-manipulation"
                      onClick={() => setMarkAsPaid(false)}
                    >
                      Not paid
                    </Button>
                    <Button
                      type="button"
                      variant={markAsPaid ? "default" : "outline"}
                      className="h-10 touch-manipulation"
                      onClick={() => setMarkAsPaid(true)}
                    >
                      Paid
                    </Button>
                  </div>
                </FormField>
              </SectionCard>
            </div>
          </ScrollArea>

          <div className="border-t bg-muted/20 p-4">
            <Button onClick={submit} className="h-11 w-full touch-manipulation">
              Create booking
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b bg-muted/30 px-3.5 py-2.5">
        <span className="flex size-7 items-center justify-center rounded-md bg-background text-muted-foreground ring-1 ring-border">
          <Icon className="size-3.5" />
        </span>
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      <div className="flex flex-col gap-3.5 p-3.5">{children}</div>
    </section>
  )
}

function FormField({
  label,
  required,
  hint,
  className,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label className="text-xs text-muted-foreground">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
      {hint ? (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

function FactField({
  icon: Icon,
  label,
  input,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  input: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg border bg-muted/30 p-2.5",
        className,
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground ring-1 ring-border">
        <Icon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        {input}
      </div>
    </div>
  )
}

function OptionRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 bg-muted/20 px-3.5 py-3">
      <div className="min-w-0 flex flex-col gap-0.5">
        <Label className="text-sm text-foreground">{label}</Label>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}
