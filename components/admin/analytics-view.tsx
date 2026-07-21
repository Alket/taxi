"use client"

import * as React from "react"
import useSWR from "swr"
import {
  BanknoteIcon,
  CalendarDaysIcon,
  DownloadIcon,
  TrendingUpIcon,
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
      ? [`Driver filter,${report.driverFilter.driverName}`]
      : []),
    "",
    "Summary",
    `Total collected,${report.summary.totalCollected}`,
    `Cash collected,${report.summary.cashCollected}`,
    `Online collected,${report.summary.onlineCollected}`,
    `Payments,${report.summary.paymentCount}`,
    `Completed trips (pickup date),${report.summary.completedTripCount}`,
    `Forfeited deposits,${report.summary.forfeitedDeposits}`,
    `Outstanding unpaid,${report.outstanding.unpaidBalances}`,
    "",
    "Revenue by driver",
    "Driver,Trips,Cash,Online,Total,Share of cash %",
    ...report.revenueByDriver.map(
      (row) =>
        `"${row.driverName}",${row.tripCount},${row.cashCollected},${row.onlineCollected},${row.totalCollected},${row.shareOfCash}`,
    ),
    "",
    "Revenue by driver and route",
    "Driver,Route,Trips,Cash,Online,Total",
    ...report.revenueByDriverRoute.map(
      (row) =>
        `"${row.driverName}","${row.routeLabel}",${row.tripCount},${row.cashCollected},${row.onlineCollected},${row.totalCollected}`,
    ),
    "",
    "By provider",
    "Provider,Payments,Amount",
    ...report.byProvider.map(
      (row) => `"${row.providerLabel}",${row.count},${row.amount}`,
    ),
    "",
    "By zone",
    "Zone,Payments,Amount",
    ...report.byZone.map((row) => `"${row.label}",${row.count},${row.amount}`),
    "",
    "By vehicle",
    "Vehicle,Payments,Amount",
    ...report.byVehicle.map(
      (row) => `"${row.label}",${row.count},${row.amount}`,
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
      <p className="text-sm text-muted-foreground">
        No payments in this date range.
      </p>
    )
  }

  return (
    <div className="flex h-48 items-end gap-1 overflow-x-auto pb-2">
      {series.map((point) => {
        const height = Math.max(4, (point.total / max) * 100)
        return (
          <div
            key={point.date}
            className="flex min-w-8 flex-1 flex-col items-center gap-1"
            title={`${point.date}: ${formatMoney(point.total, currency)}`}
          >
            <div className="flex h-36 w-full items-end justify-center gap-0.5">
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

export function AnalyticsView() {
  const presets = React.useMemo(() => buildPresets(), [])
  const [dateFrom, setDateFrom] = React.useState(presets[2]!.from)
  const [dateTo, setDateTo] = React.useState(presets[2]!.to)
  const [driverId, setDriverId] = React.useState("all")

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

  const { data, isLoading, error } = useSWR<AnalyticsReport>(query, fetcher)

  const driverTotals = React.useMemo(
    () => (data ? sumDriverRevenue(data.revenueByDriver) : null),
    [data],
  )

  return (
    <div className="flex flex-col gap-6 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-4 md:p-6">
      <PageHeader
        title="Analytics"
        description="Revenue and cash collection based on payment date (when money was received)."
      />

      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="text-base">Filters</CardTitle>
            <CardDescription>
              Payment date and optional driver filter
            </CardDescription>
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
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <AdminDateField
            label="From"
            value={dateFrom}
            onChange={setDateFrom}
          />
          <AdminDateField label="To" value={dateTo} onChange={setDateTo} />
          <AdminDriverField
            label="Driver"
            value={driverId}
            onChange={setDriverId}
            drivers={drivers}
            fallbackLabel={data?.driverFilter?.driverName}
          />
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              disabled={!data}
              onClick={() => data && exportCsv(data)}
            >
              <DownloadIcon data-icon="inline-start" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-6 text-sm text-destructive">
            {(error as Error).message || "Could not load analytics."}
          </CardContent>
        </Card>
      ) : null}

      {data?.driverFilter ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col gap-1 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Driver total</p>
              <p className="text-xl font-semibold">{data.driverFilter.driverName}</p>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <span>
                Cash:{" "}
                <strong className="tabular-nums">
                  {data.summary.cashCollectedLabel}
                </strong>
              </span>
              <span>
                Online:{" "}
                <strong className="tabular-nums">
                  {data.summary.onlineCollectedLabel}
                </strong>
              </span>
              <span>
                Total:{" "}
                <strong className="tabular-nums text-base">
                  {data.summary.totalCollectedLabel}
                </strong>
              </span>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading && !data ? (
          Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))
        ) : data ? (
          <>
            <SummaryCard
              label="Total collected"
              value={data.summary.totalCollectedLabel}
              hint={`${data.summary.paymentCount} payments`}
              icon={TrendingUpIcon}
            />
            <SummaryCard
              label="Cash collected"
              value={data.summary.cashCollectedLabel}
              hint="Manual / driver cash"
              icon={BanknoteIcon}
            />
            <SummaryCard
              label="Online collected"
              value={data.summary.onlineCollectedLabel}
              hint="Stripe + PayPal"
              icon={WalletIcon}
            />
            <SummaryCard
              label="Outstanding"
              value={data.outstanding.unpaidBalancesLabel}
              hint={`${data.outstanding.unpaidTripCount} trips with cash due`}
              icon={CalendarDaysIcon}
            />
          </>
        ) : null}
      </div>

      {data ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
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
                <CardTitle className="text-base">By payment channel</CardTitle>
                <CardDescription>Breakdown by provider</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.byProvider.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No payments.</p>
                ) : (
                  data.byProvider.map((row) => (
                    <div
                      key={row.provider}
                      className="flex items-center justify-between rounded-lg border px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium">{row.providerLabel}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.count} payment{row.count === 1 ? "" : "s"}
                        </p>
                      </div>
                      <p className="text-sm font-semibold tabular-nums">
                        {row.amountLabel}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Revenue by driver</CardTitle>
              <CardDescription>
                Cash and online payments attributed to each driver
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.revenueByDriver.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No driver payments in this period.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
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
                          <TableCell className="text-right tabular-nums">
                            {row.cashCollectedLabel}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.onlineCollectedLabel}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
                            {row.totalCollectedLabel}
                          </TableCell>
                        </TableRow>
                      ))}
                      {driverId === "all" && driverTotals && data.revenueByDriver.length > 1 ? (
                        <TableRow className="bg-muted/40 font-medium">
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Revenue by driver & route</CardTitle>
              <CardDescription>
                Cash and online breakdown per driver and destination
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.revenueByDriverRoute.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No driver route payments in this period.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
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
                          <TableCell>{row.routeLabel}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.tripCount}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.cashCollectedLabel}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.onlineCollectedLabel}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
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

          <div className="grid gap-4 lg:grid-cols-2">
            <BreakdownCard title="By destination" rows={data.byZone} />
            <BreakdownCard title="By vehicle" rows={data.byVehicle} />
          </div>

          <Card>
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
  )
}

function SummaryCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string
  value: string
  hint: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardDescription>{label}</CardDescription>
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
        </div>
        <CardTitle className="text-2xl font-semibold tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}

function BreakdownCard({
  title,
  rows,
}: {
  title: string
  rows: AnalyticsReport["byZone"]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data.</p>
        ) : (
          rows.map((row) => (
            <div
              key={row.key}
              className="flex items-center justify-between rounded-lg border px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium">{row.label}</p>
                <p className="text-xs text-muted-foreground">
                  {row.count} payment{row.count === 1 ? "" : "s"}
                </p>
              </div>
              <p className="text-sm font-semibold tabular-nums">{row.amountLabel}</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}
