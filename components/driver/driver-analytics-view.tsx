"use client"

import * as React from "react"
import useSWR from "swr"
import {
  AlertCircleIcon,
  BanknoteIcon,
  BarChart3Icon,
  CalendarIcon,
  MapPinIcon,
  RefreshCwIcon,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import {
  DRIVER_INTL_LOCALE,
  useDriverLocale,
  useDriverT,
  type DriverLocale,
  type DriverMessageKey,
} from "@/lib/i18n/driver"
import type { DriverAnalyticsReport } from "@/lib/types"
import { cn } from "@/lib/utils"

type DatePreset = {
  id: string
  labelKey: string
  from: string
  to: string
}

type MonthlyRevenue = {
  year: number
  month: number
  monthLabel: string
  completedTrips: number
  total: number
  totalLabel: string
  cashCollected: number
  cashCollectedLabel: string
  currency: string
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

function buildPresets(now = new Date()): DatePreset[] {
  const today = toDateInputValue(now)
  const weekStart = toDateInputValue(startOfWeek(now))
  const monthStart = toDateInputValue(startOfMonth(now))
  const last30 = toDateInputValue(addDays(startOfDay(now), -29))

  return [
    { id: "today", labelKey: "analytics.presetToday", from: today, to: today },
    { id: "week", labelKey: "analytics.presetWeek", from: weekStart, to: today },
    {
      id: "month",
      labelKey: "analytics.presetMonth",
      from: monthStart,
      to: today,
    },
    { id: "30d", labelKey: "analytics.preset30d", from: last30, to: today },
  ]
}

function monthOptions(from: Date, locale: DriverLocale, count = 12) {
  const options: { value: string; label: string; year: number; month: number }[] =
    []
  for (let i = 0; i < count; i++) {
    const d = new Date(from.getFullYear(), from.getMonth() - i, 1)
    const year = d.getFullYear()
    const month = d.getMonth() + 1
    options.push({
      value: `${year}-${month}`,
      year,
      month,
      label: new Intl.DateTimeFormat(DRIVER_INTL_LOCALE[locale], {
        month: "long",
        year: "numeric",
      }).format(d),
    })
  }
  return options
}

function sharePercent(part: number, total: number) {
  if (total <= 0 || part <= 0) return 0
  return Math.round((part / total) * 100)
}

function DailyChart({
  series,
  currency,
  emptyLabel,
}: {
  series: DriverAnalyticsReport["dailySeries"]
  currency: string
  emptyLabel: string
}) {
  const max = Math.max(...series.map((point) => point.total), 1)

  if (series.every((point) => point.total === 0)) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 px-4 py-10 text-center">
        <div className="mb-2.5 flex size-10 items-center justify-center rounded-full bg-muted/70 text-muted-foreground">
          <BarChart3Icon className="size-4" />
        </div>
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      </div>
    )
  }

  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 flex h-32 flex-col justify-between"
      >
        <div className="border-t border-dashed border-border/50" />
        <div className="border-t border-dashed border-border/50" />
        <div className="border-t border-border/70" />
      </div>

      <div className="relative flex h-44 items-end gap-1.5 overflow-x-auto pb-1 pt-2">
        {series.map((point) => {
          const isZero = point.total <= 0
          const height = isZero ? 0 : Math.max(8, (point.total / max) * 100)
          return (
            <div
              key={point.date}
              className="group flex min-w-7 flex-1 flex-col items-center gap-1.5"
              title={`${point.date}: ${formatMoney(point.total, currency)}`}
            >
              <div className="flex h-32 w-full items-end justify-center">
                {isZero ? (
                  <div className="h-1 w-full max-w-4 rounded-full bg-muted" />
                ) : (
                  <div
                    className="w-full max-w-4 rounded-t-md bg-primary/80 transition-colors group-hover:bg-primary"
                    style={{ height: `${height}%` }}
                  />
                )}
              </div>
              <span className="text-[10px] font-medium tabular-nums text-muted-foreground group-hover:text-foreground">
                {point.date.slice(8)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function DriverAnalyticsView() {
  const t = useDriverT()
  const locale = useDriverLocale()
  const presets = React.useMemo(() => buildPresets(), [])
  const [dateFrom, setDateFrom] = React.useState(presets[2]!.from)
  const [dateTo, setDateTo] = React.useState(presets[2]!.to)
  // Track preset by id — on Monday, "today" and "week" share the same dates.
  const [activePresetId, setActivePresetId] = React.useState<string | null>(
    presets[2]!.id,
  )

  const now = React.useMemo(() => new Date(), [])
  const months = React.useMemo(() => monthOptions(now, locale), [now, locale])
  const [monthKey, setMonthKey] = React.useState(
    `${now.getFullYear()}-${now.getMonth() + 1}`,
  )
  const selected = months.find((m) => m.value === monthKey) ?? months[0]!

  React.useEffect(() => {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setDateTo(dateFrom)
    }
  }, [dateFrom, dateTo])

  function applyCustomFrom(next: string) {
    setActivePresetId(null)
    setDateFrom(next)
  }

  function applyCustomTo(next: string) {
    setActivePresetId(null)
    setDateTo(next)
  }

  const query = React.useMemo(() => {
    const params = new URLSearchParams()
    params.set("dateFrom", dateFrom)
    params.set("dateTo", dateTo)
    return `/api/driver/analytics?${params.toString()}`
  }, [dateFrom, dateTo])

  const { data, isLoading, isValidating, error, mutate } =
    useSWR<DriverAnalyticsReport>(query, fetcher)
  const {
    data: revenue,
    isLoading: revenueLoading,
    isValidating: revenueValidating,
    error: revenueError,
    mutate: mutateRevenue,
  } = useSWR<MonthlyRevenue>(
    `/api/driver/revenue?year=${selected.year}&month=${selected.month}`,
    fetcher,
  )

  const refreshing = isValidating || revenueValidating
  const maxRouteTotal = React.useMemo(
    () =>
      data?.byRoute.length
        ? Math.max(...data.byRoute.map((row) => row.totalCollected), 1)
        : 1,
    [data],
  )

  const cashPct = data
    ? sharePercent(data.summary.cashCollected, data.summary.totalCollected)
    : 0
  const onlinePct = data
    ? sharePercent(data.summary.onlineCollected, data.summary.totalCollected)
    : 0

  return (
    <div className="flex min-h-dvh flex-col">
      <DriverPageHeader
        title={t("analytics.title")}
        description={t("analytics.description")}
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 touch-manipulation gap-1.5"
            disabled={refreshing}
            onClick={() => {
              void mutate()
              void mutateRevenue()
            }}
            aria-label={t("trips.refresh")}
          >
            <RefreshCwIcon
              className={cn("size-3.5", refreshing && "animate-spin")}
            />
            <span className="hidden sm:inline">{t("trips.refresh")}</span>
          </Button>
        }
      />

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:gap-6 sm:p-4 md:p-6">
        <Card className="shadow-xs">
          <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <CalendarIcon className="size-4" />
              </div>
              <div>
                <CardTitle className="text-base">
                  {t("analytics.dateRange")}
                </CardTitle>
                <CardDescription>
                  {t("analytics.dateRangeHint")}
                </CardDescription>
              </div>
            </div>
            <div className="inline-flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1">
              {presets.map((preset) => (
                <Button
                  key={preset.id}
                  type="button"
                  size="sm"
                  variant={activePresetId === preset.id ? "default" : "ghost"}
                  className="h-8 flex-1 touch-manipulation px-3 sm:flex-none"
                  onClick={() => {
                    setActivePresetId(preset.id)
                    setDateFrom(preset.from)
                    setDateTo(preset.to)
                  }}
                >
                  {t(preset.labelKey)}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 border-t pt-4 sm:grid-cols-2">
            <AdminDateField
              label={t("analytics.from")}
              value={dateFrom}
              onChange={applyCustomFrom}
            />
            <AdminDateField
              label={t("analytics.to")}
              value={dateTo}
              onChange={applyCustomTo}
            />
          </CardContent>
        </Card>

        {error ? (
          <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive sm:flex-row sm:items-center">
            <div className="flex items-center gap-2.5">
              <AlertCircleIcon className="size-4 shrink-0" />
              <p>{(error as Error).message || t("analytics.loadError")}</p>
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
        ) : null}

        <div className="grid gap-4 lg:grid-cols-3">
          {isLoading && !data ? (
            Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-32 rounded-xl" />
            ))
          ) : data ? (
            <>
              <Card className="shadow-xs">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardDescription className="text-xs font-medium tracking-wide uppercase">
                      {t("analytics.totalCollected")}
                    </CardDescription>
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <TrendingUpIcon className="size-4" />
                    </div>
                  </div>
                  <CardTitle className="text-2xl font-bold tabular-nums sm:text-3xl">
                    {data.summary.totalCollectedLabel}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {t(
                      data.summary.tripCount === 1 &&
                        data.summary.paymentCount === 1
                        ? "analytics.tripsPayments"
                        : "analytics.tripsPayments_other",
                      {
                        trips: data.summary.tripCount,
                        payments: data.summary.paymentCount,
                      },
                    )}
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-xs">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardDescription className="text-xs font-medium tracking-wide uppercase">
                      {t("analytics.cash")}
                    </CardDescription>
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                      <BanknoteIcon className="size-4" />
                    </div>
                  </div>
                  <CardTitle className="text-2xl font-bold tabular-nums sm:text-3xl">
                    {data.summary.cashCollectedLabel}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.summary.totalCollected > 0 ? (
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${cashPct}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium tabular-nums text-muted-foreground">
                        {cashPct}%
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">—</p>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-xs">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardDescription className="text-xs font-medium tracking-wide uppercase">
                      {t("analytics.online")}
                    </CardDescription>
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-700 dark:text-sky-300">
                      <WalletIcon className="size-4" />
                    </div>
                  </div>
                  <CardTitle className="text-2xl font-bold tabular-nums sm:text-3xl">
                    {data.summary.onlineCollectedLabel}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.summary.totalCollected > 0 ? (
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-sky-500"
                          style={{ width: `${onlinePct}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium tabular-nums text-muted-foreground">
                        {onlinePct}%
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">—</p>
                  )}
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>

        {data ? (
          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="shadow-xs">
              <CardHeader>
                <CardTitle className="text-base">
                  {t("analytics.dailyRevenue")}
                </CardTitle>
                <CardDescription>{t("analytics.dailyHint")}</CardDescription>
              </CardHeader>
              <CardContent>
                <DailyChart
                  series={data.dailySeries}
                  currency={data.currency}
                  emptyLabel={t("analytics.noPaymentsRange")}
                />
              </CardContent>
            </Card>

            <Card className="shadow-xs">
              <CardHeader>
                <CardTitle className="text-base">
                  {t("analytics.byRoute")}
                </CardTitle>
                <CardDescription>{t("analytics.byRouteHint")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {data.byRoute.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 px-4 py-10 text-center">
                    <div className="mb-2.5 flex size-10 items-center justify-center rounded-full bg-muted/70 text-muted-foreground">
                      <MapPinIcon className="size-4" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t("analytics.noPaymentsPeriod")}
                    </p>
                  </div>
                ) : (
                  data.byRoute.map((row) => {
                    const widthPct = Math.max(
                      4,
                      Math.round((row.totalCollected / maxRouteTotal) * 100),
                    )
                    return (
                      <div
                        key={row.zoneId ?? row.routeLabel}
                        className="rounded-lg border bg-background/60 px-3.5 py-3 transition-colors hover:bg-muted/30"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {row.routeLabel}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {plural(t, "analytics.tripCount", row.tripCount)}
                            </p>
                          </div>
                          <p className="shrink-0 text-sm font-semibold tabular-nums">
                            {row.totalCollectedLabel}
                          </p>
                        </div>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary/80"
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                          <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 font-medium tabular-nums text-emerald-800 dark:text-emerald-200">
                            {t("analytics.cashLabel", {
                              amount: row.cashCollectedLabel,
                            })}
                          </span>
                          <span className="inline-flex items-center rounded-md bg-sky-500/10 px-2 py-0.5 font-medium tabular-nums text-sky-800 dark:text-sky-200">
                            {t("analytics.onlineLabel", {
                              amount: row.onlineCollectedLabel,
                            })}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}

        <Card className="gap-0 py-0 shadow-xs">
          <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="text-base">
                {t("trips.revenueMonth")}
              </CardTitle>
              <CardDescription className="mt-0.5">
                {revenue
                  ? plural(t, "trips.revenueSummary", revenue.completedTrips, {
                      amount: revenue.totalLabel,
                    })
                  : t("trips.completedTotals")}
              </CardDescription>
            </div>
            <Select
              value={monthKey}
              onValueChange={(value) => {
                if (value) setMonthKey(value)
              }}
            >
              <SelectTrigger size="sm" className="w-full sm:w-[12rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <CardContent className="border-t px-4 pb-4 pt-3.5">
            {revenueError ? (
              <div className="flex flex-col items-start justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive sm:flex-row sm:items-center">
                <div className="flex items-center gap-2">
                  <AlertCircleIcon className="size-4 shrink-0" />
                  <p>
                    {(revenueError as Error).message ||
                      t("analytics.loadError")}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-destructive/30 bg-background text-foreground hover:bg-destructive/10"
                  onClick={() => void mutateRevenue()}
                >
                  {t("trips.retry")}
                </Button>
              </div>
            ) : revenueLoading && !revenue ? (
              <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                <Skeleton className="h-24 w-full rounded-lg" />
                <Skeleton className="h-24 w-full rounded-lg" />
              </div>
            ) : revenue ? (
              <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                <div className="rounded-xl border bg-muted/25 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      {t("trips.tripTotals")}
                    </p>
                    <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <TrendingUpIcon className="size-3.5" />
                    </div>
                  </div>
                  <p className="mt-1.5 text-2xl font-bold tabular-nums">
                    {revenue.totalLabel}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {plural(t, "trips.completedTrips", revenue.completedTrips)}
                  </p>
                </div>
                <div className="rounded-xl border bg-muted/25 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      {t("trips.cashCollected")}
                    </p>
                    <div className="flex size-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                      <WalletIcon className="size-3.5" />
                    </div>
                  </div>
                  <p className="mt-1.5 text-2xl font-bold tabular-nums">
                    {revenue.cashCollectedLabel}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t("trips.fromCompleted")}
                  </p>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
