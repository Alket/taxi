"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import useSWR from "swr"
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  XIcon,
} from "lucide-react"

import { fetcher } from "@/lib/api"
import { BOOKING_STATUS_FLOW } from "@/lib/booking-status"
import {
  BOOKING_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  VEHICLE_LABELS,
  formatDateTime,
  formatMoney,
} from "@/lib/format"
import type { Booking, Driver, PaymentStatus } from "@/lib/types"
import { cn } from "@/lib/utils"
import { PageHeader } from "@/components/admin/page-header"
import { AdminDateField } from "@/components/admin/date-field"
import {
  AdminDriverField,
  type DriverFilterValue,
} from "@/components/admin/driver-field"
import { DirectionIndicator } from "@/components/admin/direction-indicator"
import {
  BookingStatusBadge,
  FlightStatusBadge,
  PaymentStatusBadge,
} from "@/components/admin/status-badges"
import { BookingDetail } from "@/components/bookings/booking-detail"
import { NewBookingSheet } from "@/components/bookings/new-booking-sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty"

const PAGE_SIZE = 20

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All statuses" },
  ...BOOKING_STATUS_FLOW.map((s) => ({
    value: s,
    label: BOOKING_STATUS_LABELS[s],
  })),
  { value: "cancelled", label: BOOKING_STATUS_LABELS.cancelled },
]

const PAYMENT_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All payments" },
  ...(Object.keys(PAYMENT_STATUS_LABELS) as PaymentStatus[]).map((s) => ({
    value: s,
    label: PAYMENT_STATUS_LABELS[s],
  })),
]

const STATUS_ITEMS = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label]),
)
const PAYMENT_ITEMS = Object.fromEntries(
  PAYMENT_OPTIONS.map((o) => [o.value, o.label]),
)

type BookingsResponse = {
  bookings: Booking[]
  total: number
  page: number
  pageSize: number
}

function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

function normalizeDriverFilter(value: string | null): DriverFilterValue {
  if (!value || value === "all") return "all"
  if (value === "null") return "unassigned"
  return value
}

