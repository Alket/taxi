"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import useSWR from "swr"
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleDollarSignIcon,
  ListFilterIcon,
  SlidersHorizontalIcon,
  XIcon,
} from "lucide-react"

import { fetcher } from "@/lib/api"
import { BOOKING_STATUS_FLOW } from "@/lib/booking-status"
import {
  CALENDAR_PAGE_SIZE,
  CALENDAR_VIEW_OPTIONS,
  CALENDAR_WEEKDAYS,
  type CalendarViewMode,
  groupBookingsByDay,
  intersectFetchRange,
  isCalendarViewMode,
  parseDateKey,
  visibleRange,
} from "@/lib/bookings-calendar"
import {
  BOOKING_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  formatTime,
} from "@/lib/format"
import type { Booking, Driver, PaymentStatus } from "@/lib/types"
import { cn } from "@/lib/utils"
import { PageHeader } from "@/components/admin/page-header"
import { AdminDateField, toDateInputValue } from "@/components/admin/date-field"
import {
  AdminDriverField,
  type DriverFilterValue,
} from "@/components/admin/driver-field"
import { AdminFilterSelectField } from "@/components/admin/filter-select-field"
import {
  BookingStatusBadge,
  PaymentStatusBadge,
} from "@/components/admin/status-badges"
import { BookingDetail } from "@/components/bookings/booking-detail"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty"

const MONTH_CHIP_LIMIT = 3

type BookingsResponse = {
  bookings: Booking[]
  total: number
  page: number
  pageSize: number
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All statuses" },
  ...BOOKING_STATUS_FLOW.map((s) => ({
    value: s,
    label: BOOKING_STATUS_LABELS[s],
  })),
  { value: "cancelled", label: BOOKING_STATUS_LABELS.cancelled },
  { value: "abandoned", label: BOOKING_STATUS_LABELS.abandoned },
]

const PAYMENT_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All payments" },
  ...(Object.keys(PAYMENT_STATUS_LABELS) as PaymentStatus[]).map((s) => ({
    value: s,
    label: PAYMENT_STATUS_LABELS[s],
  })),
]

const statusAccent: Record<Booking["status"], string> = {
  pending: "border-l-warning",
  confirmed: "border-l-info",
  driver_assigned: "border-l-warning",
  driver_accepted: "border-l-primary",
  en_route: "border-l-primary",
  arrived: "border-l-primary",
  in_progress: "border-l-primary",
  completed: "border-l-success",
  cancelled: "border-l-destructive",
  abandoned: "border-l-muted-foreground",
}

function normalizeDriverFilter(value: string | null): DriverFilterValue {
  if (!value || value === "all") return "all"
  if (value === "null") return "unassigned"
  return value
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

function formatRangeLabel(view: CalendarViewMode, cursor: Date) {
  if (view === "day") {
    return cursor.toLocaleDateString("en-GB", {
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
    const left = start.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    })
    const right = end.toLocaleDateString("en-GB", {
      day: "numeric",
      month: sameMonth ? undefined : "short",
      year: "numeric",
    })
    return `${left} – ${right}`
  }
  return cursor.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  })
}

function EventChip({
  booking,
  dense,
  selected,
  onSelect,
}: {
  booking: Booking
  dense?: boolean
  selected?: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-md border border-border/70 border-l-4 bg-white text-left text-foreground transition-colors hover:bg-white/90",
        statusAccent[booking.status],
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
        <span className="shrink-0 text-foreground">
          {formatTime(booking.pickupDateTime)}
        </span>
        <span className="truncate text-foreground/70">
          {booking.referenceCode}
        </span>
      </div>
      {!dense ? (
        <div className="mt-1 space-y-1">
          <p className="truncate text-xs font-medium text-foreground">
            {booking.customer.name}
          </p>
          <p className="truncate text-[11px] text-foreground/70">
            {booking.driver?.name ?? "Unassigned"}
          </p>
          <div className="flex flex-wrap gap-1 pt-0.5">
            <BookingStatusBadge status={booking.status} />
            <PaymentStatusBadge status={booking.paymentStatus} />
          </div>
        </div>
      ) : (
        <p className="mt-0.5 truncate text-[10px] text-foreground/70">
          {booking.customer.name}
        </p>
      )}
    </button>
  )
}

