"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import useSWR from "swr"
import {
  AlertCircleIcon,
  ArrowRightIcon,
  CalendarIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleDollarSignIcon,
  ClockIcon,
  ListFilterIcon,
  RefreshCwIcon,
  SlidersHorizontalIcon,
  UserIcon,
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
  formatMoney,
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
  if (dense) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "group w-full rounded-md border border-border/70 border-l-[3px] bg-background/95 px-1.5 py-1 text-left text-foreground shadow-2xs transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          statusAccent[booking.status],
          !booking.driver &&
            booking.status !== "cancelled" &&
            booking.status !== "abandoned" &&
            "border-amber-500/40 bg-amber-500/[0.05] hover:bg-amber-500/10",
          selected && "ring-2 ring-ring",
        )}
      >
        <div className="flex items-center justify-between gap-1 text-[10px] leading-tight font-semibold tabular-nums">
          <div className="flex min-w-0 items-center gap-1">
            <span className="shrink-0">
              {formatTime(booking.pickupDateTime)}
            </span>
            <span className="truncate font-normal text-muted-foreground">
              {booking.referenceCode}
            </span>
          </div>
          {!booking.driver &&
          booking.status !== "cancelled" &&
          booking.status !== "abandoned" ? (
            <span
              className="size-1.5 shrink-0 rounded-full bg-amber-500"
              aria-hidden
            />
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
          {booking.customer.name}
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
        statusAccent[booking.status],
        selected && "ring-2 ring-ring",
      )}
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-sm font-semibold tabular-nums">
              <ClockIcon className="size-3.5 text-muted-foreground" />
              {formatTime(booking.pickupDateTime)}
            </span>
            <BookingStatusBadge status={booking.status} />
            <PaymentStatusBadge status={booking.paymentStatus} />
          </div>
          <span className="text-sm font-bold tabular-nums text-foreground">
            {formatMoney(booking.totalPrice, booking.currency)}
          </span>
        </div>

        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm leading-snug font-medium text-foreground">
          <span className="break-words">{booking.pickupAddress}</span>
          <ArrowRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="break-words">{booking.dropoffAddress}</span>
        </p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="font-mono">{booking.referenceCode}</span>
          <span className="inline-flex items-center gap-1">
            <UserIcon className="size-3" />
            <span className="truncate">{booking.customer.name}</span>
          </span>
          {booking.driver ? (
            <Badge variant="secondary" className="font-normal">
              {booking.driver.name}
            </Badge>
          ) : (
            <Badge variant="destructive" className="font-normal">
              Unassigned
            </Badge>
          )}
        </div>
      </div>

      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
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

  const { data, error, isLoading, isValidating, mutate } =
    useSWR<BookingsResponse>(
      query ? `/api/admin/bookings?${query}` : null,
      fetcher,
    )

  const bookings = data?.bookings ?? []
  const total = data?.total ?? 0
  const byDay = React.useMemo(() => groupBookingsByDay(bookings), [bookings])
  const unassignedInView = React.useMemo(
    () =>
      bookings.filter(
        (b) =>
          !b.driver && b.status !== "cancelled" && b.status !== "abandoned",
      ).length,
    [bookings],
  )

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
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 touch-manipulation gap-1.5 sm:h-8"
            disabled={isValidating || rangeInvalid}
            onClick={() => void mutate()}
          >
            <RefreshCwIcon
              className={cn("size-3.5", isValidating && "animate-spin")}
            />
            Refresh
          </Button>
        }
      />
      <div className="flex w-full flex-col gap-4 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-4 md:p-6">
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
                  {option.label}
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
              <p className="min-w-0 truncate text-sm font-semibold tracking-tight sm:text-base">
                {formatRangeLabel(view, cursor)}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t pt-2.5 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 flex-1 touch-manipulation justify-between sm:flex-none"
                onClick={() => setFiltersOpen((open) => !open)}
                aria-expanded={filtersOpen}
              >
                <span className="inline-flex items-center gap-2">
                  <SlidersHorizontalIcon className="size-3.5" />
                  Filters
                  {advancedFilterCount > 0 ? (
                    <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-primary">
                      {advancedFilterCount}
                    </span>
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
                  size="sm"
                  className="h-9 shrink-0 touch-manipulation"
                  onClick={resetFilters}
                >
                  <XIcon data-icon="inline-start" />
                  Clear
                </Button>
              ) : null}
            </div>
            {!isLoading && !rangeInvalid && !error ? (
              <div className="flex flex-wrap items-center gap-2 text-xs sm:ml-auto">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/70 px-2.5 py-0.5 font-medium tabular-nums text-foreground">
                  <CalendarIcon className="size-3 text-muted-foreground" />
                  {total} {total === 1 ? "reservation" : "reservations"}
                  {total >= CALENDAR_PAGE_SIZE ? " (first 500)" : ""}
                </span>
                {unassignedInView > 0 ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 font-medium tabular-nums text-amber-800 dark:text-amber-200">
                    <span className="size-1.5 rounded-full bg-amber-500" />
                    Unassigned: {unassignedInView}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          <div
            className={cn(
              "grid grid-cols-1 gap-3 border-t pt-3 sm:grid-cols-2 lg:grid-cols-4",
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

        {error ? (
          <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive sm:flex-row sm:items-center">
            <div className="flex items-center gap-2.5">
              <AlertCircleIcon className="size-4 shrink-0" />
              <p>Could not load calendar reservations.</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-destructive/30 bg-background text-foreground hover:bg-destructive/10"
              onClick={() => void mutate()}
            >
              Try again
            </Button>
          </div>
        ) : rangeInvalid ? (
          <Empty className="rounded-xl border bg-card py-14 shadow-xs">
            <EmptyTitle>Invalid date range</EmptyTitle>
            <EmptyDescription>
              From date must be on or before To date.
            </EmptyDescription>
          </Empty>
        ) : isLoading ? (
          <Skeleton className="h-[32rem] w-full rounded-xl" />
        ) : view === "month" ? (
          <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
            <div className="grid grid-cols-7 border-b bg-muted/40">
              {CALENDAR_WEEKDAYS.map((day) => (
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
                const dayBookings = byDay.get(dayKey) ?? []
                const visible = dayBookings.slice(0, MONTH_CHIP_LIMIT)
                const overflow = dayBookings.length - visible.length
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
                        aria-label={`Open ${dayKey}`}
                      >
                        {dayDate.getDate()}
                      </button>
                      {dayBookings.length > 0 ? (
                        <span className="hidden rounded-full bg-muted px-1.5 text-[10px] font-medium tabular-nums text-muted-foreground sm:inline-block">
                          {dayBookings.length}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-1">
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
                          className="w-fit rounded bg-muted/70 px-1.5 py-0.5 text-left text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
          <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
            <div className="grid min-w-[56rem] grid-cols-7 divide-x">
              {range.days.map((dayKey) => {
                const dayDate = parseDateKey(dayKey)!
                const isToday = dayKey === todayKey
                const dayBookings = byDay.get(dayKey) ?? []
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
                          {CALENDAR_WEEKDAYS[dayDate.getDay()]}
                        </span>
                      </div>
                      {dayBookings.length > 0 ? (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                          {dayBookings.length}
                        </span>
                      ) : null}
                    </button>
                    <div className="flex flex-1 flex-col gap-1.5 p-2">
                      {dayBookings.length === 0 ? (
                        <p className="px-1 py-3 text-center text-[11px] text-muted-foreground/60">
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
          <div className="rounded-xl border bg-card shadow-xs">
            {(byDay.get(range.days[0]!) ?? []).length === 0 ? (
              <Empty className="py-16">
                <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-muted/70 text-muted-foreground">
                  <CalendarIcon className="size-5" />
                </div>
                <EmptyTitle>No reservations</EmptyTitle>
                <EmptyDescription>
                  Nothing scheduled for this day with the current filters.
                </EmptyDescription>
              </Empty>
            ) : (
              <div className="flex flex-col gap-2.5 p-3 sm:p-4">
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
