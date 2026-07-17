"use client"

import * as React from "react"
import useSWR from "swr"
import { toast } from "sonner"
import {
  CalendarClockIcon,
  LuggageIcon,
  MapPinIcon,
  PhoneIcon,
  PlaneIcon,
  PlusIcon,
  UsersIcon,
} from "lucide-react"

import { apiPost, fetcher } from "@/lib/api"
import type { AirportWithCoords } from "@/lib/airports"
import { resolveAirportLocation } from "@/lib/airports"
import { DIRECTION_LABELS, VEHICLE_LABELS } from "@/lib/format"
import type { Direction, VehicleType } from "@/lib/types"
import type { ServiceZonePlace } from "@/components/booking/zone-place-select"
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
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AdminDateTimeField,
  toDateTimeInputValue,
} from "@/components/admin/date-field"

type QuoteResponse = {
  totalPrice: number
  depositAmount: number
  balanceDue: number
}

type BookingConfig = {
  airports: AirportWithCoords[]
  zones: ServiceZonePlace[]
}

type Endpoint = {
  address: string
  lat: number | null
  lng: number | null
}

function SectionLabel({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
      <Icon className="size-3.5" />
      {children}
    </span>
  )
}

const DIRECTION_ITEMS = DIRECTION_LABELS

const VEHICLE_ITEMS = Object.fromEntries(
  (Object.keys(VEHICLE_LABELS) as VehicleType[]).map((v) => [
    v,
    VEHICLE_LABELS[v],
  ]),
) as Record<VehicleType, string>

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