export function BookingsCalendarView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const todayKey = toDateInputValue(new Date())

  const [view, setView] = React.useState<CalendarViewMode>(() => {
    const fromUrl = searchParams.get("view")
    return isCalendarViewMode(fromUrl) ? fromUrl : "week"
  })
  const [cursorKey, setCursorKey] = React.useState(() => {
    const fromUrl = searchParams.get("date")
    return fromUrl && parseDateKey(fromUrl) ? fromUrl : todayKey
  })
  const [status, setStatus] = React.useState(
    () => searchParams.get("status") ?? "all",
  )
  const [paymentStatus, setPaymentStatus] = React.useState(
    () => searchParams.get("paymentStatus") ?? "all",
  )
  const [driverId, setDriverId] = React.useState(() =>
    normalizeDriverFilter(
      searchParams.get("driverId") ?? searchParams.get("driver"),
    ),
  )
  const [filterFrom, setFilterFrom] = React.useState(
    () => searchParams.get("dateFrom") ?? "",
  )
  const [filterTo, setFilterTo] = React.useState(
    () => searchParams.get("dateTo") ?? "",
  )
  const [filtersOpen, setFiltersOpen] = React.useState(false)
  const [selectedId, setSelectedId] = React.useState<string | null>(
    () => searchParams.get("bookingId") ?? searchParams.get("booking"),
  )

  const cursor = React.useMemo(
    () => parseDateKey(cursorKey) ?? new Date(),
    [cursorKey],
  )

  React.useEffect(() => {
    const bookingId =
      searchParams.get("bookingId") ?? searchParams.get("booking")
    if (bookingId) setSelectedId(bookingId)

    const nextView = searchParams.get("view")
    if (isCalendarViewMode(nextView)) setView(nextView)

    const nextDate = searchParams.get("date")
    if (nextDate && parseDateKey(nextDate)) setCursorKey(nextDate)

    if (searchParams.has("status")) {
      setStatus(searchParams.get("status") ?? "all")
    }
    if (searchParams.has("paymentStatus")) {
      setPaymentStatus(searchParams.get("paymentStatus") ?? "all")
    }
    if (searchParams.has("driverId") || searchParams.has("driver")) {
      setDriverId(
        normalizeDriverFilter(
          searchParams.get("driverId") ?? searchParams.get("driver"),
        ),
      )
    }
    if (searchParams.has("dateFrom")) {
      setFilterFrom(searchParams.get("dateFrom") ?? "")
    }
    if (searchParams.has("dateTo")) {
      setFilterTo(searchParams.get("dateTo") ?? "")
    }
  }, [searchParams])

  React.useEffect(() => {
    if (filterFrom && filterTo && filterFrom > filterTo) {
      setFilterTo(filterFrom)
    }
  }, [filterFrom, filterTo])

  const range = React.useMemo(
    () => visibleRange(view, cursor),
    [view, cursor],
  )

  const { from: fetchFrom, to: fetchTo, invalid: rangeInvalid } =
    React.useMemo(
      () =>
        intersectFetchRange(range.from, range.to, filterFrom, filterTo),
      [range.from, range.to, filterFrom, filterTo],
    )

  const statusSelectValue =
    status.includes(",") || !STATUS_OPTIONS.some((o) => o.value === status)
      ? "all"
      : status

  const { data: driverData } = useSWR<{ drivers: Driver[] }>(
    "/api/admin/drivers",
    fetcher,
  )
  const drivers = driverData?.drivers ?? []

  const query = React.useMemo(() => {
    if (rangeInvalid) return null
    const params = new URLSearchParams()
    if (status !== "all") params.set("status", status)
    if (paymentStatus !== "all") params.set("paymentStatus", paymentStatus)
    if (driverId !== "all") params.set("driverId", driverId)
    params.set("dateFrom", fetchFrom)
    params.set("dateTo", fetchTo)
    params.set("sort", "pickup_asc")
    params.set("page", "1")
    params.set("pageSize", String(CALENDAR_PAGE_SIZE))
    return params.toString()
  }, [
    status,
    paymentStatus,
    driverId,
    fetchFrom,
    fetchTo,
    rangeInvalid,
  ])

  const { data, isLoading, mutate } = useSWR<BookingsResponse>(
    query ? `/api/admin/bookings?${query}` : null,
    fetcher,
  )

  const bookings = data?.bookings ?? []
  const total = data?.total ?? 0
  const byDay = React.useMemo(() => groupBookingsByDay(bookings), [bookings])

  const advancedFilterCount = [
    status !== "all",
    paymentStatus !== "all",
    driverId !== "all",
    !!filterFrom,
    !!filterTo,
  ].filter(Boolean).length

  const hasFilters = advancedFilterCount > 0

  function pushUrl(next: {
    view?: CalendarViewMode
    date?: string
    status?: string
    paymentStatus?: string
    driverId?: DriverFilterValue
    dateFrom?: string
    dateTo?: string
    bookingId?: string | null
  }) {
    const params = new URLSearchParams()
    const nextView = next.view ?? view
    const nextDate = next.date ?? cursorKey
    const nextStatus = next.status ?? status
    const nextPayment = next.paymentStatus ?? paymentStatus
    const nextDriver = next.driverId ?? driverId
    const nextFrom = next.dateFrom ?? filterFrom
    const nextTo = next.dateTo ?? filterTo
    const nextBooking =
      next.bookingId === undefined ? selectedId : next.bookingId

    if (nextView !== "week") params.set("view", nextView)
    if (nextDate !== todayKey) params.set("date", nextDate)
    if (nextStatus !== "all") params.set("status", nextStatus)
    if (nextPayment !== "all") params.set("paymentStatus", nextPayment)
    if (nextDriver !== "all") params.set("driverId", nextDriver)
    if (nextFrom) params.set("dateFrom", nextFrom)
    if (nextTo) params.set("dateTo", nextTo)
    if (nextBooking) params.set("bookingId", nextBooking)

    const qs = params.toString()
    router.replace(qs ? `/admin/calendar?${qs}` : "/admin/calendar", {
      scroll: false,
    })
  }

  function resetFilters() {
    setStatus("all")
    setPaymentStatus("all")
    setDriverId("all")
    setFilterFrom("")
    setFilterTo("")
    pushUrl({
      status: "all",
      paymentStatus: "all",
      driverId: "all",
      dateFrom: "",
      dateTo: "",
    })
  }

  function shiftCursor(delta: number) {
    let next = cursor
    if (view === "day") next = addDaysLocal(cursor, delta)
    else if (view === "week") next = addDaysLocal(cursor, delta * 7)
    else next = new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1, 12)
    const key = toDateInputValue(next)
    setCursorKey(key)
    pushUrl({ date: key })
  }

  function goToday() {
    setCursorKey(todayKey)
    pushUrl({ date: todayKey })
  }

  function openBooking(id: string) {
    setSelectedId(id)
    pushUrl({ bookingId: id })
  }

  const cursorMonth = cursor.getMonth()

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Reservations by day, week, or month"
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
                  {option.label}
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
                  aria-label="Previous"
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
                  Today
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-9 touch-manipulation"
                  aria-label="Next"
                  onClick={() => shiftCursor(1)}
                >
                  <ChevronRightIcon className="size-4" />
                </Button>
              </div>
              <p className="min-w-0 truncate text-sm font-semibold">
                {formatRangeLabel(view, cursor)}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-10 flex-1 touch-manipulation justify-between sm:flex-none"
                onClick={() => setFiltersOpen((open) => !open)}
                aria-expanded={filtersOpen}
              >
                <span className="inline-flex items-center gap-2">
                  <SlidersHorizontalIcon className="size-4" />
                  Filters
                  {advancedFilterCount > 0 ? (
                    <Badge variant="secondary" className="tabular-nums">
                      {advancedFilterCount}
                    </Badge>
                  ) : null}
                </span>
                <ChevronDownIcon
                  className={cn(
                    "size-4 text-muted-foreground transition-transform",
                    filtersOpen && "rotate-180",
                  )}
                />
              </Button>
              {hasFilters ? (
                <Button
                  variant="ghost"
                  className="h-10 shrink-0 touch-manipulation"
                  onClick={resetFilters}
                >
                  <XIcon data-icon="inline-start" />
                  Clear
                </Button>
              ) : null}
            </div>
            {!isLoading && !rangeInvalid ? (
              <p className="text-xs text-muted-foreground tabular-nums sm:ml-auto">
                {total} {total === 1 ? "reservation" : "reservations"}
                {total >= CALENDAR_PAGE_SIZE ? " (showing first 500)" : ""}
              </p>
            ) : null}
          </div>

          <div
            className={cn(
              "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4",
              !filtersOpen && "hidden",
            )}
          >
            <AdminFilterSelectField
              label="Status"
              value={statusSelectValue}
              onChange={(value) => {
                setStatus(value)
                pushUrl({ status: value })
              }}
              options={STATUS_OPTIONS}
              icon={ListFilterIcon}
            />
            <AdminFilterSelectField
              label="Payment"
              value={paymentStatus}
              onChange={(value) => {
                setPaymentStatus(value)
                pushUrl({ paymentStatus: value })
              }}
              options={PAYMENT_OPTIONS}
              icon={CircleDollarSignIcon}
            />
            <AdminDriverField
              label="Driver"
              value={driverId}
              onChange={(value) => {
                setDriverId(value)
                pushUrl({ driverId: value })
              }}
              drivers={drivers}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <AdminDateField
                label="From"
                value={filterFrom}
                max={filterTo || undefined}
                onChange={(value) => {
                  setFilterFrom(value)
                  pushUrl({ dateFrom: value })
                }}
                placeholder="Start date"
                allowClear
              />
              <AdminDateField
                label="To"
                value={filterTo}
                min={filterFrom || undefined}
                onChange={(value) => {
                  setFilterTo(value)
                  pushUrl({ dateTo: value })
                }}
                placeholder="End date"
                allowClear
              />
            </div>
          </div>
        </div>

        {rangeInvalid ? (
          <Empty className="rounded-xl border">
            <EmptyTitle>Invalid date range</EmptyTitle>
            <EmptyDescription>
              From date must be on or before To date.
            </EmptyDescription>
          </Empty>
        ) : isLoading ? (
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
                const dayBookings = byDay.get(dayKey) ?? []
                const visible = dayBookings.slice(0, MONTH_CHIP_LIMIT)
                const overflow = dayBookings.length - visible.length
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
                      aria-label={`Open ${dayKey}`}
                    >
                      {dayDate.getDate()}
                    </button>
                    <div className="flex flex-col gap-0.5">
                      {visible.map((booking) => (
                        <EventChip
                          key={booking.id}
                          booking={booking}
                          dense
                          selected={selectedId === booking.id}
                          onSelect={() => openBooking(booking.id)}
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
                          +{overflow} more
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
                const dayBookings = byDay.get(dayKey) ?? []
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
                      {dayBookings.length === 0 ? (
                        <p className="px-1 py-2 text-[11px] text-muted-foreground">
                          No trips
                        </p>
                      ) : (
                        dayBookings.map((booking) => (
                          <EventChip
                            key={booking.id}
                            booking={booking}
                            dense
                            selected={selectedId === booking.id}
                            onSelect={() => openBooking(booking.id)}
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
                <EmptyTitle>No reservations</EmptyTitle>
                <EmptyDescription>
                  Nothing scheduled for this day with the current filters.
                </EmptyDescription>
              </Empty>
            ) : (
              <div className="flex flex-col gap-2 p-3 sm:p-4">
                {(byDay.get(range.days[0]!) ?? []).map((booking) => (
                  <EventChip
                    key={booking.id}
                    booking={booking}
                    selected={selectedId === booking.id}
                    onSelect={() => openBooking(booking.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <BookingDetail
        bookingId={selectedId}
        open={!!selectedId}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null)
            pushUrl({ bookingId: null })
          }
        }}
        onMutated={() => mutate()}
      />
    </>
  )
}
