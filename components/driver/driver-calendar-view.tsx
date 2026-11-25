"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import useSWR from "swr"
import {
  AlertCircleIcon,
  ArrowRightIcon,
  BanknoteIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  RefreshCwIcon,
  UserIcon,
} from "lucide-react"

import { fetcher } from "@/lib/api"
import { toDateInputValue } from "@/components/admin/date-field"
import {
  CALENDAR_VIEW_OPTIONS,
  type CalendarViewMode,
  groupByPickupDay,
  isCalendarViewMode,
  parseDateKey,
  visibleRange,
} from "@/lib/bookings-calendar"
import { formatTime } from "@/lib/format"
import {
  DRIVER_INTL_LOCALE,
  driverWeekdayShortLabels,
  useDriverLocale,
  useDriverT,
} from "@/lib/i18n/driver"
import type { BookingStatus } from "@/lib/types"
import { cn } from "@/lib/utils"
import { DriverPageHeader } from "@/components/driver/driver-page-header"
import {
  DriverTripDetailSheet,
  type DriverTripDetail,
} from "@/components/driver/driver-trip-detail-sheet"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty"

const MONTH_CHIP_LIMIT = 3

type CalendarResponse = {
  bookings: DriverTripDetail[]
  total: number
}

const statusAccent: Record<BookingStatus, string> = {
  pending: "border-l-amber-500",
  confirmed: "border-l-sky-500",
  driver_assigned: "border-l-amber-500",
  driver_accepted: "border-l-sky-500",
  en_route: "border-l-sky-500",
  arrived: "border-l-primary",
  in_progress: "border-l-primary",
  completed: "border-l-emerald-500",
  cancelled: "border-l-destructive",
  abandoned: "border-l-muted-foreground",
}

function statusBadgeClass(status: BookingStatus) {
  switch (status) {
    case "driver_assigned":
    case "pending":
      return "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200"
    case "driver_accepted":
    case "confirmed":
    case "en_route":
      return "border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-200"
    case "arrived":
    case "in_progress":
      return "border-primary/30 bg-primary/10 text-primary"
    case "completed":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
    case "cancelled":
      return "border-destructive/30 bg-destructive/10 text-destructive"
    default:
      return "border-border bg-muted text-muted-foreground"
  }
}

function addDaysLocal(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function startOfWeekSundayLocal(d: Date) {
  const x = new Date(d)
  x.setHours(12, 0, 0, 0)
  x.setDate(x.getDate() - x.getDay())
  return x
}

function TripChip({
  trip,
  dense,
  selected,
  onSelect,
}: {
  trip: DriverTripDetail
  dense?: boolean
  selected?: boolean
  onSelect: () => void
}) {
  const t = useDriverT()
  const name = trip.contactName || trip.customerName
  const statusLabel = t(`status.${trip.status}`) || trip.statusLabel

  if (dense) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "group w-full rounded-md border border-border/70 border-l-[3px] bg-background/95 px-1.5 py-1 text-left text-foreground shadow-2xs transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          statusAccent[trip.status],
          trip.needsResponse &&
            "border-amber-500/40 bg-amber-500/[0.06] hover:bg-amber-500/10",
          selected && "ring-2 ring-ring",
        )}
      >
        <div className="flex items-center justify-between gap-1 text-[10px] leading-tight font-semibold tabular-nums">
          <div className="flex min-w-0 items-center gap-1">
            <span className="shrink-0">{formatTime(trip.pickupDateTime)}</span>
            <span className="truncate font-normal text-muted-foreground">
              {trip.referenceCode}
            </span>
          </div>
          {trip.needsResponse ? (
            <span
              className="size-1.5 shrink-0 rounded-full bg-amber-500"
              aria-hidden
            />
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
          {name}
        </p>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group flex w-full items-center gap-3 rounded-xl border border-border/80 border-l-4 bg-card p-3.5 text-left text-foreground shadow-xs transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-4",
        statusAccent[trip.status],
        trip.needsResponse &&
          "border-amber-500/40 bg-amber-500/[0.04] hover:bg-amber-500/[0.08]",
        selected && "ring-2 ring-ring",
      )}
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-sm font-semibold tabular-nums">
            <ClockIcon className="size-3.5 text-muted-foreground" />
            {formatTime(trip.pickupDateTime)}
          </span>
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
              statusBadgeClass(trip.status),
            )}
          >
            {statusLabel}
          </span>
          <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium tabular-nums text-muted-foreground">
            {t("trips.pin", { pin: trip.pickupPin })}
          </span>
        </div>

        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm leading-snug font-medium text-foreground">
          <span className="break-words">{trip.pickupAddress}</span>
          <ArrowRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="break-words">{trip.dropoffAddress}</span>
        </p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="font-mono">{trip.referenceCode}</span>
          <span className="inline-flex items-center gap-1">
            <UserIcon className="size-3" />
            <span className="truncate">{name}</span>
          </span>
          <span className="font-semibold tabular-nums text-foreground">
            {trip.totalPriceLabel}
          </span>
          {trip.cashToCollect > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium tabular-nums text-amber-800 dark:text-amber-200">
              <BanknoteIcon className="size-3" />
              {trip.cashToCollectLabel}
            </span>
          ) : null}
        </div>
      </div>

      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  )
}