function zoneEndpoint(zone: ServiceZonePlace): Endpoint {
  return {
    address: zone.name,
    lat: zone.lat,
    lng: zone.lng,
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
  const [customerPhone, setCustomerPhone] = React.useState("")

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

  const airportItems = React.useMemo(
    () =>
      Object.fromEntries(
        airports.map((a) => [a.iataCode, `${a.name} (${a.iataCode})`]),
      ),
    [airports],
  )

  const zoneItems = React.useMemo(
    () => Object.fromEntries(zones.map((z) => [z.id, z.name])),
    [zones],
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
        ? zoneEndpoint(zone)
        : emptyEndpoint()

  const dropoff: Endpoint =
    direction === "airport_to_dest"
      ? zone
        ? zoneEndpoint(zone)
        : emptyEndpoint()
      : airport
        ? airportEndpoint(airport)
        : emptyEndpoint()

  const debouncedVehicleType = useDebounced(vehicleType)
  const debouncedDirection = useDebounced(direction)
  const debouncedPickupLat = useDebounced(pickup.lat)
  const debouncedPickupLng = useDebounced(pickup.lng)
  const debouncedDropoffLat = useDebounced(dropoff.lat)
  const debouncedDropoffLng = useDebounced(dropoff.lng)

  const quoteEnabled =
    debouncedPickupLat !== null &&
    debouncedPickupLng !== null &&
    debouncedDropoffLat !== null &&
    debouncedDropoffLng !== null &&
    !!debouncedVehicleType &&
    !!debouncedDirection

  const { data: quote, isLoading: quoteLoading } = useSWR<QuoteResponse>(
    quoteEnabled
      ? `/api/admin/bookings/quote?direction=${encodeURIComponent(
          debouncedDirection,
        )}&vehicleType=${encodeURIComponent(
          debouncedVehicleType,
        )}&pickupLat=${debouncedPickupLat}&pickupLng=${debouncedPickupLng}&dropoffLat=${debouncedDropoffLat}&dropoffLng=${debouncedDropoffLng}`
      : null,
    fetcher,
  )

  function reset() {
    setCustomerName("")
    setCustomerEmail("")
    setCustomerPhone("")
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

    if (!customerName.trim()) return toast.error("Customer name is required.")
    if (!customerEmail.trim()) return toast.error("Customer email is required.")
    if (!customerPhone.trim()) return toast.error("Customer phone is required.")
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
    if (lCount === null || lCount < 0) {
      return toast.error("Luggage count must be >= 0.")
    }

    const payload = {
      customer: {
        name: customerName.trim(),
        email: customerEmail.trim(),
        phone: customerPhone.trim(),
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
          className="h-dvh max-w-none gap-0 rounded-none border-0 p-0 sm:max-w-lg sm:border-l sm:data-[side=right]:max-w-lg"
        >
          <SheetHeader className="border-b p-4 pr-12">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-sm font-medium">
                Create booking
              </SheetTitle>
            </div>
            <SheetDescription>
              Choose direction and a priced destination to create a manual
              booking.
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-6 p-4">
              <section className="flex flex-col gap-3">
                <SectionLabel icon={UsersIcon}>Customer</SectionLabel>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Name</Label>
                    <Input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Customer full name"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <Input
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="customer@example.com"
                      type="email"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <Label className="text-xs text-muted-foreground">Phone</Label>
                    <div className="relative">
                      <PhoneIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="+355 ..."
                        className="pl-8"
                      />
                    </div>
                  </div>
                </div>
              </section>

              <Separator />

              <section className="flex flex-col gap-3">
                <SectionLabel icon={MapPinIcon}>Route</SectionLabel>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Direction
                    </Label>
                    <Select
                      value={direction}
                      items={DIRECTION_ITEMS}
                      onValueChange={onDirectionChange}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(
                          Object.keys(DIRECTION_ITEMS) as Direction[]
                        ).map((value) => (
                          <SelectItem key={value} value={value}>
                            {DIRECTION_ITEMS[value]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Vehicle
                    </Label>
                    <Select
                      value={vehicleType}
                      items={VEHICLE_ITEMS}
                      onValueChange={(v) => {
                        if (v) setVehicleType(v as VehicleType)
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(VEHICLE_ITEMS) as VehicleType[]).map(
                          (v) => (
                            <SelectItem key={v} value={v}>
                              {VEHICLE_ITEMS[v]}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">
                    {airportRoleLabel} · Airport
                  </Label>
                  {showAirportSelect ? (
                    <Select
                      value={selectedAirportIata}
                      items={airportItems}
                      disabled={configLoading || airports.length === 0}
                      onValueChange={(v) => {
                        if (v) setSelectedAirportIata(v)
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select airport" />
                      </SelectTrigger>
                      <SelectContent>
                        {airports.map((a) => (
                          <SelectItem key={a.iataCode} value={a.iataCode}>
                            {a.name} ({a.iataCode})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
                      {configLoading ? (
                        <Skeleton className="h-4 w-40" />
                      ) : airport ? (
                        <p className="font-medium">
                          {airport.name} ({airport.iataCode})
                        </p>
                      ) : (
                        <p className="text-muted-foreground">
                          No airport configured in settings.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">
                    {destinationLabel} · Pricing zone
                  </Label>
                  <Select
                    value={selectedZoneId}
                    items={zoneItems}
                    disabled={configLoading || zones.length === 0}
                    onValueChange={onZoneChange}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={
                          configLoading
                            ? "Loading zones…"
                            : zones.length === 0
                              ? "No pricing zones available"
                              : "Select destination"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {zones.map((z) => (
                        <SelectItem key={z.id} value={z.id}>
                          {z.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Addresses come from active pricing zones.
                  </p>
                </div>

                <ol className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-3">
                  <li className="flex items-start gap-2.5">
                    <span className="mt-1.5 size-2.5 shrink-0 rounded-full border-2 border-primary" />
                    <div className="min-w-0">
                      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
                        Pickup
                      </p>
                      <p className="text-sm font-medium">
                        {pickup.address || "—"}
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <MapPinIcon className="mt-0.5 size-3.5 shrink-0 text-success" />
                    <div className="min-w-0">
                      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
                        Drop-off
                      </p>
                      <p className="text-sm font-medium">
                        {dropoff.address || "—"}
                      </p>
                    </div>
                  </li>
                </ol>
              </section>

              <Separator />

              <section className="flex flex-col gap-3">
                <SectionLabel icon={CalendarClockIcon}>Trip details</SectionLabel>
                <AdminDateTimeField
                  label="Pickup time"
                  value={pickupDateTime}
                  onChange={setPickupDateTime}
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FactField
                    icon={PlaneIcon}
                    label="Flight"
                    input={
                      <Input
                        className="h-11 text-base md:h-9 md:text-sm"
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
                        inputMode="numeric"
                        className="h-11 text-base md:h-9 md:text-sm"
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
                        inputMode="numeric"
                        className="h-11 text-base md:h-9 md:text-sm"
                        value={luggageCount}
                        onChange={(e) => setLuggageCount(e.target.value)}
                      />
                    }
                  />
                </div>
              </section>

              <Separator />

              <section className="flex flex-col gap-3">
                <SectionLabel icon={PlaneIcon}>Trip options</SectionLabel>
                <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col">
                      <Label className="text-sm text-foreground">Round trip</Label>
                      <span className="text-xs text-muted-foreground">
                        Create a linked return booking automatically.
                      </span>
                    </div>
                    <Switch
                      checked={isRoundTrip}
                      onCheckedChange={setIsRoundTrip}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col">
                      <Label className="text-sm text-foreground">
                        Meet and greet
                      </Label>
                      <span className="text-xs text-muted-foreground">
                        Add airport meet-and-greet to the booking notes.
                      </span>
                    </div>
                    <Switch
                      checked={meetAndGreet}
                      onCheckedChange={setMeetAndGreet}
                    />
                  </div>
                </div>
              </section>

              <Separator />

              <section className="flex flex-col gap-3">
                <SectionLabel icon={PlaneIcon}>Fare</SectionLabel>
                <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-3">
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

                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs text-muted-foreground">Payment</span>
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
                  </div>
                </div>
              </section>
            </div>
          </ScrollArea>

          <div className="border-t p-4">
            <Button onClick={submit} className="w-full">
              Create booking
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

function FactField({
  icon: Icon,
  label,
  input,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  input: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border bg-muted/30 p-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        {input}
      </div>
    </div>
  )
}