export function BookingsView() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [status, setStatus] = React.useState(
    () => searchParams.get("status") ?? "all",
  )
  const [paymentStatus, setPaymentStatus] = React.useState("all")
  const [driverId, setDriverId] = React.useState(() =>
    normalizeDriverFilter(
      searchParams.get("driverId") ?? searchParams.get("driver"),
    ),
  )
  const [dateFrom, setDateFrom] = React.useState(
    () => searchParams.get("dateFrom") ?? "",
  )
  const [dateTo, setDateTo] = React.useState(
    () => searchParams.get("dateTo") ?? "",
  )
  const [searchInput, setSearchInput] = React.useState(
    searchParams.get("ref") ?? "",
  )
  const [page, setPage] = React.useState(1)
  const [filtersOpen, setFiltersOpen] = React.useState(false)
  const search = useDebounced(searchInput)

  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  React.useEffect(() => {
    const bookingId =
      searchParams.get("bookingId") ?? searchParams.get("booking")
    if (bookingId) {
      setSelectedId(bookingId)
    }
    setDateFrom(searchParams.get("dateFrom") ?? "")
    setDateTo(searchParams.get("dateTo") ?? "")
    const nextStatus = searchParams.get("status")
    if (nextStatus) setStatus(nextStatus)
    const nextDriver = normalizeDriverFilter(
      searchParams.get("driverId") ?? searchParams.get("driver"),
    )
    if (searchParams.has("driverId") || searchParams.has("driver")) {
      setDriverId(nextDriver)
    }
  }, [searchParams])

  const statusSelectValue =
    status.includes(",") || !STATUS_ITEMS[status] ? "all" : status

  const { data: driverData } = useSWR<{ drivers: Driver[] }>(
    "/api/admin/drivers",
    fetcher,
  )
  const drivers = driverData?.drivers ?? []

  React.useEffect(() => {
    setPage(1)
  }, [status, paymentStatus, driverId, search, dateFrom, dateTo])

  // Keep range valid when "From" moves past "To" (string YYYY-MM-DD compares safely).
  React.useEffect(() => {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setDateTo(dateFrom)
    }
  }, [dateFrom, dateTo])

  const query = React.useMemo(() => {
    const params = new URLSearchParams()
    if (status !== "all") params.set("status", status)
    if (paymentStatus !== "all") params.set("paymentStatus", paymentStatus)
    if (driverId !== "all") params.set("driverId", driverId)
    if (search.trim()) params.set("search", search.trim())
    if (dateFrom) params.set("dateFrom", dateFrom)
    if (dateTo) params.set("dateTo", dateTo)
    params.set("page", String(page))
    params.set("pageSize", String(PAGE_SIZE))
    return params.toString()
  }, [status, paymentStatus, driverId, search, dateFrom, dateTo, page])

  const { data, isLoading, mutate } = useSWR<BookingsResponse>(
    `/api/admin/bookings?${query}`,
    fetcher,
  )

  const bookings = data?.bookings ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const advancedFilterCount = [
    status !== "all",
    paymentStatus !== "all",
    driverId !== "all",
    !!dateFrom,
    !!dateTo,
  ].filter(Boolean).length

  const hasFilters = advancedFilterCount > 0 || !!searchInput

  function resetFilters() {
    setStatus("all")
    setPaymentStatus("all")
    setDriverId("all")
    setDateFrom("")
    setDateTo("")
    setSearchInput("")
    setPage(1)
    router.replace("/admin/bookings")
  }

  return (
    <>
      <PageHeader
        title="Bookings"
        description="Manage and track all transfer bookings"
        actions={
          <NewBookingSheet
            onCreated={() => {
              void mutate()
            }}
          />
        }
      />
      <div className="flex flex-col gap-4 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-4 md:p-6">
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:p-4">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search ref, name, or email"
              className="h-11 pl-9 text-base md:h-9 md:text-sm"
              aria-label="Search bookings"
            />
          </div>

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

          <div
            className={cn(
              "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4",
              !filtersOpen && "hidden",
            )}
          >
            <FilterField label="Status">
              <Select
                value={statusSelectValue}
                onValueChange={(value) => {
                  if (value) setStatus(value)
                }}
                items={STATUS_ITEMS}
              >
                <SelectTrigger className="h-10 w-full md:h-8" size="default">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Payment">
              <Select
                value={paymentStatus}
                onValueChange={(value) => {
                  if (value) setPaymentStatus(value)
                }}
                items={PAYMENT_ITEMS}
              >
                <SelectTrigger className="h-10 w-full md:h-8" size="default">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
            <AdminDriverField
              label="Driver"
              value={driverId}
              onChange={setDriverId}
              drivers={drivers}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <AdminDateField
                label="From"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={setDateFrom}
                placeholder="Start date"
              />
              <AdminDateField
                label="To"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={setDateTo}
                placeholder="End date"
              />
            </div>
          </div>

          {!isLoading && (
            <p className="text-xs text-muted-foreground tabular-nums">
              {total} {total === 1 ? "result" : "results"}
            </p>
          )}
        </div>

        {/* Mobile card list */}
        <div className="flex flex-col gap-2.5 md:hidden">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))
          ) : bookings.length > 0 ? (
            bookings.map((b) => (
              <BookingMobileCard
                key={b.id}
                booking={b}
                selected={selectedId === b.id}
                onSelect={() => setSelectedId(b.id)}
              />
            ))
          ) : (
            <div className="rounded-xl border bg-card py-10">
              <Empty>
                <EmptyTitle>No bookings found</EmptyTitle>
                <EmptyDescription>
                  {hasFilters
                    ? "No bookings match these filters."
                    : "There are no bookings yet."}
                </EmptyDescription>
              </Empty>
            </div>
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="pl-4">Reference</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-center">Route</TableHead>
                <TableHead>Pickup</TableHead>
                <TableHead>Flight</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="pr-4">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={9} className="pl-4">
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : bookings.length > 0 ? (
                bookings.map((b) => (
                  <TableRow
                    key={b.id}
                    onClick={() => setSelectedId(b.id)}
                    className="cursor-pointer"
                    data-state={selectedId === b.id ? "selected" : undefined}
                  >
                    <TableCell className="pl-4 font-mono text-xs font-medium">
                      {b.referenceCode}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{b.customer.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {b.passengerCount} pax · {b.luggageCount} bags
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <DirectionIndicator
                        direction={b.direction}
                        className="justify-center"
                      />
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {formatDateTime(b.pickupDateTime)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <span className="font-mono text-xs">
                          {b.flightNumber}
                        </span>
                        <FlightStatusBadge status={b.flightStatus} />
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {VEHICLE_LABELS[b.vehicleType]}
                    </TableCell>
                    <TableCell>
                      {b.driver ? (
                        <span className="text-sm">{b.driver.name}</span>
                      ) : (
                        <Badge variant="destructive" className="font-normal">
                          Unassigned
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <PaymentStatusBadge status={b.paymentStatus} />
                    </TableCell>
                    <TableCell className="pr-4">
                      <BookingStatusBadge status={b.status} />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={9}>
                    <Empty className="py-12">
                      <EmptyTitle>No bookings found</EmptyTitle>
                      <EmptyDescription>
                        {hasFilters
                          ? "No bookings match these filters."
                          : "There are no bookings yet."}
                      </EmptyDescription>
                    </Empty>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {!isLoading && total > 0 && (
          <div className="flex items-center justify-between gap-3">
            <p className="hidden text-sm text-muted-foreground sm:block">
              Showing {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, total)} of {total}
            </p>
            <p className="text-sm text-muted-foreground tabular-nums sm:hidden">
              {page}/{totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="size-10 touch-manipulation sm:size-8 sm:w-auto sm:px-3"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                aria-label="Previous page"
              >
                <ChevronLeftIcon />
                <span className="hidden sm:inline">Previous</span>
              </Button>
              <span className="hidden text-sm text-muted-foreground sm:inline">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="size-10 touch-manipulation sm:size-8 sm:w-auto sm:px-3"
                disabled={page >= totalPages}
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                aria-label="Next page"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRightIcon />
              </Button>
            </div>
          </div>
        )}
      </div>

      <BookingDetail
        bookingId={selectedId}
        open={!!selectedId}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null)
            if (
              searchParams.has("bookingId") ||
              searchParams.has("booking")
            ) {
              const params = new URLSearchParams(searchParams.toString())
              params.delete("bookingId")
              params.delete("booking")
              const query = params.toString()
              router.replace(
                query ? `/admin/bookings?${query}` : "/admin/bookings",
                { scroll: false },
              )
            }
          }
        }}
        onMutated={() => mutate()}
      />
    </>
  )
}

function BookingMobileCard({
  booking: b,
  selected,
  onSelect,
}: {
  booking: Booking
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full flex-col gap-2.5 rounded-xl border bg-card p-3.5 text-left shadow-sm transition-colors touch-manipulation active:bg-muted/40",
        selected && "ring-2 ring-ring/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold">{b.customer.name}</p>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
            {b.referenceCode}
          </p>
        </div>
        <BookingStatusBadge status={b.status} />
      </div>

      <div className="flex items-center gap-2 text-sm">
        <DirectionIndicator direction={b.direction} />
        <span className="min-w-0 truncate text-muted-foreground">
          {formatDateTime(b.pickupDateTime)}
        </span>
      </div>

      <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
        {b.pickupAddress} → {b.dropoffAddress}
      </p>

      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <PaymentStatusBadge status={b.paymentStatus} />
        {b.driver ? (
          <Badge variant="secondary" className="font-normal">
            {b.driver.name}
          </Badge>
        ) : (
          <Badge variant="destructive" className="font-normal">
            Unassigned
          </Badge>
        )}
        <span className="text-xs text-muted-foreground">
          {VEHICLE_LABELS[b.vehicleType]} · {formatMoney(b.totalPrice, b.currency)}
        </span>
      </div>
    </button>
  )
}

function FilterField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}
