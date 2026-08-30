"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import useSWR from "swr"
import {
  ArmchairIcon,
  BanknoteIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  KeyRoundIcon,
  Loader2Icon,
  MapPinIcon,
  MessageSquareIcon,
  PhoneIcon,
  UsersIcon,
} from "lucide-react"
import { toast } from "sonner"

import { DriverPageHeader } from "@/components/driver/driver-page-header"
import { CopyBookingInfoButton } from "@/components/driver/copy-booking-info-button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { apiPatch, apiPost, fetcher } from "@/lib/api"
import {
  formatDriverDateTime,
  useDriverLocale,
  useDriverT,
  type DriverLocale,
  type DriverMessageKey,
} from "@/lib/i18n/driver"
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
  passengerName: string | null
  passengerPhone: string | null
  contactName: string
  contactPhone: string
  contactWhatsappUrl: string | null
  currency: string
  totalPrice: number
  totalPriceLabel: string
  depositPaid: number
  balanceDue: number
  paymentStatus: PaymentStatus
  cashToCollect: number
  cashToCollectLabel: string
  cashCollected: boolean
  hadOnlineDeposit: boolean
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
}

type Translate = (
  key: DriverMessageKey | string,
  vars?: Record<string, string | number>,
) => string

function plural(
  t: Translate,
  key: string,
  count: number,
  vars?: Record<string, string | number>,
) {
  const resolved = count === 1 ? key : `${key}_other`
  return t(resolved, { count, ...vars })
}

function formatPickupLabel(iso: string, locale: DriverLocale) {
  return formatDriverDateTime(iso, locale)
}

function statusLabel(t: Translate, status: BookingStatus) {
  return t(`status.${status}`)
}

function cashHintLabel(
  t: Translate,
  cashAmount: number,
  paymentStatus: PaymentStatus,
  cashCollected: boolean,
) {
  if (cashAmount <= 0) {
    return cashCollected ? t("cash.collected") : t("cash.nothing")
  }
  if (paymentStatus === "deposit_paid") return t("cash.balance")
  return t("cash.full")
}

