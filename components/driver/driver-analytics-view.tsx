"use client"

import * as React from "react"
import useSWR from "swr"
import {
  BanknoteIcon,
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
import { useDriverT, type DriverMessageKey } from "@/lib/i18n/driver"
import type { DriverAnalyticsReport } from "@/lib/types"

type DatePreset = {
  id: string
  labelKey: string
  from: string
  to: string
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
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>
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
  const t = useDriverT()
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
        title={t("analytics.title")}
        description={t("analytics.description")}
      />

      <div className="flex flex-1 flex-col gap-5 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:gap-6 sm:p-4 md:p-6">
        <Card>
          <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle className="text-base">{t("analytics.dateRange")}</CardTitle>
              <CardDescription>{t("analytics.dateRangeHint")}</CardDescription>
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
                  {t(preset.labelKey)}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <AdminDateField
              label={t("analytics.from")}
              value={dateFrom}
              onChange={setDateFrom}
            />
            <AdminDateField
              label={t("analytics.to")}
              value={dateTo}
              onChange={setDateTo}
            />
          </CardContent>
        </Card>

        {error ? (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="pt-6 text-sm text-destructive">
              {(error as Error).message || t("analytics.loadError")}
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
                  <CardDescription>{t("analytics.totalCollected")}</CardDescription>
                  <CardTitle className="text-2xl tabular-nums">
                    {data.summary.totalCollectedLabel}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
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
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardDescription>{t("analytics.cash")}</CardDescription>
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
                    <CardDescription>{t("analytics.online")}</CardDescription>
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

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("analytics.byRoute")}</CardTitle>
                <CardDescription>{t("analytics.byRouteHint")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.byRoute.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("analytics.noPaymentsPeriod")}
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
                            {plural(t, "analytics.tripCount", row.tripCount)}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold tabular-nums">
                          {row.totalCollectedLabel}
                        </p>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          {t("analytics.cashLabel", {
                            amount: row.cashCollectedLabel,
                          })}
                        </span>
                        <span>
                          {t("analytics.onlineLabel", {
                            amount: row.onlineCollectedLabel,
                          })}
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
