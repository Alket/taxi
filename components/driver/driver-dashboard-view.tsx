"use client"

import * as React from "react"
import useSWR from "swr"
import {
  ArmchairIcon,
  BanknoteIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  Loader2Icon,
  MapPinIcon,
  MessageSquareIcon,
  TrendingUpIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react"
import { toast } from "sonner"

import { DriverPageHeader } from "@/components/driver/driver-page-header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { apiPatch, apiPost, fetcher } from "@/lib/api"
import type { BookingStatus, Driver, PaymentStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

type DriverTrip = {
  id: string
  referenceCode: string
  pickupPin: string
  pickupAddress: string
  dropoffAddress: string
  pickupDateTime: string
  pickupLabel: string
  passengerCount: number
  luggageCount: number
  flightNumber: string | null
  childSeats: string | null
  driverNotes: string | null
  meetAndGreet: boolean
  status: BookingStatus
  statusLabel: string
  customerName: string
  customerPhone: string
  currency: string
  totalPrice: number
  totalPriceLabel: string
  depositPaid: number
  balanceDue: number
  paymentStatus: PaymentStatus
  cashToCollect: number
  cashToCollectLabel: string
  cashHint: string
  canMarkCashPaid: boolean
  needsResponse: boolean
  nextStatus: "arrived" | "completed" | null
  nextStatusLabel: string | null
}

type DashboardPayload = {
  today: DriverTrip[]
  upcoming: DriverTrip[]
  history: DriverTrip[]
  outstanding: {
    cashToCollect: number
    cashToCollectLabel: string
    unpaidBalances: number
    unpaidBalancesLabel: string
    unpaidTripCount: number
  }
  revenue: {
    year: number
    month: number
    monthLabel: string
    completedTrips: number
    total: number
    totalLabel: string
    cashCollected: number
    cashCollectedLabel: string
    currency: string
  }
}

function monthOptions(from: Date, count = 12) {
  const options: { value: string; label: string; year: number; month: number }[] =
    []
  for (let i = 0; i < count; i++) {
    const d = new Date(from.getFullYear(), from.getMonth() - i, 1)
    const year = d.getFullYear()
    const month = d.getMonth() + 1
    options.push({
      value: `${year}-${month}`,
      year,
      month,
      label: new Intl.DateTimeFormat("en-GB", {
        month: "long",
        year: "numeric",
      }).format(d),
    })
  }
  return options
}

export function DriverDashboardView() {
  const now = React.useMemo(() => new Date(), [])
  const months = React.useMemo(() => monthOptions(now), [now])
  const [monthKey, setMonthKey] = React.useState(
    `${now.getFullYear()}-${now.getMonth() + 1}`,
  )
  const selected = months.find((m) => m.value === monthKey) ?? months[0]!

  const { data: me } = useSWR<{ driver: Driver }>("/api/driver/me", fetcher)
  const { data, isLoading, mutate, error } = useSWR<DashboardPayload>(
    `/api/driver/bookings?year=${selected.year}&month=${selected.month}`,
    fetcher,
    { refreshInterval: 15_000 },
  )

  const [pendingId, setPendingId] = React.useState<string | null>(null)
  const [cashOpen, setCashOpen] = React.useState(false)
  const [revenueOpen, setRevenueOpen] = React.useState(false)

  async function advance(trip: DriverTrip) {
    if (!trip.nextStatus) return
    setPendingId(trip.id)
    try {
      await apiPatch(`/api/driver/bookings/${trip.id}/status`, {
        status: trip.nextStatus,
      })
      toast.success(
        trip.nextStatus === "arrived"
          ? trip.cashToCollect > 0
            ? "Marked Arrived — collect cash, then confirm Cash Paid."
            : "Marked Arrived — passenger on board."
          : "Trip completed.",
      )
      await mutate()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setPendingId(null)
    }
  }

  async function markCashPaid(trip: DriverTrip) {
    setPendingId(trip.id)
    try {
      await apiPost(`/api/driver/bookings/${trip.id}/cash-paid`)
      toast.success(
        `Cash paid recorded — ${trip.cashToCollectLabel}. You can mark the trip completed.`,
      )
      await mutate()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setPendingId(null)
    }
  }

  async function respond(trip: DriverTrip, action: "accept" | "reject") {
    if (action === "reject") {
      const ok = window.confirm(
        `Reject trip ${trip.referenceCode}? It will go back to ops for reassignment.`,
      )
      if (!ok) return
    }

    setPendingId(trip.id)
    try {
      await apiPost(`/api/driver/bookings/${trip.id}/respond`, { action })
      toast.success(
        action === "accept"
          ? "Trip accepted. You can mark Arrived when you are there."
          : "Trip rejected. Ops can assign another driver.",
      )
      await mutate()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setPendingId(null)
    }
  }

  const today = data?.today ?? []
  const upcoming = data?.upcoming ?? []
  const history = data?.history ?? []
  const outstanding = data?.outstanding
  const revenue = data?.revenue

  return (
    <div className="flex min-h-dvh flex-col">
      <DriverPageHeader
        title={me?.driver.name ?? "Trips"}
        description={
          me?.driver.plateNumber
            ? `Plate ${me.driver.plateNumber}`
            : "Your assigned transfers"
        }
      />

      <div className="flex flex-1 flex-col gap-5 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:gap-6 sm:p-4 md:p-6">
        <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
          <Card className="gap-0 py-0">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left touch-manipulation md:cursor-default md:pointer-events-none"
              onClick={() => setCashOpen((open) => !open)}
              aria-expanded={cashOpen}
            >
              <div className="min-w-0">
                <CardTitle className="text-base">Cash & balances</CardTitle>
                <CardDescription className="mt-0.5">
                  {outstanding
                    ? `${outstanding.cashToCollectLabel} to collect`
                    : "What you need to collect now"}
                </CardDescription>
              </div>
              <ChevronDownIcon
                className={cn(
                  "size-5 shrink-0 text-muted-foreground transition-transform md:hidden",
                  cashOpen && "rotate-180",
                )}
              />
            </button>
            <CardContent
              className={cn(
                "border-t px-4 pb-4 pt-3",
                cashOpen ? "block" : "hidden md:block",
              )}
            >
              {isLoading && !outstanding ? (
                <Skeleton className="h-20 w-full" />
              ) : outstanding ? (
                <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                  <div className="rounded-lg border bg-amber-500/5 p-3">
                    <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
                      Cash to collect
                    </p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                      {outstanding.cashToCollectLabel}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Ready on arrived trips
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
                      Unpaid balances
                    </p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                      {outstanding.unpaidBalancesLabel}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {outstanding.unpaidTripCount} active trip
                      {outstanding.unpaidTripCount === 1 ? "" : "s"} with cash due
                    </p>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <div className="flex items-center gap-2 px-4 py-3">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left touch-manipulation md:cursor-default md:pointer-events-none"
                onClick={() => setRevenueOpen((open) => !open)}
                aria-expanded={revenueOpen}
              >
                <div className="min-w-0">
                  <CardTitle className="text-base">Revenue this month</CardTitle>
                  <CardDescription className="mt-0.5">
                    {revenue
                      ? `${revenue.totalLabel} · ${revenue.completedTrips} trip${revenue.completedTrips === 1 ? "" : "s"}`
                      : "Completed trip totals"}
                  </CardDescription>
                </div>
                <ChevronDownIcon
                  className={cn(
                    "size-5 shrink-0 text-muted-foreground transition-transform md:hidden",
                    revenueOpen && "rotate-180",
                  )}
                />
              </button>
              <Select
                value={monthKey}
                onValueChange={(value) => {
                  if (value) setMonthKey(value)
                }}
              >
                <SelectTrigger size="sm" className="hidden w-[11.5rem] shrink-0 md:flex">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <CardContent
              className={cn(
                "border-t px-4 pb-4 pt-3",
                revenueOpen ? "block" : "hidden md:block",
              )}
            >
              <div className="mb-3 md:hidden">
                <Select
                  value={monthKey}
                  onValueChange={(value) => {
                    if (value) setMonthKey(value)
                  }}
                >
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isLoading && !revenue ? (
                <Skeleton className="h-20 w-full" />
              ) : revenue ? (
                <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
                        Trip totals
                      </p>
                      <TrendingUpIcon className="size-4 text-primary" />
                    </div>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                      {revenue.totalLabel}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {revenue.completedTrips} completed trip
                      {revenue.completedTrips === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
                        Cash collected
                      </p>
                      <WalletIcon className="size-4 text-muted-foreground" />
                    </div>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                      {revenue.cashCollectedLabel}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      From completed trips
                    </p>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {isLoading &&
        today.length === 0 &&
        upcoming.length === 0 &&
        history.length === 0 ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        ) : error ? (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="pt-6 text-sm text-destructive">
              {(error as Error).message || "Could not load trips."}
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="today" className="w-full gap-3">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="today">
                Today
                <span className="ml-1 tabular-nums text-muted-foreground">
                  ({today.length})
                </span>
              </TabsTrigger>
              <TabsTrigger value="upcoming">
                Upcoming
                <span className="ml-1 tabular-nums text-muted-foreground">
                  ({upcoming.length})
                </span>
              </TabsTrigger>
              <TabsTrigger value="history">
                History
                <span className="ml-1 tabular-nums text-muted-foreground">
                  ({history.length})
                </span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="today" className="mt-0">
              <TripList
                empty="No trips scheduled for today."
                trips={today}
                pendingId={pendingId}
                onAdvance={advance}
                onCashPaid={markCashPaid}
                onRespond={respond}
              />
            </TabsContent>
            <TabsContent value="upcoming" className="mt-0">
              <TripList
                empty="No upcoming trips after today."
                trips={upcoming}
                pendingId={pendingId}
                onAdvance={advance}
                onCashPaid={markCashPaid}
                onRespond={respond}
              />
            </TabsContent>
            <TabsContent value="history" className="mt-0">
              <TripList
                empty="No past trips yet."
                trips={history}
                pendingId={pendingId}
                onAdvance={advance}
                onCashPaid={markCashPaid}
                onRespond={respond}
                readOnly
              />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  )
}

function TripList({
  empty,
  trips,
  pendingId,
  onAdvance,
  onCashPaid,
  onRespond,
  readOnly = false,
}: {
  empty: string
  trips: DriverTrip[]
  pendingId: string | null
  onAdvance: (trip: DriverTrip) => void
  onCashPaid: (trip: DriverTrip) => void
  onRespond: (trip: DriverTrip, action: "accept" | "reject") => void
  readOnly?: boolean
}) {
  if (trips.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center">
        <CheckCircle2Icon className="mx-auto size-7 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      </div>
    )
  }

  return (
    <ul className="grid gap-3 xl:grid-cols-2">
      {trips.map((trip) => (
        <TripCard
          key={trip.id}
          trip={trip}
          pending={pendingId === trip.id}
          readOnly={readOnly}
          onAdvance={() => onAdvance(trip)}
          onCashPaid={() => onCashPaid(trip)}
          onAccept={() => onRespond(trip, "accept")}
          onReject={() => onRespond(trip, "reject")}
        />
      ))}
    </ul>
  )
}

function TripCard({
  trip,
  pending,
  readOnly = false,
  onAdvance,
  onCashPaid,
  onAccept,
  onReject,
}: {
  trip: DriverTrip
  pending: boolean
  readOnly?: boolean
  onAdvance: () => void
  onCashPaid: () => void
  onAccept: () => void
  onReject: () => void
}) {
  const [detailsOpen, setDetailsOpen] = React.useState(false)
  const showDetails = !readOnly || detailsOpen

  return (
    <li className="flex flex-col gap-0 overflow-hidden rounded-xl border bg-card shadow-sm">
      {readOnly ? (
        <button
          type="button"
          className="flex w-full items-start justify-between gap-3 p-4 text-left touch-manipulation"
          onClick={() => setDetailsOpen((open) => !open)}
          aria-expanded={detailsOpen}
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-sm font-semibold">
                {trip.referenceCode}
              </p>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
                {trip.statusLabel}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {trip.pickupLabel}
            </p>
            <p className="mt-1.5 truncate text-sm font-medium">
              {trip.pickupAddress}
              <span className="mx-1.5 text-muted-foreground">→</span>
              {trip.dropoffAddress}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {trip.customerName} · {trip.totalPriceLabel}
            </p>
          </div>
          <ChevronDownIcon
            className={cn(
              "mt-0.5 size-5 shrink-0 text-muted-foreground transition-transform",
              detailsOpen && "rotate-180",
            )}
          />
        </button>
      ) : (
        <div className="flex items-start justify-between gap-2 p-4 pb-0">
          <div>
            <p className="font-mono text-sm font-semibold">
              {trip.referenceCode}
            </p>
            <p className="text-xs text-muted-foreground">{trip.pickupLabel}</p>
          </div>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
            {trip.statusLabel}
          </span>
        </div>
      )}

      {showDetails ? (
        <div
          className={cn(
            "flex flex-col gap-3 p-4",
            readOnly && "border-t pt-3",
            !readOnly && "pt-3",
          )}
        >
          <div className="flex flex-col gap-1.5 text-sm">
            <div className="flex gap-2">
              <MapPinIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Pickup</p>
                <p className="break-words font-medium">{trip.pickupAddress}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <MapPinIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Drop-off</p>
                <p className="break-words font-medium">{trip.dropoffAddress}</p>
              </div>
            </div>
          </div>

          <div
            className={
              trip.cashToCollect > 0
                ? "flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2"
                : "flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2"
            }
          >
            <BanknoteIcon className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{trip.cashHint}</p>
              <p className="text-base font-semibold tabular-nums">
                {trip.cashToCollectLabel}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Trip total {trip.totalPriceLabel}
                {trip.depositPaid > 0 ? ` · Deposit paid online` : ""}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <UsersIcon className="size-3.5" />
              {trip.passengerCount} pax · {trip.luggageCount} bags
            </span>
            <span>PIN {trip.pickupPin}</span>
            {trip.flightNumber ? <span>Flight {trip.flightNumber}</span> : null}
            {trip.meetAndGreet ? <span>Meet & greet</span> : null}
            <span>{trip.customerName}</span>
          </div>

          {trip.childSeats || trip.driverNotes ? (
            <div className="flex flex-col gap-2">
              {trip.childSeats ? (
                <div className="flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2">
                  <ArmchairIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Child seats</p>
                    <p className="text-sm font-medium break-words">
                      {trip.childSeats}
                    </p>
                  </div>
                </div>
              ) : null}
              {trip.driverNotes ? (
                <div className="flex items-start gap-2 rounded-lg border border-sky-500/25 bg-sky-500/10 px-3 py-2">
                  <MessageSquareIcon className="mt-0.5 size-4 shrink-0 text-sky-700 dark:text-sky-300" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      Passenger comment
                    </p>
                    <p className="text-sm font-medium break-words">
                      {trip.driverNotes}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {!readOnly ? (
            <div className="mt-auto flex flex-col gap-2">
              {trip.needsResponse ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    Ops assigned this trip — accept to continue, or reject to send
                    it back.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      size="lg"
                      className="w-full"
                      disabled={pending}
                      onClick={onAccept}
                    >
                      {pending ? (
                        <>
                          <Loader2Icon
                            className="animate-spin"
                            data-icon="inline-start"
                          />
                          Updating…
                        </>
                      ) : (
                        "Accept"
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      className="w-full"
                      disabled={pending}
                      onClick={onReject}
                    >
                      Reject
                    </Button>
                  </div>
                </>
              ) : null}

              {!trip.needsResponse && trip.canMarkCashPaid ? (
                <Button
                  type="button"
                  size="lg"
                  className="w-full"
                  disabled={pending}
                  onClick={onCashPaid}
                >
                  {pending ? (
                    <>
                      <Loader2Icon
                        className="animate-spin"
                        data-icon="inline-start"
                      />
                      Updating…
                    </>
                  ) : (
                    <>
                      <BanknoteIcon data-icon="inline-start" />
                      Cash Paid
                    </>
                  )}
                </Button>
              ) : null}

              {!trip.needsResponse && trip.nextStatus ? (
                <Button
                  type="button"
                  size="lg"
                  variant={trip.canMarkCashPaid ? "outline" : "default"}
                  className="w-full"
                  disabled={pending}
                  onClick={onAdvance}
                >
                  {pending ? (
                    <>
                      <Loader2Icon
                        className="animate-spin"
                        data-icon="inline-start"
                      />
                      Updating…
                    </>
                  ) : trip.nextStatus === "arrived" ? (
                    "Mark Arrived"
                  ) : (
                    "Mark Completed"
                  )}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}