export function DriverDashboardView() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const t = useDriverT()

  const focusBookingId =
    searchParams.get("bookingId") ?? searchParams.get("booking")

  const { data: me } = useSWR<{ driver: Driver }>("/api/driver/me", fetcher)
  const { data, isLoading, mutate, error } = useSWR<DashboardPayload>(
    "/api/driver/bookings",
    fetcher,
    { refreshInterval: 15_000 },
  )

  const [pendingId, setPendingId] = React.useState<string | null>(null)
  const [cashOpen, setCashOpen] = React.useState(false)
  const [tab, setTab] = React.useState("today")
  const [rejectTrip, setRejectTrip] = React.useState<DriverTrip | null>(null)
  const [focusedTripId, setFocusedTripId] = React.useState<string | null>(
    focusBookingId,
  )

  React.useEffect(() => {
    if (focusBookingId) setFocusedTripId(focusBookingId)
  }, [focusBookingId])

  const today = data?.today ?? []
  const upcoming = data?.upcoming ?? []
  const history = data?.history ?? []
  const outstanding = data?.outstanding

  React.useEffect(() => {
    if (!focusedTripId || !data) return

    if (today.some((trip) => trip.id === focusedTripId)) {
      setTab("today")
    } else if (upcoming.some((trip) => trip.id === focusedTripId)) {
      setTab("upcoming")
    } else if (history.some((trip) => trip.id === focusedTripId)) {
      setTab("history")
    }
  }, [focusedTripId, data, today, upcoming, history])

  function clearFocusFromUrl() {
    if (!focusBookingId) return
    const params = new URLSearchParams(searchParams.toString())
    params.delete("bookingId")
    params.delete("booking")
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  function clearTripFocus() {
    setFocusedTripId(null)
    clearFocusFromUrl()
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
            ? t("trips.toastArrivedCash")
            : t("trips.toastArrived")
          : t("trips.toastCompleted"),
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
        t("trips.toastCashPaid", { amount: trip.cashToCollectLabel }),
      )
      await mutate()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setPendingId(null)
    }
  }

  async function respond(trip: DriverTrip, action: "accept" | "reject") {
    setPendingId(trip.id)
    try {
      await apiPost(`/api/driver/bookings/${trip.id}/respond`, { action })
      if (action === "reject") setRejectTrip(null)
      toast.success(
        action === "accept" ? t("trips.toastAccepted") : t("trips.toastRejected"),
      )
      await mutate()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setPendingId(null)
    }
  }

  function requestReject(trip: DriverTrip) {
    setRejectTrip(trip)
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <DriverPageHeader
        title={me?.driver.name ?? t("trips.title")}
        description={
          me?.driver.plateNumber
            ? t("trips.plate", { plate: me.driver.plateNumber })
            : t("trips.assigned")
        }
      />

      <div className="flex flex-1 flex-col gap-5 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:gap-6 sm:p-4 md:p-6">
        <Card className="gap-0 py-0">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left touch-manipulation md:cursor-default md:pointer-events-none"
            onClick={() => setCashOpen((open) => !open)}
            aria-expanded={cashOpen}
          >
            <div className="min-w-0">
              <CardTitle className="text-base">{t("trips.cashBalances")}</CardTitle>
              <CardDescription className="mt-0.5">
                {outstanding
                  ? t("trips.cashToCollectSuffix", {
                      amount: outstanding.cashToCollectLabel,
                    })
                  : t("trips.cashBalancesHint")}
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
                    {t("trips.cashToCollect")}
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    {outstanding.cashToCollectLabel}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("trips.readyOnArrived")}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
                    {t("trips.unpaidBalances")}
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    {outstanding.unpaidBalancesLabel}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {plural(t, "trips.unpaidTripCount", outstanding.unpaidTripCount)}
                  </p>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

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
              {(error as Error).message || t("trips.loadError")}
            </CardContent>
          </Card>
        ) : (
          <Tabs
            value={tab}
            onValueChange={setTab}
            className="w-full gap-3"
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="today">
                {t("trips.tabToday")}
                <span className="ml-1 tabular-nums text-muted-foreground">
                  ({today.length})
                </span>
              </TabsTrigger>
              <TabsTrigger value="upcoming">
                {t("trips.tabUpcoming")}
                <span className="ml-1 tabular-nums text-muted-foreground">
                  ({upcoming.length})
                </span>
              </TabsTrigger>
              <TabsTrigger value="history">
                {t("trips.tabHistory")}
                <span className="ml-1 tabular-nums text-muted-foreground">
                  ({history.length})
                </span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="today" className="mt-0">
              <TripList
                empty={t("trips.emptyToday")}
                trips={today}
                pendingId={pendingId}
                focusedTripId={focusedTripId}
                onAdvance={advance}
                onCashPaid={markCashPaid}
                onRespond={respond}
                onRejectRequest={requestReject}
                onFocused={() => clearTripFocus()}
              />
            </TabsContent>
            <TabsContent value="upcoming" className="mt-0">
              <TripList
                empty={t("trips.emptyUpcoming")}
                trips={upcoming}
                pendingId={pendingId}
                focusedTripId={focusedTripId}
                onAdvance={advance}
                onCashPaid={markCashPaid}
                onRespond={respond}
                onRejectRequest={requestReject}
                onFocused={() => clearTripFocus()}
              />
            </TabsContent>
            <TabsContent value="history" className="mt-0">
              <TripList
                empty={t("trips.emptyHistory")}
                trips={history}
                pendingId={pendingId}
                focusedTripId={focusedTripId}
                onAdvance={advance}
                onCashPaid={markCashPaid}
                onRespond={respond}
                onRejectRequest={requestReject}
                onFocused={() => clearTripFocus()}
                readOnly
              />
            </TabsContent>
          </Tabs>
        )}
      </div>

      <AlertDialog
        open={rejectTrip !== null}
        onOpenChange={(open) => {
          if (!open && pendingId === null) setRejectTrip(null)
        }}
      >
        <AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("trips.rejectTitle", {
                code: rejectTrip?.referenceCode ?? "",
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("trips.rejectDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendingId === rejectTrip?.id}>
              {t("trips.keepTrip")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={!rejectTrip || pendingId === rejectTrip.id}
              onClick={(e) => {
                e.preventDefault()
                if (!rejectTrip) return
                void respond(rejectTrip, "reject")
              }}
            >
              {pendingId === rejectTrip?.id ? (
                <>
                  <Loader2Icon
                    className="animate-spin"
                    data-icon="inline-start"
                  />
                  {t("trips.rejecting")}
                </>
              ) : (
                t("trips.rejectTrip")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function TripList({
  empty,
  trips,
  pendingId,
  focusedTripId = null,
  onAdvance,
  onCashPaid,
  onRespond,
  onRejectRequest,
  onFocused,
  readOnly = false,
}: {
  empty: string
  trips: DriverTrip[]
  pendingId: string | null
  focusedTripId?: string | null
  onAdvance: (trip: DriverTrip) => void
  onCashPaid: (trip: DriverTrip) => void
  onRespond: (trip: DriverTrip, action: "accept" | "reject") => void
  onRejectRequest: (trip: DriverTrip) => void
  onFocused?: () => void
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
          focused={focusedTripId === trip.id}
          readOnly={readOnly}
          onAdvance={() => onAdvance(trip)}
          onCashPaid={() => onCashPaid(trip)}
          onAccept={() => onRespond(trip, "accept")}
          onReject={() => onRejectRequest(trip)}
          onFocused={onFocused}
        />
      ))}
    </ul>
  )
}

function TripCard({
  trip,
  pending,
  focused = false,
  readOnly = false,
  onAdvance,
  onCashPaid,
  onAccept,
  onReject,
  onFocused,
}: {
  trip: DriverTrip
  pending: boolean
  focused?: boolean
  readOnly?: boolean
  onAdvance: () => void
  onCashPaid: () => void
  onAccept: () => void
  onReject: () => void
  onFocused?: () => void
}) {
  const t = useDriverT()
  const locale = useDriverLocale()
  const cardRef = React.useRef<HTMLLIElement>(null)
  // Today/Upcoming start expanded; History starts collapsed.
  const [detailsOpen, setDetailsOpen] = React.useState(!readOnly || focused)

  const pickupLabel = formatPickupLabel(trip.pickupDateTime, locale)
  const tripStatus = statusLabel(t, trip.status)
  const hint = cashHintLabel(
    t,
    trip.cashToCollect,
    trip.paymentStatus,
    trip.cashCollected,
  )

  React.useEffect(() => {
    if (!focused) return
    setDetailsOpen(true)
    const timer = window.setTimeout(() => {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      onFocused?.()
    }, 120)
    return () => window.clearTimeout(timer)
  }, [focused, onFocused])

  return (
    <li
      ref={cardRef}
      id={`trip-${trip.id}`}
      className={cn(
        "flex flex-col gap-0 overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow",
        focused && "ring-2 ring-primary shadow-md",
      )}
    >
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 p-4 text-left touch-manipulation"
        onClick={() => {
          setDetailsOpen((open) => !open)
          if (focused) onFocused?.()
        }}
        aria-expanded={detailsOpen}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-sm font-semibold">
              {trip.referenceCode}
            </p>
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
              {tripStatus}
            </span>
            <span className="rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 font-mono text-sm font-bold tracking-wider tabular-nums text-foreground">
              {t("trips.pin", { pin: trip.pickupPin })}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{pickupLabel}</p>
          <p className="mt-1.5 truncate text-sm font-medium">
            {trip.pickupAddress}
            <span className="mx-1.5 text-muted-foreground">→</span>
            {trip.dropoffAddress}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {trip.contactName} · {trip.totalPriceLabel}
            {trip.cashToCollect > 0
              ? ` · ${trip.cashToCollectLabel}`
              : ""}
          </p>
        </div>
        <ChevronDownIcon
          className={cn(
            "mt-0.5 size-5 shrink-0 text-muted-foreground transition-transform",
            detailsOpen && "rotate-180",
          )}
        />
      </button>

      {detailsOpen ? (
        <div className="flex flex-col gap-3 border-t p-4 pt-3">
          <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 px-3 py-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <KeyRoundIcon className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium tracking-wide text-primary uppercase">
                {t("trips.pickupPin")}
              </p>
              <p className="font-mono text-2xl font-bold tracking-[0.2em] tabular-nums text-foreground sm:text-3xl">
                {trip.pickupPin}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 text-sm">
            <div className="flex gap-2">
              <MapPinIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{t("trips.pickup")}</p>
                <p className="break-words font-medium">{trip.pickupAddress}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <MapPinIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{t("trips.dropoff")}</p>
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
              <p className="text-xs text-muted-foreground">{hint}</p>
              <p className="text-base font-semibold tabular-nums">
                {trip.cashToCollectLabel}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {t("trips.tripTotal", { amount: trip.totalPriceLabel })}
                {trip.hadOnlineDeposit
                  ? ` · ${t("trips.depositPaid")}`
                  : ""}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <UsersIcon className="size-3.5" />
              {t("trips.paxBags", {
                pax: trip.passengerCount,
                bags: trip.luggageCount,
              })}
            </span>
            {trip.flightNumber ? (
              <span>{t("trips.flight", { flight: trip.flightNumber })}</span>
            ) : null}
            {trip.meetAndGreet ? <span>{t("trips.meetGreet")}</span> : null}
          </div>

          {trip.contactPhone ? (
            <div className="flex flex-wrap gap-2">
              <a
                href={`tel:${trip.contactPhone}`}
                aria-label={t("trips.callPassenger")}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "h-9 flex-1 touch-manipulation sm:flex-none",
                )}
              >
                <PhoneIcon data-icon="inline-start" />
                {t("trips.phone")}
              </a>
              {trip.contactWhatsappUrl ? (
                <a
                  href={trip.contactWhatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t("trips.whatsappPassenger")}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "h-9 flex-1 touch-manipulation sm:flex-none",
                  )}
                >
                  <MessageSquareIcon data-icon="inline-start" />
                  {t("trips.whatsapp")}
                </a>
              ) : null}
            </div>
          ) : null}

          <CopyBookingInfoButton trip={trip} className="w-full sm:w-auto" />

          {trip.childSeats || trip.driverNotes ? (
            <div className="flex flex-col gap-2">
              {trip.childSeats ? (
                <div className="flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2">
                  <ArmchairIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {t("trips.childSeats")}
                    </p>
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
                      {t("trips.passengerComment")}
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
                    {t("trips.needsResponse")}
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
                          {t("trips.updating")}
                        </>
                      ) : (
                        t("trips.accept")
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
                      {t("trips.reject")}
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
                      {t("trips.updating")}
                    </>
                  ) : (
                    <>
                      <BanknoteIcon data-icon="inline-start" />
                      {t("trips.cashPaid")}
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
                      {t("trips.updating")}
                    </>
                  ) : trip.nextStatus === "arrived" ? (
                    t("trips.markArrived")
                  ) : (
                    t("trips.markCompleted")
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