export function DriverCalendarView() {
  const t = useDriverT()
  const locale = useDriverLocale()
  const intlLocale = DRIVER_INTL_LOCALE[locale]
  const weekdayLabels = React.useMemo(
    () => driverWeekdayShortLabels(locale),
    [locale],
  )
  const router = useRouter()
  const searchParams = useSearchParams()
  const todayKey = toDateInputValue(new Date())

  const viewParam = searchParams.get("view")
  const dateParam = searchParams.get("date")
  const bookingParam = searchParams.get("bookingId")

  const [view, setView] = React.useState<CalendarViewMode>(
    isCalendarViewMode(viewParam) ? viewParam : "week",
  )
  const [cursorKey, setCursorKey] = React.useState(
    dateParam && parseDateKey(dateParam) ? dateParam : todayKey,
  )
  const [selectedId, setSelectedId] = React.useState<string | null>(
    bookingParam,
  )

  React.useEffect(() => {
    if (isCalendarViewMode(viewParam) && viewParam !== view) {
      setView(viewParam)
    }
  }, [viewParam, view])

  React.useEffect(() => {
    if (dateParam && parseDateKey(dateParam) && dateParam !== cursorKey) {
      setCursorKey(dateParam)
    }
  }, [dateParam, cursorKey])

  React.useEffect(() => {
    setSelectedId(bookingParam)
  }, [bookingParam])

  const cursor = parseDateKey(cursorKey) ?? new Date()
  const range = visibleRange(view, cursor)

  function pushUrl(patch: {
    view?: CalendarViewMode
    date?: string
    bookingId?: string | null
  }) {
    const params = new URLSearchParams(searchParams.toString())
    const nextView = patch.view ?? view
    const nextDate = patch.date ?? cursorKey
    params.set("view", nextView)
    params.set("date", nextDate)
    if (patch.bookingId === null) params.delete("bookingId")
    else if (patch.bookingId) params.set("bookingId", patch.bookingId)
    router.replace(`/driver/calendar?${params.toString()}`, { scroll: false })
  }

  const query = `dateFrom=${range.from}&dateTo=${range.to}`
  const { data, error, isLoading, isValidating, mutate } =
    useSWR<CalendarResponse>(`/api/driver/bookings?${query}`, fetcher, {
      refreshInterval: 30_000,
    })

  const bookings = data?.bookings ?? []
  const byDay = React.useMemo(
    () => groupByPickupDay(bookings),
    [bookings],
  )
  const pendingResponseCount = React.useMemo(
    () => bookings.filter((trip) => trip.needsResponse).length,
    [bookings],
  )

  const selectedTrip =
    bookings.find((trip) => trip.id === selectedId) ?? null

  function openTrip(id: string) {
    setSelectedId(id)
    pushUrl({ bookingId: id })
  }

  function shiftCursor(direction: -1 | 1) {
    let next: Date
    if (view === "day") next = addDaysLocal(cursor, direction)
    else if (view === "week") next = addDaysLocal(cursor, direction * 7)
    else next = new Date(cursor.getFullYear(), cursor.getMonth() + direction, 1)
    const key = toDateInputValue(next)
    setCursorKey(key)
    pushUrl({ date: key })
  }

  function goToday() {
    setCursorKey(todayKey)
    pushUrl({ date: todayKey })
  }

  function formatRangeLabel() {
    if (view === "day") {
      return cursor.toLocaleDateString(intlLocale, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    }
    if (view === "week") {
      const start = startOfWeekSundayLocal(cursor)
      const end = addDaysLocal(start, 6)
      const sameMonth = start.getMonth() === end.getMonth()
      const left = start.toLocaleDateString(intlLocale, {
        day: "numeric",
        month: "short",
      })
      const right = end.toLocaleDateString(intlLocale, {
        day: "numeric",
        month: sameMonth ? undefined : "short",
        year: "numeric",
      })
      return `${left} – ${right}`
    }
    return cursor.toLocaleDateString(intlLocale, {
      month: "long",
      year: "numeric",
    })
  }

  const cursorMonth = cursor.getMonth()
  const viewLabels: Record<CalendarViewMode, string> = {
    day: t("calendar.viewDay"),
    week: t("calendar.viewWeek"),
    month: t("calendar.viewMonth"),
  }

  const tripCount = data?.total ?? bookings.length
  const tripCountLabel = t(
    tripCount === 1 ? "calendar.tripCount" : "calendar.tripCount_other",
    { count: tripCount },
  )

  return (
    <>
      <DriverPageHeader
        title={t("calendar.title")}
        description={t("calendar.description")}
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 touch-manipulation gap-1.5"
            disabled={isValidating}
            onClick={() => void mutate()}
            aria-label={t("trips.refresh")}
          >
            <RefreshCwIcon
              className={cn("size-3.5", isValidating && "animate-spin")}
            />
            <span className="hidden sm:inline">{t("trips.refresh")}</span>
          </Button>
        }
      />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-4 md:p-6">
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-xs sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="inline-flex rounded-lg border bg-muted/50 p-1">
              {CALENDAR_VIEW_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={view === option.value ? "default" : "ghost"}
                  className="h-8 flex-1 touch-manipulation px-3 lg:flex-none"
                  onClick={() => {
                    setView(option.value)
                    pushUrl({ view: option.value })
                  }}
                >
                  {viewLabels[option.value]}
                </Button>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 lg:justify-end">
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-9 touch-manipulation"
                  aria-label={t("calendar.prev")}
                  onClick={() => shiftCursor(-1)}
                >
                  <ChevronLeftIcon className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 touch-manipulation px-3"
                  onClick={goToday}
                >
                  {t("calendar.today")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-9 touch-manipulation"
                  aria-label={t("calendar.next")}
                  onClick={() => shiftCursor(1)}
                >
                  <ChevronRightIcon className="size-4" />
                </Button>
              </div>
              <p className="min-w-0 truncate text-sm font-semibold tracking-tight sm:text-base">
                {formatRangeLabel()}
              </p>
            </div>
          </div>

          {!isLoading && !error ? (
            <div className="flex flex-wrap items-center gap-2 border-t pt-2.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/70 px-2.5 py-0.5 font-medium tabular-nums text-foreground">
                <CalendarIcon className="size-3 text-muted-foreground" />
                {tripCountLabel}
              </span>
              {pendingResponseCount > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 font-medium tabular-nums text-amber-800 dark:text-amber-200">
                  <span className="size-1.5 rounded-full bg-amber-500" />
                  {t("trips.actionRequired")}: {pendingResponseCount}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive sm:flex-row sm:items-center">
            <div className="flex items-center gap-2.5">
              <AlertCircleIcon className="size-4 shrink-0" />
              <p>{t("trips.loadError")}</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-destructive/30 bg-background text-foreground hover:bg-destructive/10"
              onClick={() => void mutate()}
            >
              {t("trips.retry")}
            </Button>
          </div>
        ) : isLoading ? (
          <Skeleton className="h-[32rem] w-full rounded-xl" />
        ) : view === "month" ? (
          <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
            <div className="grid grid-cols-7 border-b bg-muted/40">
              {weekdayLabels.map((day) => (
                <div
                  key={day}
                  className="px-1 py-2.5 text-center text-[10px] font-semibold tracking-wide text-muted-foreground uppercase sm:text-xs"
                >
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 auto-rows-fr">
              {range.days.map((dayKey) => {
                const dayDate = parseDateKey(dayKey)!
                const inMonth = dayDate.getMonth() === cursorMonth
                const isToday = dayKey === todayKey
                const dayTrips = byDay.get(dayKey) ?? []
                const visible = dayTrips.slice(0, MONTH_CHIP_LIMIT)
                const overflow = dayTrips.length - visible.length
                return (
                  <div
                    key={dayKey}
                    className={cn(
                      "min-h-24 border-r border-b p-1 transition-colors [&:nth-child(7n)]:border-r-0 sm:min-h-30 sm:p-1.5",
                      !inMonth && "bg-muted/20",
                      isToday && "bg-primary/[0.04]",
                    )}
                  >
                    <div className="mb-1 flex items-center justify-between gap-1">
                      <button
                        type="button"
                        className={cn(
                          "flex size-6 items-center justify-center rounded-full text-xs font-medium tabular-nums transition-colors hover:bg-muted",
                          isToday &&
                            "bg-primary font-semibold text-primary-foreground hover:bg-primary/90",
                          !inMonth && !isToday && "text-muted-foreground",
                        )}
                        onClick={() => {
                          setView("day")
                          setCursorKey(dayKey)
                          pushUrl({ view: "day", date: dayKey })
                        }}
                        aria-label={t("calendar.openDay", { date: dayKey })}
                      >
                        {dayDate.getDate()}
                      </button>
                      {dayTrips.length > 0 ? (
                        <span className="hidden rounded-full bg-muted px-1.5 text-[10px] font-medium tabular-nums text-muted-foreground sm:inline-block">
                          {dayTrips.length}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-1">
                      {visible.map((trip) => (
                        <TripChip
                          key={trip.id}
                          trip={trip}
                          dense
                          selected={selectedId === trip.id}
                          onSelect={() => openTrip(trip.id)}
                        />
                      ))}
                      {overflow > 0 ? (
                        <button
                          type="button"
                          className="w-fit rounded bg-muted/70 px-1.5 py-0.5 text-left text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          onClick={() => {
                            setView("day")
                            setCursorKey(dayKey)
                            pushUrl({ view: "day", date: dayKey })
                          }}
                        >
                          {t("calendar.more", { count: overflow })}
                        </button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : view === "week" ? (
          <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
            <div className="grid min-w-[56rem] grid-cols-7 divide-x">
              {range.days.map((dayKey) => {
                const dayDate = parseDateKey(dayKey)!
                const isToday = dayKey === todayKey
                const dayTrips = byDay.get(dayKey) ?? []
                return (
                  <div
                    key={dayKey}
                    className={cn(
                      "flex min-h-88 flex-col",
                      isToday && "bg-primary/[0.03]",
                    )}
                  >
                    <button
                      type="button"
                      className={cn(
                        "flex items-center justify-between border-b px-2.5 py-2.5 text-left transition-colors hover:bg-muted/40",
                        isToday && "bg-primary/[0.06]",
                      )}
                      onClick={() => {
                        setView("day")
                        setCursorKey(dayKey)
                        pushUrl({ view: "day", date: dayKey })
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "flex size-7 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
                            isToday
                              ? "bg-primary text-primary-foreground"
                              : "text-foreground",
                          )}
                        >
                          {dayDate.getDate()}
                        </span>
                        <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                          {weekdayLabels[dayDate.getDay()]}
                        </span>
                      </div>
                      {dayTrips.length > 0 ? (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                          {dayTrips.length}
                        </span>
                      ) : null}
                    </button>
                    <div className="flex flex-1 flex-col gap-1.5 p-2">
                      {dayTrips.length === 0 ? (
                        <p className="px-1 py-3 text-center text-[11px] text-muted-foreground/60">
                          {t("calendar.noTrips")}
                        </p>
                      ) : (
                        dayTrips.map((trip) => (
                          <TripChip
                            key={trip.id}
                            trip={trip}
                            dense
                            selected={selectedId === trip.id}
                            onSelect={() => openTrip(trip.id)}
                          />
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border bg-card shadow-xs">
            {(byDay.get(range.days[0]!) ?? []).length === 0 ? (
              <Empty className="py-16">
                <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-muted/70 text-muted-foreground">
                  <CalendarIcon className="size-5" />
                </div>
                <EmptyTitle>{t("calendar.emptyTitle")}</EmptyTitle>
                <EmptyDescription>
                  {t("calendar.emptyDescription")}
                </EmptyDescription>
              </Empty>
            ) : (
              <div className="flex flex-col gap-2.5 p-3 sm:p-4">
                {(byDay.get(range.days[0]!) ?? []).map((trip) => (
                  <TripChip
                    key={trip.id}
                    trip={trip}
                    selected={selectedId === trip.id}
                    onSelect={() => openTrip(trip.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <DriverTripDetailSheet
        trip={selectedTrip}
        open={!!selectedId && !!selectedTrip}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null)
            pushUrl({ bookingId: null })
          }
        }}
        onUpdated={() => mutate()}
      />
    </>
  )
}
