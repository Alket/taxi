"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import useSWR from "swr"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react"

import { fetcher } from "@/lib/api"
import { toDateInputValue } from "@/components/admin/date-field"
import {
  CALENDAR_VIEW_OPTIONS,
  CALENDAR_WEEKDAYS,
  type CalendarViewMode,
  groupByPickupDay,
  isCalendarViewMode,
  parseDateKey,
  visibleRange,
} from "@/lib/bookings-calendar"
import { formatTime } from "@/lib/format"
import {
  DRIVER_INTL_LOCALE,
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
  pending: "border-l-warning",
  confirmed: "border-l-info",
  driver_assigned: "border-l-warning",
  driver_accepted: "border-l-primary",
  en_route: "border-l-primary",
  arrived: "border-l-primary",
  in_progress: "border-l-primary",
  completed: "border-l-success",
  cancelled: "border-l-destructive",
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
  const name = trip.contactName || trip.customerName
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-md border border-border/70 border-l-4 bg-white text-left text-foreground transition-colors hover:bg-white/90",
        statusAccent[trip.status],
        dense ? "px-1.5 py-1" : "px-2.5 py-2",
        selected && "ring-2 ring-ring",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1.5 font-medium tabular-nums",
          dense ? "text-[10px] leading-tight" : "text-xs",
        )}
      >
        <span className="shrink-0">{formatTime(trip.pickupDateTime)}</span>
        <span className="truncate text-foreground/70">{trip.referenceCode}</span>
      </div>
      {!dense ? (
        <div className="mt-1 space-y-1">
          <p className="truncate text-xs font-medium">{name}</p>
          <p className="truncate text-[11px] text-foreground/70">
            {trip.statusLabel}
          </p>
          <p className="truncate text-[11px] text-foreground/70">
            {trip.pickupAddress}
          </p>
        </div>
      ) : (
        <p className="mt-0.5 truncate text-[10px] text-foreground/70">{name}</p>
      )}
    </button>
  )
}

export function DriverCalendarView() {
  const t = useDriverT()
  const locale = useDriverLocale()
  const intlLocale = DRIVER_INTL_LOCALE[locale]
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
  const { data, isLoading } = useSWR<CalendarResponse>(
    `/api/driver/bookings?${query}`,
    fetcher,
    { refreshInterval: 30_000 },
  )

  const bookings = data?.bookings ?? []
  const byDay = React.useMemo(
    () => groupByPickupDay(bookings),
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

  return (
    <>
      <DriverPageHeader
        title={t("calendar.title")}
        description={t("calendar.description")}
      />
      <div className="flex flex-col gap-4 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-4 md:p-6">
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="inline-flex rounded-lg border bg-muted/40 p-1">
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

            <div className="flex items-center justify-between gap-2 lg:justify-end">
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
              <p className="min-w-0 truncate text-sm font-semibold">
                {formatRangeLabel()}
              </p>
            </div>
          </div>

          {!isLoading ? (
            <p className="text-xs text-muted-foreground tabular-nums">
              {(() => {
                const count = data?.total ?? bookings.length
                const key =
                  count === 1 ? "calendar.tripCount" : "calendar.tripCount_other"
                return t(key, { count })
              })()}
            </p>
          ) : null}
        </div>

        {isLoading ? (
          <Skeleton className="h-[32rem] w-full rounded-xl" />
        ) : view === "month" ? (
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="grid grid-cols-7 border-b bg-muted/40">
              {CALENDAR_WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="px-1 py-2 text-center text-[10px] font-semibold tracking-wide text-muted-foreground uppercase sm:text-xs"
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
                      "min-h-24 border-r border-b p-1 sm:min-h-28 sm:p-1.5",
                      !inMonth && "bg-muted/20",
                    )}
                  >
                    <button
                      type="button"
                      className={cn(
                        "mb-1 flex size-6 items-center justify-center rounded-full text-xs font-medium tabular-nums",
                        isToday && "bg-primary text-primary-foreground",
                        !inMonth && "text-muted-foreground",
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
                    <div className="flex flex-col gap-0.5">
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
                          className="px-1 text-left text-[10px] font-medium text-muted-foreground hover:text-foreground"
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
          <div className="overflow-x-auto rounded-xl border bg-card">
            <div className="grid min-w-[56rem] grid-cols-7 divide-x">
              {range.days.map((dayKey) => {
                const dayDate = parseDateKey(dayKey)!
                const isToday = dayKey === todayKey
                const dayTrips = byDay.get(dayKey) ?? []
                return (
                  <div key={dayKey} className="flex min-h-80 flex-col">
                    <button
                      type="button"
                      className={cn(
                        "border-b px-2 py-2 text-left hover:bg-muted/40",
                        isToday && "bg-primary/5",
                      )}
                      onClick={() => {
                        setView("day")
                        setCursorKey(dayKey)
                        pushUrl({ view: "day", date: dayKey })
                      }}
                    >
                      <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                        {CALENDAR_WEEKDAYS[dayDate.getDay()]}
                      </p>
                      <p
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          isToday && "text-primary",
                        )}
                      >
                        {dayDate.getDate()}
                      </p>
                    </button>
                    <div className="flex flex-1 flex-col gap-1.5 p-1.5">
                      {dayTrips.length === 0 ? (
                        <p className="px-1 py-2 text-[11px] text-muted-foreground">
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
          <div className="rounded-xl border bg-card">
            {(byDay.get(range.days[0]!) ?? []).length === 0 ? (
              <Empty className="py-16">
                <EmptyTitle>{t("calendar.emptyTitle")}</EmptyTitle>
                <EmptyDescription>
                  {t("calendar.emptyDescription")}
                </EmptyDescription>
              </Empty>
            ) : (
              <div className="flex flex-col gap-2 p-3 sm:p-4">
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
      />
    </>
  )
}
