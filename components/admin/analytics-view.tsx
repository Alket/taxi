"use client"

import * as React from "react"
import useSWR from "swr"
import {
  AlertCircleIcon,
  BanknoteIcon,
  BarChart3Icon,
  CalendarDaysIcon,
  CalendarIcon,
  CarIcon,
  CreditCardIcon,
  DownloadIcon,
  MapPinIcon,
  RefreshCwIcon,
  TrendingUpIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react"

import { AdminDateField } from "@/components/admin/date-field"
import { AdminDriverField } from "@/components/admin/driver-field"
import { PageHeader } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { fetcher } from "@/lib/api"
import {
  addDays,
  startOfDay,
  startOfMonth,
  startOfWeek,
  toDateInputValue,
} from "@/lib/dashboard"
import { formatMoney } from "@/lib/format"
import type { AnalyticsReport, Driver } from "@/lib/types"
import { cn } from "@/lib/utils"

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

function sharePercent(part: number, total: number) {
  if (total <= 0 || part <= 0) return 0
  return Math.round((part / total) * 100)
}

function csvCell(value: string) {
  const neutralized = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return `"${neutralized.replaceAll('"', '""')}"`
}

function sumDriverRevenue(rows: AnalyticsReport["revenueByDriver"]) {
  return rows.reduce(
    (acc, row) => ({
      tripCount: acc.tripCount + row.tripCount,
      cash: acc.cash + row.cashCollected,
      online: acc.online + row.onlineCollected,
      total: acc.total + row.totalCollected,
    }),
    { tripCount: 0, cash: 0, online: 0, total: 0 },
  )
}

function exportCsv(report: AnalyticsReport) {
  const lines = [
    `Analytics report,${report.dateFrom} to ${report.dateTo}`,
    ...(report.driverFilter
      ? [`Driver filter,${csvCell(report.driverFilter.driverName)}`]
      : []),
    "",
    "Summary",
    `Total collected,${report.summary.totalCollected}`,
    `Cash collected,${report.summary.cashCollected}`,
    `Online collected,${report.summary.onlineCollected}`,
    `Payments,${report.summary.paymentCount}`,
    `Completed trips (pickup date),${report.summary.completedTripCount}`,
    `Forfeited deposits,${report.summary.forfeitedDeposits}`,
    `Profit (client price − driver cost),${report.summary.profit}`,
    `Profit trips with driver cost,${report.summary.profitTripCount}`,
    `Outstanding unpaid,${report.outstanding.unpaidBalances}`,
    "",
    "Revenue by driver",
    "Driver,Trips,Cash,Online,Total,Share of cash %",
    ...report.revenueByDriver.map(
      (row) =>
        `${csvCell(row.driverName)},${row.tripCount},${row.cashCollected},${row.onlineCollected},${row.totalCollected},${row.shareOfCash}`,
    ),
    "",
    "Revenue by driver and route",
    "Driver,Route,Trips,Cash,Online,Total",
    ...report.revenueByDriverRoute.map(
      (row) =>
        `${csvCell(row.driverName)},${csvCell(row.routeLabel)},${row.tripCount},${row.cashCollected},${row.onlineCollected},${row.totalCollected}`,
    ),
    "",
    "By provider",
    "Provider,Payments,Amount",
    ...report.byProvider.map(
      (row) => `${csvCell(row.providerLabel)},${row.count},${row.amount}`,
    ),
    "",
    "By zone",
    "Zone,Payments,Amount",
    ...report.byZone.map(
      (row) => `${csvCell(row.label)},${row.count},${row.amount}`,
    ),
    "",
    "By vehicle",
    "Vehicle,Payments,Amount",
    ...report.byVehicle.map(
      (row) => `${csvCell(row.label)},${row.count},${row.amount}`,
    ),
  ]

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `analytics-${report.dateFrom}-${report.dateTo}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

function DailyChart({
  series,
  currency,
}: {
  series: AnalyticsReport["dailySeries"]
  currency: string
}) {
  const max = Math.max(...series.map((point) => point.total), 1)

  if (series.every((point) => point.total === 0)) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 px-4 py-12 text-center">
        <div className="mb-2.5 flex size-10 items-center justify-center rounded-full bg-muted/70 text-muted-foreground">
          <BarChart3Icon className="size-4" />
        </div>
        <p className="text-sm text-muted-foreground">
          No payments in this date range.
        </p>
      </div>
    )
  }

  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-2 flex h-36 flex-col justify-between"
      >
        <div className="border-t border-dashed border-border/50" />
        <div className="border-t border-dashed border-border/50" />
        <div className="border-t border-border/70" />
      </div>

      <div className="relative flex h-48 items-end gap-1.5 overflow-x-auto pb-1 pt-2">
        {series.map((point) => {
          const isZero = point.total <= 0
          const height = isZero ? 0 : Math.max(8, (point.total / max) * 100)
          return (
            <div
              key={point.date}
              className="group flex min-w-7 flex-1 flex-col items-center gap-1.5"
              title={`${point.date}: ${formatMoney(point.total, currency)}`}
            >
              <div className="flex h-36 w-full items-end justify-center">
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

export function AnalyticsView() {
  const presets = React.useMemo(() => buildPresets(), [])
  const [dateFrom, setDateFrom] = React.useState(presets[2]!.from)
  const [dateTo, setDateTo] = React.useState(presets[2]!.to)
  const [activePresetId, setActivePresetId] = React.useState<string | null>(
    presets[2]!.id,
  )
  const [driverId, setDriverId] = React.useState("all")

  React.useEffect(() => {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setDateTo(dateFrom)
    }
  }, [dateFrom, dateTo])

  const { data: driverData } = useSWR<{ drivers: Driver[] }>(
    "/api/admin/drivers",
    fetcher,
  )
  const drivers = driverData?.drivers ?? []

  const query = React.useMemo(() => {
    const params = new URLSearchParams()
    params.set("dateFrom", dateFrom)
    params.set("dateTo", dateTo)
    if (driverId !== "all") params.set("driverId", driverId)
    return `/api/admin/analytics?${params.toString()}`
  }, [dateFrom, dateTo, driverId])

  const { data, isLoading, isValidating, error, mutate } =
    useSWR<AnalyticsReport>(query, fetcher)

  const driverTotals = React.useMemo(
    () => (data ? sumDriverRevenue(data.revenueByDriver) : null),
    [data],
  )

  const cashPct = data
    ? sharePercent(data.summary.cashCollected, data.summary.totalCollected)
    : 0
  const onlinePct = data
    ? sharePercent(data.summary.onlineCollected, data.summary.totalCollected)
    : 0
  const maxProviderAmount = React.useMemo(
    () =>
      data?.byProvider.length
        ? Math.max(...data.byProvider.map((row) => row.amount), 1)
        : 1,
    [data],
  )

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Revenue and cash collection based on payment date"
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 touch-manipulation gap-1.5 sm:h-8"
              disabled={isValidating}
              onClick={() => void mutate()}
            >
              <RefreshCwIcon
                className={cn("size-3.5", isValidating && "animate-spin")}
              />
              Refresh
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 touch-manipulation gap-1.5 sm:h-8"
              disabled={!data}
              onClick={() => data && exportCsv(data)}
            >
              <DownloadIcon className="size-3.5" />
              Export CSV
            </Button>
          </>
        }
      />

      <div className="flex w-full flex-col gap-5 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:gap-6 sm:p-4 md:p-6">
        <Card className="shadow-xs">
          <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <CalendarIcon className="size-4" />
              </div>
              <div>
                <CardTitle className="text-base">Filters</CardTitle>
                <CardDescription>
                  Payment date and optional driver filter
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
                  {preset.label}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-3">
            <AdminDateField
              label="From"
              value={dateFrom}
              onChange={(next) => {
                setActivePresetId(null)
                setDateFrom(next)
              }}
            />
            <AdminDateField
              label="To"
              value={dateTo}
              onChange={(next) => {
                setActivePresetId(null)
                setDateTo(next)
              }}
            />
            <AdminDriverField
              label="Driver"
              value={driverId}
              onChange={setDriverId}
              drivers={drivers}
              fallbackLabel={data?.driverFilter?.driverName}
            />
          </CardContent>
        </Card>

        {error ? (
          <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive sm:flex-row sm:items-center">
            <div className="flex items-center gap-2.5">
              <AlertCircleIcon className="size-4 shrink-0" />
              <p>{(error as Error).message || "Could not load analytics."}</p>
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

        {data?.driverFilter ? (
          <Card className="border-primary/25 bg-primary/[0.04] shadow-xs">
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <UsersIcon className="size-4" />
                </div>
                <div>
                  <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    Filtered driver
                  </p>
                  <p className="text-lg font-semibold">
                    {data.driverFilter.driverName}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-md bg-emerald-500/10 px-2.5 py-1 font-medium tabular-nums text-emerald-800 dark:text-emerald-200">
                  Cash: {data.summary.cashCollectedLabel}
                </span>
                <span className="rounded-md bg-sky-500/10 px-2.5 py-1 font-medium tabular-nums text-sky-800 dark:text-sky-200">
                  Online: {data.summary.onlineCollectedLabel}
                </span>
                <span className="rounded-md bg-primary/10 px-2.5 py-1 text-sm font-semibold tabular-nums text-primary">
                  Total: {data.summary.totalCollectedLabel}
                </span>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-5">
          {isLoading && !data ? (
            Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-32 rounded-xl" />
            ))
          ) : data ? (
            <>
              <SummaryCard
                label="Total collected"
                value={data.summary.totalCollectedLabel}
                hint={`${data.summary.paymentCount} payment${data.summary.paymentCount === 1 ? "" : "s"}`}
                icon={TrendingUpIcon}
                tone="primary"
              />
              <SummaryCard
                label="Cash collected"
                value={data.summary.cashCollectedLabel}
                hint="Manual / driver cash"
                icon={BanknoteIcon}
                tone="emerald"
                sharePct={data.summary.totalCollected > 0 ? cashPct : undefined}
              />
              <SummaryCard
                label="Online collected"
                value={data.summary.onlineCollectedLabel}
                hint="Stripe + PayPal + POK"
                icon={WalletIcon}
                tone="sky"
                sharePct={
                  data.summary.totalCollected > 0 ? onlinePct : undefined
                }
              />
              <SummaryCard
                label="Profit"
                value={data.summary.profitLabel}
                hint={`${data.summary.profitTripCount} trip${data.summary.profitTripCount === 1 ? "" : "s"} with driver cost`}
                icon={TrendingUpIcon}
                tone="emerald"
              />
              <SummaryCard
                label="Outstanding"
                value={data.outstanding.unpaidBalancesLabel}
                hint={`${data.outstanding.unpaidTripCount} trip${data.outstanding.unpaidTripCount === 1 ? "" : "s"} with cash due`}
                icon={CalendarDaysIcon}
                tone="amber"
                highlight={data.outstanding.unpaidBalances > 0}
              />
            </>
          ) : null}
        </div>

        {data ? (
          <>
            <div className="grid gap-5 lg:grid-cols-2">
              <Card className="shadow-xs">
                <CardHeader>
                  <CardTitle className="text-base">Daily revenue</CardTitle>
                  <CardDescription>Total collected per day</CardDescription>
                </CardHeader>
                <CardContent>
                  <DailyChart
                    series={data.dailySeries}
                    currency={data.currency}
                  />
                </CardContent>
              </Card>

              <Card className="shadow-xs">
                <CardHeader>
                  <CardTitle className="text-base">
                    By payment channel
                  </CardTitle>
                  <CardDescription>Breakdown by provider</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {data.byProvider.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 px-4 py-12 text-center">
                      <div className="mb-2.5 flex size-10 items-center justify-center rounded-full bg-muted/70 text-muted-foreground">
                        <CreditCardIcon className="size-4" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        No payments in this period.
                      </p>
                    </div>
                  ) : (
                    data.byProvider.map((row) => {
                      const widthPct = Math.max(
                        4,
                        Math.round((row.amount / maxProviderAmount) * 100),
                      )
                      return (
                        <div
                          key={row.provider}
                          className="rounded-lg border bg-background/60 px-3.5 py-2.5"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {row.providerLabel}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {row.count} payment{row.count === 1 ? "" : "s"}
                              </p>
                            </div>
                            <p className="shrink-0 text-sm font-semibold tabular-nums">
                              {row.amountLabel}
                            </p>
                          </div>
                          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary/80"
                              style={{ width: `${widthPct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-xs">
              <CardHeader>
                <CardTitle className="text-base">Revenue by driver</CardTitle>
                <CardDescription>
                  Cash and online payments attributed to each driver
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.revenueByDriver.length === 0 ? (
                  <p className="rounded-lg border border-dashed bg-muted/20 py-8 text-center text-sm text-muted-foreground">
                    No driver payments in this period.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                          <TableHead>Driver</TableHead>
                          <TableHead className="text-right">Trips</TableHead>
                          <TableHead className="text-right">Cash</TableHead>
                          <TableHead className="text-right">Online</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.revenueByDriver.map((row) => (
                          <TableRow key={row.driverId ?? "unassigned"}>
                            <TableCell className="font-medium">
                              {row.driverName}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.tripCount}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-emerald-700 dark:text-emerald-300">
                              {row.cashCollectedLabel}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sky-700 dark:text-sky-300">
                              {row.onlineCollectedLabel}
                            </TableCell>
                            <TableCell className="text-right font-semibold tabular-nums">
                              {row.totalCollectedLabel}
                            </TableCell>
                          </TableRow>
                        ))}
                        {driverId === "all" &&
                        driverTotals &&
                        data.revenueByDriver.length > 1 ? (
                          <TableRow className="bg-muted/50 font-semibold hover:bg-muted/50">
                            <TableCell>All drivers</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {driverTotals.tripCount}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatMoney(driverTotals.cash, data.currency)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatMoney(driverTotals.online, data.currency)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatMoney(driverTotals.total, data.currency)}
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-xs">
              <CardHeader>
                <CardTitle className="text-base">
                  Revenue by driver & route
                </CardTitle>
                <CardDescription>
                  Cash and online breakdown per driver and destination
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.revenueByDriverRoute.length === 0 ? (
                  <p className="rounded-lg border border-dashed bg-muted/20 py-8 text-center text-sm text-muted-foreground">
                    No driver route payments in this period.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                          <TableHead>Driver</TableHead>
                          <TableHead>Route</TableHead>
                          <TableHead className="text-right">Trips</TableHead>
                          <TableHead className="text-right">Cash</TableHead>
                          <TableHead className="text-right">Online</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.revenueByDriverRoute.map((row) => (
                          <TableRow
                            key={`${row.driverId ?? "unassigned"}-${row.zoneId ?? row.routeLabel}`}
                          >
                            <TableCell className="font-medium">
                              {row.driverName}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {row.routeLabel}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.tripCount}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-emerald-700 dark:text-emerald-300">
                              {row.cashCollectedLabel}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sky-700 dark:text-sky-300">
                              {row.onlineCollectedLabel}
                            </TableCell>
                            <TableCell className="text-right font-semibold tabular-nums">
                              {row.totalCollectedLabel}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-5 lg:grid-cols-2">
              <BreakdownCard
                title="By destination"
                icon={MapPinIcon}
                rows={data.byZone}
              />
              <BreakdownCard
                title="By vehicle"
                icon={CarIcon}
                rows={data.byVehicle}
              />
            </div>

            <Card className="shadow-xs">
              <CardHeader>
                <CardTitle className="text-base">Additional metrics</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <MetricRow
                  label="Completed trips (pickup date)"
                  value={String(data.summary.completedTripCount)}
                />
                <MetricRow
                  label="Forfeited deposits"
                  value={data.summary.forfeitedDepositsLabel}
                />
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </>
  )
}

function SummaryCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
  sharePct,
  highlight = false,
}: {
  label: string
  value: string
  hint: string
  icon: React.ComponentType<{ className?: string }>
  tone?: "primary" | "emerald" | "sky" | "amber"
  sharePct?: number
  highlight?: boolean
}) {
  const toneClasses = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    sky: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
    amber: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  }
  const barClasses = {
    primary: "bg-primary",
    emerald: "bg-emerald-500",
    sky: "bg-sky-500",
    amber: "bg-amber-500",
  }
  return (
    <Card
      className={cn(
        "flex flex-col justify-between shadow-xs",
        highlight &&
          tone === "amber" &&
          "border-amber-500/40 bg-amber-500/[0.04]",
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
              toneClasses[tone],
            )}
          >
            <Icon className="size-4" />
          </span>
        </div>
        <CardTitle className="mt-1 text-2xl font-bold tracking-tight tabular-nums">
          {value}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 pt-0">
        {sharePct != null ? (
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full", barClasses[tone])}
                style={{ width: `${sharePct}%` }}
              />
            </div>
            <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
              {sharePct}%
            </span>
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}

function BreakdownCard({
  title,
  icon: Icon,
  rows,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  rows: AnalyticsReport["byZone"]
}) {
  const maxAmount = rows.length ? Math.max(...rows.map((r) => r.amount), 1) : 1

  return (
    <Card className="shadow-xs">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 px-4 py-10 text-center">
            <div className="mb-2.5 flex size-10 items-center justify-center rounded-full bg-muted/70 text-muted-foreground">
              <Icon className="size-4" />
            </div>
            <p className="text-sm text-muted-foreground">No data.</p>
          </div>
        ) : (
          rows.map((row) => {
            const widthPct = Math.max(
              4,
              Math.round((row.amount / maxAmount) * 100),
            )
            return (
              <div
                key={row.key}
                className="rounded-lg border bg-background/60 px-3.5 py-2.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{row.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.count} payment{row.count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums">
                    {row.amountLabel}
                  </p>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary/80"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-muted/25 px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
    </div>
  )
}
