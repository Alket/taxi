"use client"

import * as React from "react"
import useSWR from "swr"
import {
  BanknoteIcon,
  TrendingUpIcon,
  WalletIcon,
} from "lucide-react"

import { AdminDateField } from "@/components/admin/date-field"
import { DriverPageHeader } from "@/components/driver/driver-page-header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { fetcher } from "@/lib/api"
import {
  addDays,
  startOfDay,
  startOfMonth,
  startOfWeek,
  toDateInputValue,
} from "@/lib/dashboard"
import { formatMoney } from "@/lib/format"
import type { DriverAnalyticsReport } from "@/lib/types"

type DatePreset = {
  id: string
  label: string
  from: string
  to: string
}

function buildPresets(now = new Date()): DatePreset[] {
  const today = toDateInputValue(now)
  const weekStart = toDateInputValue(startOfWeek(now))
  const monthStart = toDateInputValue(startOfMonth(now))
  const last30 = toDateInputValue(addDays(startOfDay(now), -29))

  return [
    { id: "today", label: "Today", from: today, to: today },
    { id: "week", label: "This week", from: weekStart, to: today },
    { id: "month", label: "This month", from: monthStart, to: today },
    { id: "30d", label: "Last 30 days", from: last30, to: today },
  ]
}

function DailyChart({
  series,
  currency,
}: {
  series: DriverAnalyticsReport["dailySeries"]
  currency: string
}) {
  const max = Math.max(...series.map((point) => point.total), 1)

  if (series.every((point) => point.total === 0)) {
    return (
      <p className="text-sm text-muted-foreground">
        No payments in this date range.
      </p>
    )
  }

  return (
    <div className="flex h-40 items-end gap-1 overflow-x-auto pb-1">
      {series.map((point) => {
        const height = Math.max(4, (point.total / max) * 100)
        return (
          <div
            key={point.date}
            className="flex min-w-7 flex-1 flex-col items-center gap-1"
            title={`${point.date}: ${formatMoney(point.total, currency)}`}
          >
            <div className="flex h-28 w-full items-end justify-center">
              <div
                className="w-full max-w-3 rounded-t bg-primary/80"
                style={{ height: `${height}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground">
              {point.date.slice(8)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function DriverAnalyticsView() {
  const presets = React.useMemo(() => buildPresets(), [])
  const [dateFrom, setDateFrom] = React.useState(presets[2]!.from)
  const [dateTo, setDateTo] = React.useState(presets[2]!.to)

  React.useEffect(() => {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setDateTo(dateFrom)
    }
  }, [dateFrom, dateTo])

  const query = React.useMemo(() => {
    const params = new URLSearchParams()
    params.set("dateFrom", dateFrom)
    params.set("dateTo", dateTo)
    return `/api/driver/analytics?${params.toString()}`
  }, [dateFrom, dateTo])

  const { data, isLoading, error } = useSWR<DriverAnalyticsReport>(query, fetcher)

  return (
    <div className="flex min-h-dvh flex-col">
      <DriverPageHeader
        title="Analytics"
        description="Your earnings based on when payment was received"
      />

      <div className="flex flex-1 flex-col gap-5 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:gap-6 sm:p-4 md:p-6">
        <Card>
          <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle className="text-base">Date range</CardTitle>
              <CardDescription>Filter by payment received date</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => (
                <Button
                  key={preset.id}
                  type="button"
                  size="sm"
                  variant={
                    dateFrom === preset.from && dateTo === preset.to
                      ? "default"
                      : "outline"
                  }
                  className="h-9 touch-manipulation"
                  onClick={() => {
                    setDateFrom(preset.from)
                    setDateTo(preset.to)
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <AdminDateField label="From" value={dateFrom} onChange={setDateFrom} />
            <AdminDateField label="To" value={dateTo} onChange={setDateTo} />
          </CardContent>
        </Card>

        {error ? (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="pt-6 text-sm text-destructive">
              {(error as Error).message || "Could not load analytics."}
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-3">
          {isLoading && !data ? (
            Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-xl" />
            ))
          ) : data ? (
            <>
              <Card>
                <CardHeader>
                  <CardDescription>Total collected</CardDescription>
                  <CardTitle className="text-2xl tabular-nums">
                    {data.summary.totalCollectedLabel}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    {data.summary.tripCount} trip
                    {data.summary.tripCount === 1 ? "" : "s"} ·{" "}
                    {data.summary.paymentCount} payment
                    {data.summary.paymentCount === 1 ? "" : "s"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardDescription>Cash</CardDescription>
                    <BanknoteIcon className="size-4 text-muted-foreground" />
                  </div>
                  <CardTitle className="text-2xl tabular-nums">
                    {data.summary.cashCollectedLabel}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardDescription>Online</CardDescription>
                    <WalletIcon className="size-4 text-muted-foreground" />
                  </div>
                  <CardTitle className="text-2xl tabular-nums">
                    {data.summary.onlineCollectedLabel}
                  </CardTitle>
                </CardHeader>
              </Card>
            </>
          ) : null}
        </div>

        {data ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Daily revenue</CardTitle>
                <CardDescription>Total collected per day</CardDescription>
              </CardHeader>
              <CardContent>
                <DailyChart series={data.dailySeries} currency={data.currency} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">By route</CardTitle>
                <CardDescription>Cash and online per destination</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.byRoute.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No payments in this period.
                  </p>
                ) : (
                  data.byRoute.map((row) => (
                    <div
                      key={row.zoneId ?? row.routeLabel}
                      className="rounded-lg border px-3 py-2.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {row.routeLabel}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {row.tripCount} trip
                            {row.tripCount === 1 ? "" : "s"}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold tabular-nums">
                          {row.totalCollectedLabel}
                        </p>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          Cash:{" "}
                          <span className="font-medium tabular-nums text-foreground">
                            {row.cashCollectedLabel}
                          </span>
                        </span>
                        <span>
                          Online:{" "}
                          <span className="font-medium tabular-nums text-foreground">
                            {row.onlineCollectedLabel}
                          </span>
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  )
}
