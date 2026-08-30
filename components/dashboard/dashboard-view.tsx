"use client"

import * as React from "react"
import useSWR from "swr"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  Clock,
  RefreshCw,
  TrendingUp,
  UserX,
  Wallet,
} from "lucide-react"

import { fetcher } from "@/lib/api"
import {
  addDays,
  startOfDay,
  startOfMonth,
  startOfWeek,
  toDateInputValue,
} from "@/lib/dashboard"
import { formatMoney, formatTime, VEHICLE_LABELS } from "@/lib/format"
import type { DashboardSummary } from "@/lib/types"
import { cn } from "@/lib/utils"
import { PageHeader } from "@/components/admin/page-header"
import { DirectionIndicator } from "@/components/admin/direction-indicator"
import {
  BookingStatusBadge,
} from "@/components/admin/status-badges"
import { BookingDetail } from "@/components/bookings/booking-detail"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty"

function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  href,
  tone = "primary",
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  hint?: string
  href?: string
  tone?: "primary" | "warning" | "success"
}) {
  const toneMap = {
    primary: "bg-primary/10 text-primary",
    warning: "bg-warning/15 text-warning",
    success: "bg-success/15 text-success",
  }
  const content = (
    <Card
      className={cn(
        "h-full transition-shadow",
        href && "hover:ring-primary/30 hover:shadow-sm",
      )}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardDescription>{label}</CardDescription>
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-lg",
              toneMap[tone],
            )}
          >
            <Icon className="size-4" />
          </span>
        </div>
        <CardTitle className="text-xl font-semibold tabular-nums sm:text-2xl">
          {value}
        </CardTitle>
      </CardHeader>
      {hint && (
        <CardContent className="hidden sm:block">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            {href && <ArrowUpRight className="size-3.5" />}
            {hint}
          </p>
        </CardContent>
      )}
    </Card>
  )

  if (href) {
    return (
      <Link href={href} className="block focus-visible:outline-none">
        {content}
      </Link>
    )
  }
  return content
}

