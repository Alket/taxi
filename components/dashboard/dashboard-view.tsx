"use client"

import * as React from "react"
import useSWR from "swr"
import Link from "next/link"
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
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
import { BookingStatusBadge } from "@/components/admin/status-badges"
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
  highlight = false,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  hint?: string
  href?: string
  tone?: "primary" | "warning" | "success"
  highlight?: boolean
}) {
  const toneMap = {
    primary: "bg-primary/10 text-primary",
    warning: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  }
  const content = (
    <Card
      className={cn(
        "group flex h-full flex-col justify-between shadow-xs transition-all",
        highlight &&
          tone === "warning" &&
          "border-amber-500/40 bg-amber-500/[0.04]",
        href &&
          "hover:border-primary/40 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardDescription className="text-[11px] font-medium tracking-wide uppercase">
            {label}
          </CardDescription>
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg",
              toneMap[tone],
            )}
          >
            <Icon className="size-4" />
          </span>
        </div>
        <CardTitle className="mt-1 text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">
          {value}
        </CardTitle>
      </CardHeader>
      {hint ? (
        <CardContent className="pt-0">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            {href ? (
              <ArrowUpRight className="size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            ) : null}
            <span className="line-clamp-1">{hint}</span>
          </p>
        </CardContent>
      ) : null}
    </Card>
  )

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
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

  const { data, error, isLoading, mutate, isValidating } =
    useSWR<DashboardSummary>("/api/admin/dashboard-summary", fetcher, {
      refreshInterval: 60_000,
    })

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
            className="h-10 w-full touch-manipulation gap-1.5 sm:h-8 sm:w-auto"
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

      <div className="flex w-full flex-col gap-5 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:gap-6 sm:p-4 md:p-6">
        {error ? (
          <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive sm:flex-row sm:items-center">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="size-4 shrink-0" />
              <p>Could not load dashboard summary.</p>
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
        ) : null}

        <section className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-3">
          {isLoading && !data ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))
          ) : data ? (
            <>
              <StatCard
                label="Bookings today"
                value={String(data.bookingsToday)}
                icon={CalendarCheck}
                href={`/admin/bookings?dateFrom=${today}&dateTo=${today}`}
                hint="Active pickups today"
              />
              <StatCard
                label="Bookings this week"
                value={String(data.bookingsThisWeek)}
                icon={CalendarDays}
                href={`/admin/bookings?dateFrom=${weekFrom}&dateTo=${weekTo}`}
                hint="Active pickups Mon–Sun"
              />
              <StatCard
                label="Unassigned"
                value={String(data.unassignedCount)}
                icon={UserX}
                tone="warning"
                highlight={data.unassignedCount > 0}
                href="/admin/bookings?driverId=null&status=confirmed"
                hint="Confirmed trips needing a driver"
              />
              <StatCard
                label="Uncollected profit"
                value={formatMoney(
                  data.uncollectedProfitTotal,
                  data.currency,
                )}
                icon={Banknote}
                tone="warning"
                highlight={data.uncollectedProfitCount > 0}
                href="/admin/bookings?status=completed&profitCollected=due&dateFrom=&dateTo="
                hint={`${data.uncollectedProfitCount} completed trip${data.uncollectedProfitCount === 1 ? "" : "s"} due`}
              />
              <StatCard
                label="Revenue this month"
                value={formatMoney(data.revenueThisMonth, data.currency)}
                icon={Wallet}
                tone="success"
                href={`/admin/bookings?status=completed&dateFrom=${monthFrom}&dateTo=${monthTo}`}
                hint={`${data.revenueThisMonthTripCount} completed trip${data.revenueThisMonthTripCount === 1 ? "" : "s"} collected`}
              />
              <StatCard
                label="Profit this month"
                value={formatMoney(data.profitThisMonth, data.currency)}
                icon={TrendingUp}
                tone="success"
                href={`/admin/analytics?dateFrom=${monthFrom}&dateTo=${monthTo}`}
                hint={`${data.profitThisMonthTripCount} trip${data.profitThisMonthTripCount === 1 ? "" : "s"} with driver cost`}
              />
            </>
          ) : null}
        </section>

        <Card className="gap-0 py-0 shadow-xs">
          <CardHeader className="flex-col items-stretch gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setUncollectedOpen((open) => !open)}
              aria-expanded={uncollectedOpen}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300">
                <Banknote className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-sm font-semibold">
                    Uncollected profit
                  </CardTitle>
                  {!isLoading && data ? (
                    <>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                          data.uncollectedProfitCount > 0
                            ? "bg-amber-500/15 text-amber-800 dark:text-amber-200"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {data.uncollectedProfitCount}
                      </span>
                      {data.uncollectedProfitCount > 0 ? (
                        <span className="text-xs font-semibold tabular-nums text-amber-700 dark:text-amber-300">
                          {formatMoney(
                            data.uncollectedProfitTotal,
                            data.currency,
                          )}
                        </span>
                      ) : null}
                    </>
                  ) : null}
                </div>
                <CardDescription className="mt-0.5 text-xs">
                  Completed trips with driver cost set — profit not marked
                  collected yet
                </CardDescription>
              </div>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform",
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
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              ) : data && data.uncollectedProfit.length > 0 ? (
                <ul className="divide-y">
                  {data.uncollectedProfit.map((b) => (
                    <li key={b.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedBookingId(b.id)}
                        className="group flex w-full touch-manipulation items-center gap-3 px-3 py-3.5 text-left transition-colors hover:bg-muted/40 active:bg-muted/60 sm:px-4 md:px-6"
                      >
                        <div className="flex w-18 shrink-0 flex-col items-center justify-center rounded-lg border border-amber-500/25 bg-amber-500/10 px-2 py-2 text-center">
                          <span className="text-sm font-bold tabular-nums text-amber-800 dark:text-amber-200">
                            {b.profit != null
                              ? formatMoney(b.profit, b.currency)
                              : "—"}
                          </span>
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex min-w-0 items-baseline gap-2">
                              <p className="truncate text-sm font-semibold">
                                {b.customer.name}
                              </p>
                              <p className="shrink-0 font-mono text-xs text-muted-foreground">
                                {b.referenceCode}
                              </p>
                            </div>
                            <BookingStatusBadge status={b.status} />
                          </div>
                          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                            <span className="truncate">{b.pickupAddress}</span>
                            <ArrowRight className="size-3 shrink-0" />
                            <span className="truncate">{b.dropoffAddress}</span>
                          </p>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                            <span className="tabular-nums">
                              {formatTime(b.pickupDateTime)}
                            </span>
                            <span>·</span>
                            <span className="font-medium tabular-nums text-foreground">
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
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty className="py-10">
                  <div className="mx-auto mb-2.5 flex size-11 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="size-5" />
                  </div>
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

        <Card className="gap-0 py-0 shadow-xs">
          <CardHeader className="flex-col items-stretch gap-3 border-b py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg",
                  data && data.upcomingUrgent.length > 0
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                    : "bg-primary/10 text-primary",
                )}
              >
                <Clock className="size-4" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-semibold">
                    Urgent unassigned pickups
                  </CardTitle>
                  {!isLoading && data ? (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                        data.upcomingUrgent.length > 0
                          ? "bg-amber-500/15 text-amber-800 dark:text-amber-200"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {data.upcomingUrgent.length}
                    </span>
                  ) : null}
                </div>
                <CardDescription className="mt-0.5 text-xs">
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
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : data && data.upcomingUrgent.length > 0 ? (
              <ul className="divide-y">
                {data.upcomingUrgent.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedBookingId(b.id)}
                      className="group flex w-full touch-manipulation items-center gap-3 px-3 py-3.5 text-left transition-colors hover:bg-muted/40 active:bg-muted/60 sm:px-4 md:px-6"
                    >
                      <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-lg border bg-muted/50 px-2 py-2 text-center">
                        <span className="text-sm font-bold tabular-nums text-foreground">
                          {formatTime(b.pickupDateTime)}
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-baseline gap-2">
                            <p className="truncate text-sm font-semibold">
                              {b.customer.name}
                            </p>
                            <p className="shrink-0 font-mono text-xs text-muted-foreground">
                              {b.referenceCode}
                            </p>
                          </div>
                          <DirectionIndicator
                            direction={b.direction}
                            className="shrink-0"
                          />
                        </div>
                        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                          <span className="truncate">{b.pickupAddress}</span>
                          <ArrowRight className="size-3 shrink-0" />
                          <span className="truncate">{b.dropoffAddress}</span>
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-200">
                            <AlertTriangle className="size-3" />
                            Unassigned
                          </span>
                          <BookingStatusBadge status={b.status} />
                          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                            {VEHICLE_LABELS[b.vehicleType]}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty className="py-12">
                <div className="mx-auto mb-2.5 flex size-11 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="size-5" />
                </div>
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
