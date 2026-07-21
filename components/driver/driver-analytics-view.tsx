"use client"

import * as React from "react"
import Link from "next/link"
import useSWR from "swr"
import {
  ArrowLeftIcon,
  BanknoteIcon,
  TrendingUpIcon,
  WalletIcon,
} from "lucide-react"

import { AdminDateField } from "@/components/admin/date-field"
import { AdminThemeToggle } from "@/components/admin/theme-toggle"
import { Button } from "@/components/ui/button"
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
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 mb-1 h-8 px-2 text-muted-foreground"
            nativeButton={false}
            render={<Link href="/driver" />}
          >
            <ArrowLeftIcon data-icon="inline-start" />
            Trips
          </Button>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Your earnings
          </p>
          <h1 className="text-xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-xs text-muted-foreground">
            Based on when payment was received
          </p>
        </div>
        <AdminThemeToggle />
      </header>

      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Date range</h2>
        <div className="mt-3 flex flex-wrap gap-2">
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
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <AdminDateField label="From" value={dateFrom} onChange={setDateFrom} />
          <AdminDateField label="To" value={dateTo} onChange={setDateTo} />
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {(error as Error).message || "Could not load analytics."}
        </div>
      ) : null}

      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Summary</h2>
        {isLoading && !data ? (
          <Skeleton className="mt-3 h-24 w-full" />
        ) : data ? (
          <div className="mt-3 grid grid-cols-1 gap-3">
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
                  Total collected
                </p>
                <TrendingUpIcon className="size-4 text-primary" />
              </div>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {data.summary.totalCollectedLabel}
              </p>
              <p className="text-xs text-muted-foreground">
                {data.summary.tripCount} trip
                {data.summary.tripCount === 1 ? "" : "s"} ·{" "}
                {data.summary.paymentCount} payment
                {data.summary.paymentCount === 1 ? "" : "s"}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
                    Cash
                  </p>
                  <BanknoteIcon className="size-3.5 text-muted-foreground" />
                </div>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {data.summary.cashCollectedLabel}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
                    Online
                  </p>
                  <WalletIcon className="size-3.5 text-muted-foreground" />
                </div>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {data.summary.onlineCollectedLabel}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {data ? (
        <>
          <section className="rounded-xl border bg-card p-4 shadow-sm">
            <h2 className="text-sm font-semibold">Daily revenue</h2>
            <p className="text-xs text-muted-foreground">
              Total collected per day
            </p>
            <div className="mt-3">
              <DailyChart series={data.dailySeries} currency={data.currency} />
            </div>
          </section>

          <section className="rounded-xl border bg-card p-4 shadow-sm">
            <h2 className="text-sm font-semibold">By route</h2>
            <p className="text-xs text-muted-foreground">
              Cash and online per destination
            </p>
            <div className="mt-3 space-y-2">
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
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
