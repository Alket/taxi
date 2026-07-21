"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import {
  ArmchairIcon,
  BanknoteIcon,
  BarChart3Icon,
  CheckCircle2Icon,
  Loader2Icon,
  LogOutIcon,
  MapPinIcon,
  MessageSquareIcon,
  UsersIcon,
} from "lucide-react"
import { toast } from "sonner"

import { apiPatch, apiPost, fetcher } from "@/lib/api"
import type { BookingStatus, Driver, PaymentStatus } from "@/lib/types"
import { AdminThemeToggle } from "@/components/admin/theme-toggle"
import { StaffNotificationManager } from "@/components/admin/staff-notifications"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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

export default function DriverDashboardPage() {
  const router = useRouter()
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

  async function logout() {
    await apiPost("/api/driver/logout").catch(() => {})
    router.push("/driver/login")
    router.refresh()
  }

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
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 py-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Driver dashboard
          </p>
          <h1 className="text-xl font-semibold tracking-tight">
            {me?.driver.name ?? "Your trips"}
          </h1>
          {me?.driver.plateNumber ? (
            <p className="font-mono text-xs text-muted-foreground">
              {me.driver.plateNumber}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 touch-manipulation sm:h-8"
            nativeButton={false}
            render={<Link href="/driver/analytics" />}
          >
            <BarChart3Icon data-icon="inline-start" />
            Analytics
          </Button>
          <StaffNotificationManager audience="driver" />
          <AdminThemeToggle />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 touch-manipulation sm:h-8"
            onClick={() => void logout()}
          >
            <LogOutIcon data-icon="inline-start" />
            Log out
          </Button>
        </div>
      </header>

      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Cash & balances</h2>
        {isLoading && !outstanding ? (
          <Skeleton className="mt-3 h-14 w-full" />
        ) : outstanding ? (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
                Cash to collect
              </p>
              <p className="text-xl font-semibold tabular-nums">
                {outstanding.cashToCollectLabel}
              </p>
              <p className="text-xs text-muted-foreground">
                Ready on arrived trips
              </p>
            </div>
            <div>
              <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
                Balances / unpaid fares
              </p>
              <p className="text-xl font-semibold tabular-nums">
                {outstanding.unpaidBalancesLabel}
              </p>
              <p className="text-xs text-muted-foreground">
                {outstanding.unpaidTripCount} active trip
                {outstanding.unpaidTripCount === 1 ? "" : "s"} with cash due
              </p>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Revenue this month</h2>
          <div className="flex items-center gap-2">
            <Select
              value={monthKey}
              onValueChange={(value) => {
                if (value) setMonthKey(value)
              }}
            >
              <SelectTrigger size="sm" className="w-[11.5rem]">
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
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs text-muted-foreground"
              nativeButton={false}
              render={<Link href="/driver/analytics" />}
            >
              Details
            </Button>
          </div>
        </div>
        {isLoading && !revenue ? (
          <Skeleton className="mt-3 h-14 w-full" />
        ) : revenue ? (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
                Trip totals
              </p>
              <p className="text-xl font-semibold tabular-nums">
                {revenue.totalLabel}
              </p>
              <p className="text-xs text-muted-foreground">
                {revenue.completedTrips} completed trip
                {revenue.completedTrips === 1 ? "" : "s"}
              </p>
            </div>
            <div>
              <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
                Cash collected
              </p>
              <p className="text-xl font-semibold tabular-nums">
                {revenue.cashCollectedLabel}
              </p>
              <p className="text-xs text-muted-foreground">
                From completed trips
              </p>
            </div>
          </div>
        ) : null}
      </section>

      {isLoading &&
      today.length === 0 &&
      upcoming.length === 0 &&
      history.length === 0 ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {(error as Error).message || "Could not load trips."}
        </div>
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
      <div className="rounded-xl border border-dashed p-6 text-center">
        <CheckCircle2Icon className="mx-auto size-7 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-3">
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
  return (
    <li className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-sm font-semibold">{trip.referenceCode}</p>
          <p className="text-xs text-muted-foreground">{trip.pickupLabel}</p>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
          {trip.statusLabel}
        </span>
      </div>

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
                <p className="text-xs text-muted-foreground">Passenger comment</p>
                <p className="text-sm font-medium break-words">
                  {trip.driverNotes}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {!readOnly ? (
        <div className="flex flex-col gap-2">
          {trip.needsResponse ? (
            <>
              <p className="text-xs text-muted-foreground">
                Ops assigned this trip — accept to continue, or reject to send it
                back.
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
    </li>
  )
}
