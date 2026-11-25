"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import useSWR from "swr"
import {
  AlertCircleIcon,
  ArmchairIcon,
  BanknoteIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ClockIcon,
  KeyRoundIcon,
  Loader2Icon,
  MapPinIcon,
  MessageSquareIcon,
  PlaneIcon,
  RefreshCwIcon,
  SparklesIcon,
  UserIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react"
import { toast } from "sonner"

import { DriverPageHeader } from "@/components/driver/driver-page-header"
import { DriverContactShareBlock } from "@/components/driver/copy-booking-info-button"
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
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { apiPatch, apiPost, fetcher } from "@/lib/api"
import { formatMoney } from "@/lib/format"
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
  platformCommissionLabel?: string | null
  driverKeepsLabel?: string | null
  depositPaid: number
  balanceDue: number
  paymentStatus: PaymentStatus
  cashToCollect: number
  cashToCollectLabel: string
  cashCollected: boolean
  cashCollectedAmount: number
  cashCollectedAmountLabel: string
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

function statusBadgeClass(status: BookingStatus) {
  switch (status) {
    case "driver_assigned":
      return "border-amber-500/30 bg-amber-500/12 text-amber-800 dark:text-amber-300"
    case "driver_accepted":
    case "confirmed":
    case "en_route":
      return "border-sky-500/30 bg-sky-500/12 text-sky-800 dark:text-sky-300"
    case "arrived":
    case "in_progress":
      return "border-primary/30 bg-primary/12 text-primary"
    case "completed":
      return "border-emerald-500/30 bg-emerald-500/12 text-emerald-800 dark:text-emerald-300"
    case "cancelled":
      return "border-destructive/30 bg-destructive/10 text-destructive"
    default:
      return "border-border bg-muted text-muted-foreground"
  }
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
  const { data, isLoading, isValidating, mutate, error } =
    useSWR<DashboardPayload>("/api/driver/bookings", fetcher, {
      refreshInterval: 15_000,
    })

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
  const todayNeedsAction = today.some((trip) => trip.needsResponse)
  const upcomingNeedsAction = upcoming.some((trip) => trip.needsResponse)

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
      const res = await apiPost<{
        ok: boolean
        alreadyRecorded?: boolean
        repaired?: boolean
        amount?: number
      }>(`/api/driver/bookings/${trip.id}/cash-paid`)
      if (res.repaired) {
        toast.success(t("trips.toastCashPaidRepaired"))
      } else if (res.alreadyRecorded) {
        toast.success(t("trips.toastCashPaidAlready"))
      } else {
        toast.success(
          t("trips.toastCashPaid", {
            amount:
              res.amount != null && res.amount > 0
                ? formatMoney(res.amount, trip.currency)
                : trip.cashToCollectLabel,
          }),
        )
      }
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

  const hasCashReady = (outstanding?.cashToCollect ?? 0) > 0

  return (
    <div className="flex min-h-dvh flex-col">
      <DriverPageHeader
        title={me?.driver.name ?? t("trips.title")}
        description={
          me?.driver.plateNumber
            ? t("trips.plate", { plate: me.driver.plateNumber })
            : t("trips.assigned")
        }
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void mutate()}
            disabled={isValidating}
            className="gap-1.5"
          >
            <RefreshCwIcon
              className={cn("size-3.5", isValidating && "animate-spin")}
              aria-hidden
            />
            <span>{t("trips.refresh")}</span>
          </Button>
        }
      />

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 p-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:gap-6 sm:p-4 md:p-6">
        <Card className="gap-0 overflow-hidden border-border/80 py-0 shadow-xs">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/30 touch-manipulation md:pointer-events-none md:cursor-default md:hover:bg-transparent"
            onClick={() => setCashOpen((open) => !open)}
            aria-expanded={cashOpen}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg border",
                  hasCashReady
                    ? "border-amber-500/30 bg-amber-500/12 text-amber-700 dark:text-amber-300"
                    : "border-border bg-muted/60 text-muted-foreground",
                )}
              >
                <WalletIcon className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <CardTitle className="text-sm font-semibold sm:text-base">
                  {t("trips.cashBalances")}
                </CardTitle>
                <CardDescription className="mt-0.5 text-xs sm:text-sm">
                  {outstanding
                    ? t("trips.cashToCollectSuffix", {
                        amount: outstanding.cashToCollectLabel,
                      })
                    : t("trips.cashBalancesHint")}
                </CardDescription>
              </div>
            </div>
            <ChevronDownIcon
              className={cn(
                "size-5 shrink-0 text-muted-foreground transition-transform duration-200 md:hidden",
                cashOpen && "rotate-180",
              )}
              aria-hidden
            />
          </button>
          <CardContent
            className={cn(
              "border-t border-border/70 px-4 pt-3.5 pb-4",
              cashOpen ? "block" : "hidden md:block",
            )}
          >
            {isLoading && !outstanding ? (
              <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-xl" />
              </div>
            ) : outstanding ? (
              <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                <div
                  className={cn(
                    "flex items-start justify-between gap-3 rounded-xl border p-3.5 transition-colors",
                    hasCashReady
                      ? "border-amber-500/30 bg-amber-500/[0.07]"
                      : "border-border/80 bg-muted/25",
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                      {t("trips.cashToCollect")}
                    </p>
                    <p className="mt-1.5 text-2xl font-bold tracking-tight tabular-nums text-foreground">
                      {outstanding.cashToCollectLabel}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("trips.readyOnArrived")}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg",
                      hasCashReady
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <BanknoteIcon className="size-4.5" aria-hidden />
                  </span>
                </div>

                <div className="flex items-start justify-between gap-3 rounded-xl border border-border/80 bg-muted/25 p-3.5">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                      {t("trips.unpaidBalances")}
                    </p>
                    <p className="mt-1.5 text-2xl font-bold tracking-tight tabular-nums text-foreground">
                      {outstanding.unpaidBalancesLabel}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {plural(
                        t,
                        "trips.unpaidTripCount",
                        outstanding.unpaidTripCount,
                      )}
                    </p>
                  </div>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <WalletIcon className="size-4.5" aria-hidden />
                  </span>
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
            <Skeleton className="h-11 w-full rounded-xl" />
            <div className="grid gap-3 xl:grid-cols-2">
              <Skeleton className="h-36 w-full rounded-xl" />
              <Skeleton className="h-36 w-full rounded-xl" />
            </div>
          </div>
        ) : error ? (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="flex flex-col items-start justify-between gap-3 py-5 sm:flex-row sm:items-center">
              <div className="flex items-start gap-2.5 text-sm text-destructive">
                <AlertCircleIcon
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden
                />
                <span>{(error as Error).message || t("trips.loadError")}</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void mutate()}
              >
                {t("trips.retry")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={tab} onValueChange={setTab} className="w-full gap-4">
            <TabsList className="grid h-11 w-full grid-cols-3 p-1">
              <TabsTrigger value="today" className="gap-1.5 text-sm">
                <span>{t("trips.tabToday")}</span>
                <span
                  className={cn(
                    "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                    todayNeedsAction
                      ? "bg-amber-500/20 text-amber-800 dark:text-amber-300"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {today.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="upcoming" className="gap-1.5 text-sm">
                <span>{t("trips.tabUpcoming")}</span>
                <span
                  className={cn(
                    "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                    upcomingNeedsAction
                      ? "bg-amber-500/20 text-amber-800 dark:text-amber-300"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {upcoming.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-1.5 text-sm">
                <span>{t("trips.tabHistory")}</span>
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                  {history.length}
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
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/50 px-6 py-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted/70 text-muted-foreground">
          <CheckCircle2Icon className="size-6" aria-hidden />
        </span>
        <p className="mt-3 text-sm font-medium text-muted-foreground">{empty}</p>
      </div>
    )
  }

  return (
    <ul className="grid gap-3.5 xl:grid-cols-2">
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
  // Collapsed by default; open when opened from a notification (?bookingId=).
  const [detailsOpen, setDetailsOpen] = React.useState(Boolean(focused))

  const pickupLabel = formatPickupLabel(trip.pickupDateTime, locale)
  const tripStatus = statusLabel(t, trip.status)
  const hint = cashHintLabel(
    t,
    trip.cashToCollect,
    trip.paymentStatus,
    trip.cashCollected,
  )
  const cashAmountLabel =
    trip.cashCollected && trip.cashToCollect <= 0
      ? trip.cashCollectedAmountLabel
      : trip.cashToCollectLabel

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
        "flex flex-col gap-0 overflow-hidden rounded-2xl border bg-card shadow-xs transition-all",
        trip.needsResponse && !readOnly
          ? "border-amber-500/45 shadow-sm"
          : "border-border/80 hover:border-border",
        focused && "ring-2 ring-primary shadow-md",
      )}
    >
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 p-4 text-left transition-colors hover:bg-muted/25 touch-manipulation"
        onClick={() => {
          setDetailsOpen((open) => !open)
          if (focused) onFocused?.()
        }}
        aria-expanded={detailsOpen}
      >
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <ClockIcon
                className="size-3.5 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span>{pickupLabel}</span>
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                statusBadgeClass(trip.status),
              )}
            >
              {tripStatus}
            </span>
            <span className="rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold tracking-wider tabular-nums text-foreground">
              {t("trips.pin", { pin: trip.pickupPin })}
            </span>
          </div>

          <div className="flex items-baseline gap-1.5 text-sm font-medium text-foreground">
            <span className="truncate">{trip.pickupAddress}</span>
            <span className="shrink-0 text-muted-foreground" aria-hidden>
              →
            </span>
            <span className="truncate">{trip.dropoffAddress}</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
            <span className="font-mono font-medium text-foreground/80">
              {trip.referenceCode}
            </span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <UserIcon className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{trip.contactName}</span>
            </span>
            <span aria-hidden>·</span>
            <span className="font-semibold tabular-nums text-foreground">
              {trip.totalPriceLabel}
            </span>
            {trip.cashToCollect > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/12 px-2 py-0.5 font-semibold tabular-nums text-amber-800 dark:text-amber-300">
                <BanknoteIcon className="size-3 shrink-0" aria-hidden />
                {trip.cashToCollectLabel}
              </span>
            ) : null}
          </div>
        </div>
        <ChevronDownIcon
          className={cn(
            "mt-0.5 size-5 shrink-0 text-muted-foreground transition-transform duration-200",
            detailsOpen && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {detailsOpen ? (
        <div className="flex flex-col gap-3.5 border-t border-border/70 p-4 pt-3.5">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/[0.07] px-3.5 py-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <KeyRoundIcon className="size-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold tracking-wider text-primary uppercase">
                  {t("trips.pickupPin")}
                </p>
                <p className="font-mono text-2xl font-bold tracking-[0.18em] tabular-nums text-foreground">
                  {trip.pickupPin}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] px-3.5 py-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                <BanknoteIcon className="size-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold tracking-wider text-emerald-700 uppercase dark:text-emerald-300">
                  {t("trips.tripTotalLabel")}
                </p>
                <p className="text-2xl font-bold tabular-nums text-foreground">
                  {trip.totalPriceLabel}
                </p>
                {trip.hadOnlineDeposit ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t("trips.depositPaid")}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <ol className="flex flex-col gap-2.5 rounded-xl border border-border/70 bg-muted/20 p-3.5 text-sm">
            <li className="flex gap-3">
              <div className="flex flex-col items-center pt-1.5">
                <span className="size-2.5 rounded-full border-2 border-primary bg-background" />
                <span className="my-1 w-0.5 flex-1 bg-border" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("trips.pickup")}
                </p>
                <p className="break-words font-medium text-foreground">
                  {trip.pickupAddress}
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <div className="flex flex-col items-center pt-1">
                <MapPinIcon
                  className="size-3.5 text-emerald-600 dark:text-emerald-400"
                  aria-hidden
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("trips.dropoff")}
                </p>
                <p className="break-words font-medium text-foreground">
                  {trip.dropoffAddress}
                </p>
              </div>
            </li>
          </ol>

          <div
            className={cn(
              "flex items-center gap-3 rounded-xl border px-3.5 py-2.5",
              trip.cashToCollect > 0
                ? "border-amber-500/30 bg-amber-500/10"
                : trip.cashCollected
                  ? "border-emerald-500/30 bg-emerald-500/10"
                  : "border-border/80 bg-muted/35",
            )}
          >
            <BanknoteIcon
              className={cn(
                "size-4.5 shrink-0",
                trip.cashToCollect > 0
                  ? "text-amber-700 dark:text-amber-300"
                  : trip.cashCollected
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-muted-foreground",
              )}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">{hint}</p>
              <p className="text-base font-semibold tabular-nums text-foreground">
                {cashAmountLabel}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/40 px-2.5 py-1 font-medium text-foreground">
              <UsersIcon
                className="size-3.5 text-muted-foreground"
                aria-hidden
              />
              {t("trips.paxBags", {
                pax: trip.passengerCount,
                bags: trip.luggageCount,
              })}
            </span>
            {trip.flightNumber ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/40 px-2.5 py-1 font-mono font-medium text-foreground">
                <PlaneIcon
                  className="size-3.5 text-muted-foreground"
                  aria-hidden
                />
                {t("trips.flight", { flight: trip.flightNumber })}
              </span>
            ) : null}
            {trip.meetAndGreet ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/10 px-2.5 py-1 font-medium text-primary">
                <SparklesIcon className="size-3.5" aria-hidden />
                {t("trips.meetGreet")}
              </span>
            ) : null}
          </div>

          {trip.childSeats || trip.driverNotes ? (
            <div className="flex flex-col gap-2">
              {trip.childSeats ? (
                <div className="flex items-start gap-2.5 rounded-xl border border-border/70 bg-muted/35 px-3.5 py-2.5">
                  <ArmchairIcon
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">
                      {t("trips.childSeats")}
                    </p>
                    <p className="text-sm font-medium break-words text-foreground">
                      {trip.childSeats}
                    </p>
                  </div>
                </div>
              ) : null}
              {trip.driverNotes ? (
                <div className="flex items-start gap-2.5 rounded-xl border border-sky-500/25 bg-sky-500/10 px-3.5 py-2.5">
                  <MessageSquareIcon
                    className="mt-0.5 size-4 shrink-0 text-sky-700 dark:text-sky-300"
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">
                      {t("trips.passengerComment")}
                    </p>
                    <p className="text-sm font-medium break-words text-foreground">
                      {trip.driverNotes}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <DriverContactShareBlock trip={trip} />

          {!readOnly &&
          (trip.needsResponse ||
            trip.canMarkCashPaid ||
            trip.nextStatus) ? (
            <div
              className={cn(
                "mt-1 flex flex-col gap-2.5 rounded-xl border p-3.5",
                trip.needsResponse
                  ? "border-amber-500/35 bg-amber-500/[0.07]"
                  : "border-primary/25 bg-primary/5",
              )}
            >
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {trip.needsResponse
                  ? t("trips.actionRequired")
                  : t("trips.statusActions")}
              </p>
              {trip.needsResponse ? (
                <>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {t("trips.needsResponse")}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      size="lg"
                      className="h-11 w-full touch-manipulation"
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
                      className="h-11 w-full touch-manipulation"
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
                  className="h-11 w-full touch-manipulation"
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
                  className="h-11 w-full touch-manipulation"
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