export function DashboardView() {
  const [selectedBookingId, setSelectedBookingId] = React.useState<
    string | null
  >(null)
  const [uncollectedOpen, setUncollectedOpen] = React.useState(false)

  const { data, isLoading, mutate, isValidating } = useSWR<DashboardSummary>(
    "/api/admin/dashboard-summary",
    fetcher,
    { refreshInterval: 60_000 },
  )

  const today = toDateInputValue(startOfDay(new Date()))
  const weekFrom = toDateInputValue(startOfWeek(new Date()))
  const weekTo = toDateInputValue(addDays(startOfWeek(new Date()), 6))
  const monthFrom = toDateInputValue(startOfMonth(new Date()))
  const monthTo = today

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Operational overview for today"
        actions={
          <Button
            variant="outline"
            size="sm"
            className="h-10 w-full touch-manipulation sm:h-8 sm:w-auto"
            disabled={isValidating}
            onClick={() => void mutate()}
          >
            <RefreshCw
              className={cn("size-3.5", isValidating && "animate-spin")}
            />
            Refresh
          </Button>
        }
      />
      <div className="flex flex-col gap-5 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:gap-6 sm:p-4 md:p-6">
        <section className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-3">
          {isLoading || !data ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-16" />
                </CardHeader>
              </Card>
            ))
          ) : (
            <>
              <StatCard
                label="Bookings today"
                value={String(data.bookingsToday)}
                icon={CalendarCheck}
                href={`/admin/bookings?dateFrom=${today}&dateTo=${today}`}
                hint="Pickups scheduled today"
              />
              <StatCard
                label="Bookings this week"
                value={String(data.bookingsThisWeek)}
                icon={CalendarDays}
                href={`/admin/bookings?dateFrom=${weekFrom}&dateTo=${weekTo}`}
                hint="From Monday to Sunday"
              />
              <StatCard
                label="Unassigned bookings"
                value={String(data.unassignedCount)}
                icon={UserX}
                tone="warning"
                href="/admin/bookings?driverId=null&status=confirmed"
                hint="Need a driver assigned"
              />
              <StatCard
                label="Uncollected profit"
                value={formatMoney(
                  data.uncollectedProfitTotal,
                  data.currency,
                )}
                icon={Banknote}
                tone="warning"
                href="/admin/bookings?status=completed&profitCollected=due&dateFrom=&dateTo="
                hint={`${data.uncollectedProfitCount} completed trip${data.uncollectedProfitCount === 1 ? "" : "s"} with profit due`}
              />
              <StatCard
                label="Revenue this month"
                value={formatMoney(data.revenueThisMonth, data.currency)}
                icon={Wallet}
                tone="success"
                hint="Bookings with deposit paid (created this month)"
              />
              <StatCard
                label="Profit this month"
                value={formatMoney(data.profitThisMonth, data.currency)}
                icon={TrendingUp}
                tone="success"
                href={`/admin/analytics?dateFrom=${monthFrom}&dateTo=${monthTo}`}
                hint={`${data.profitThisMonthTripCount} trip${data.profitThisMonthTripCount === 1 ? "" : "s"} with driver cost (pickups this month)`}
              />
            </>
          )}
        </section>

        <Card className="gap-0 py-0">
          <CardHeader className="flex-col items-stretch gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              className="flex min-w-0 flex-1 items-start gap-2.5 text-left touch-manipulation sm:items-center"
              onClick={() => setUncollectedOpen((open) => !open)}
              aria-expanded={uncollectedOpen}
            >
              <Banknote className="mt-0.5 size-4 shrink-0 text-warning sm:mt-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm">Uncollected profit</CardTitle>
                  {!isLoading && data ? (
                    <span className="rounded-md bg-warning/15 px-1.5 py-0.5 text-xs font-medium tabular-nums text-warning">
                      {data.uncollectedProfitCount}
                    </span>
                  ) : null}
                </div>
                <CardDescription className="text-xs">
                  Completed trips with driver cost set — profit not marked
                  collected yet
                </CardDescription>
              </div>
              <ChevronDown
                className={cn(
                  "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform sm:mt-0",
                  uncollectedOpen && "rotate-180",
                )}
              />
            </button>
            <Button
              variant="outline"
              size="sm"
              className="h-10 w-full touch-manipulation sm:h-8 sm:w-auto"
              nativeButton={false}
              render={
                <Link href="/admin/bookings?status=completed&profitCollected=due&dateFrom=&dateTo=" />
              }
            >
              View all
              <ArrowUpRight data-icon="inline-end" />
            </Button>
          </CardHeader>
          {uncollectedOpen ? (
            <CardContent className="border-t p-0">
              {isLoading ? (
                <div className="flex flex-col gap-3 p-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : data && data.uncollectedProfit.length > 0 ? (
                <ul className="divide-y">
                  {data.uncollectedProfit.map((b) => (
                    <li key={b.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedBookingId(b.id)}
                        className="flex w-full touch-manipulation gap-3 px-3 py-3.5 text-left transition-colors hover:bg-muted/50 active:bg-muted/60 sm:px-4 md:px-6"
                      >
                        <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-lg bg-warning/15 px-2 py-2 text-center">
                          <span className="text-sm font-semibold tabular-nums text-warning">
                            {b.profit != null
                              ? formatMoney(b.profit, b.currency)
                              : "—"}
                          </span>
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">
                                {b.customer.name}
                              </p>
                              <p className="font-mono text-xs text-muted-foreground">
                                {b.referenceCode}
                              </p>
                            </div>
                            <BookingStatusBadge status={b.status} />
                          </div>
                          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            {b.pickupAddress} → {b.dropoffAddress}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            <span>{formatTime(b.pickupDateTime)}</span>
                            <span>·</span>
                            <span>
                              Total {formatMoney(b.totalPrice, b.currency)}
                            </span>
                            {b.driver ? (
                              <>
                                <span>·</span>
                                <span>{b.driver.name}</span>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty className="py-10">
                  <EmptyTitle>No uncollected profit</EmptyTitle>
                  <EmptyDescription>
                    All completed trips with a driver cost have profit marked
                    collected.
                  </EmptyDescription>
                </Empty>
              )}
            </CardContent>
          ) : null}
        </Card>

        <Card className="gap-0 py-0">
          <CardHeader className="flex-col items-stretch gap-3 border-b py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5 sm:items-center">
              <Clock className="mt-0.5 size-4 shrink-0 text-primary sm:mt-0" />
              <div>
                <CardTitle className="text-sm">Urgent unassigned pickups</CardTitle>
                <CardDescription className="text-xs">
                  Next 4 hours — trips still needing a driver
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-10 w-full touch-manipulation sm:h-8 sm:w-auto"
              nativeButton={false}
              render={<Link href="/admin/bookings" />}
            >
              All bookings
              <ArrowUpRight data-icon="inline-end" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex flex-col gap-3 p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : data && data.upcomingUrgent.length > 0 ? (
              <ul className="divide-y">
                {data.upcomingUrgent.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedBookingId(b.id)}
                      className="flex w-full touch-manipulation gap-3 px-3 py-3.5 text-left transition-colors hover:bg-muted/50 active:bg-muted/60 sm:px-4 md:px-6"
                    >
                      <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-accent px-2 py-2 text-center">
                        <span className="text-sm font-semibold tabular-nums text-accent-foreground">
                          {formatTime(b.pickupDateTime)}
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">
                              {b.customer.name}
                            </p>
                            <p className="font-mono text-xs text-muted-foreground">
                              {b.referenceCode}
                            </p>
                          </div>
                          <DirectionIndicator
                            direction={b.direction}
                            className="shrink-0"
                          />
                        </div>
                        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {b.pickupAddress} → {b.dropoffAddress}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-warning/18 px-2 py-0.5 text-xs font-medium text-warning">
                            <AlertTriangle className="size-3" />
                            Unassigned
                          </span>
                          <BookingStatusBadge status={b.status} />
                          <span className="text-xs text-muted-foreground">
                            {VEHICLE_LABELS[b.vehicleType]}
                          </span>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty className="py-10">
                <EmptyTitle>No urgent unassigned pickups</EmptyTitle>
                <EmptyDescription>
                  There are no unassigned trips scheduled in the next 4 hours.
                </EmptyDescription>
              </Empty>
            )}
          </CardContent>
        </Card>
      </div>

      <BookingDetail
        bookingId={selectedBookingId}
        open={!!selectedBookingId}
        onOpenChange={(open) => {
          if (!open) setSelectedBookingId(null)
        }}
        onMutated={() => {
          void mutate()
        }}
      />
    </>
  )
}
