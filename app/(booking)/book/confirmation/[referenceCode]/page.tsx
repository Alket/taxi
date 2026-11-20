import type { Metadata } from "next"
import Link from "next/link"
import {
  AlertCircleIcon,
  BellIcon,
  CarIcon,
  CheckCircle2Icon,
  ClockIcon,
  PlaneIcon,
  ShieldAlertIcon,
} from "lucide-react"

import { CopyableReference } from "@/components/booking/copyable-reference"
import { Separator } from "@/components/ui/separator"
import { prisma } from "@/lib/db"
import { formatDateTime, formatMoney, VEHICLE_LABELS } from "@/lib/format"
import { getRequestLocale } from "@/lib/i18n/get-locale"
import { type Locale, localePath } from "@/lib/i18n/locales"
import { t } from "@/lib/i18n/t"
import { shouldRevealPickupPin } from "@/lib/pickup-pin"
import type { Direction, VehicleType } from "@/lib/types"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

type PageProps = {
  params: Promise<{ referenceCode: string }>
  searchParams: Promise<{ email?: string }>
}

type ConfirmationView = {
  referenceCode: string
  pickupPin: string | null
  direction: Direction
  pickupAddress: string
  dropoffAddress: string
  pickupDateTime: string
  flightNumber: string | null
  vehicleType: VehicleType
  passengerCount: number
  luggageCount: number
  meetAndGreet: boolean
  isRoundTrip: boolean
  currency: string
  totalPrice: number
  depositAmount: number
  depositPaid: number
  balanceDue: number
  paymentStatus: string
  paymentSucceeded: boolean
  cashOnArrival: boolean
}

async function loadConfirmation(
  referenceCode: string,
  email: string,
): Promise<ConfirmationView | null> {
  const booking = await prisma.booking.findUnique({
    where: { referenceCode },
    select: {
      referenceCode: true,
      pickupPin: true,
      direction: true,
      pickupAddress: true,
      dropoffAddress: true,
      pickupDateTime: true,
      flightNumber: true,
      vehicleType: true,
      passengerCount: true,
      luggageCount: true,
      meetAndGreet: true,
      isRoundTrip: true,
      totalPrice: true,
      depositAmount: true,
      depositPaid: true,
      balanceDue: true,
      currency: true,
      status: true,
      paymentStatus: true,
      notes: true,
      customer: { select: { email: true } },
    },
  })

  if (!booking) return null
  if (!email || booking.customer.email.toLowerCase() !== email) return null

  const paymentSucceeded =
    booking.paymentStatus === "deposit_paid" ||
    booking.paymentStatus === "fully_paid" ||
    booking.paymentStatus === "paid"

  const cashOnArrival =
    !paymentSucceeded &&
    booking.status !== "pending" &&
    booking.status !== "cancelled" &&
    (booking.notes?.toLowerCase().includes("cash on arrival") ?? false)

  return {
    referenceCode: booking.referenceCode,
    pickupPin: shouldRevealPickupPin(booking) ? booking.pickupPin : null,
    direction: booking.direction as Direction,
    pickupAddress: booking.pickupAddress,
    dropoffAddress: booking.dropoffAddress,
    pickupDateTime: booking.pickupDateTime.toISOString(),
    flightNumber: booking.flightNumber?.trim() || null,
    vehicleType: booking.vehicleType as VehicleType,
    passengerCount: booking.passengerCount,
    luggageCount: booking.luggageCount,
    meetAndGreet: booking.meetAndGreet,
    isRoundTrip: booking.isRoundTrip,
    currency: booking.currency,
    totalPrice: Number(booking.totalPrice),
    depositAmount: Number(booking.depositAmount),
    depositPaid: Number(booking.depositPaid),
    balanceDue: Number(booking.balanceDue),
    paymentStatus: booking.paymentStatus,
    paymentSucceeded,
    cashOnArrival,
  }
}

function directionLabel(locale: Locale, direction: Direction) {
  if (direction === "zone_to_zone") {
    return t(locale, "confirm.dirCityToCity")
  }
  return direction === "dest_to_airport"
    ? t(locale, "confirm.dirDestToAirport")
    : t(locale, "confirm.dirAirportToDest")
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 py-0.5 sm:grid-cols-[8.5rem_1fr] sm:gap-4">
      <dt className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="min-w-0 break-words text-sm font-medium text-brand">{value}</dd>
    </div>
  )
}

function NotFoundState({
  referenceCode,
  locale,
}: {
  referenceCode: string
  locale: Locale
}) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-6 px-4 py-16 text-center md:px-6">
      <div className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <AlertCircleIcon className="size-8" />
      </div>
      <div>
        <h1 className="font-brand text-2xl font-extrabold tracking-tight text-brand">
          {t(locale, "confirm.notFoundTitle")}
        </h1>
        <p className="mt-2 text-sm text-brand/75 dark:text-muted-foreground">
          {t(locale, "confirm.notFoundBody", { code: referenceCode })}
        </p>
      </div>
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
        <Link
          href={localePath("/my-booking", locale)}
          className="inline-flex h-12 w-full items-center justify-center rounded-full bg-brand-accent px-6 text-sm font-extrabold text-white shadow-xs transition-all hover:bg-brand-accent-hover hover:brightness-95 active:scale-[0.98] sm:w-auto"
        >
          {t(locale, "confirm.manage")}
        </Link>
        <Link
          href={localePath("/", locale)}
          className="inline-flex h-12 w-full items-center justify-center rounded-full border border-border/80 bg-brand-surface px-6 text-sm font-bold text-brand shadow-xs transition-all hover:bg-muted active:scale-[0.98] sm:w-auto"
        >
          {t(locale, "cta.bookTransfer")}
        </Link>
      </div>
    </div>
  )
}

function PendingPaymentState({
  booking,
  locale,
}: {
  booking: ConfirmationView
  locale: Locale
}) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-10 md:px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 ring-8 ring-amber-500/5 sm:size-20">
          <ClockIcon className="size-9 sm:size-11" strokeWidth={2.2} />
        </div>
        <div>
          <h1 className="font-brand text-2xl font-extrabold tracking-tight text-brand sm:text-3xl">
            {t(locale, "confirm.pendingTitle")}
          </h1>
          <p className="mt-2 text-sm text-brand/75 dark:text-muted-foreground">
            {t(locale, "confirm.pendingBody", {
              amount: formatMoney(booking.depositAmount, booking.currency),
            })}
          </p>
        </div>
      </div>

      <CopyableReference
        referenceCode={booking.referenceCode}
        pickupPin={booking.pickupPin ?? undefined}
      />

      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm font-medium text-amber-950 dark:text-amber-100">
        {t(locale, "confirm.depositDue")}:{" "}
        <span className="font-bold tabular-nums">
          {formatMoney(booking.depositAmount, booking.currency)}
        </span>
      </div>

      <TripSummary booking={booking} locale={locale} />

      <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
        <Link
          href={localePath("/my-booking", locale)}
          className="inline-flex h-12 w-full items-center justify-center rounded-full bg-brand-accent px-6 text-sm font-extrabold text-white shadow-xs transition-all hover:bg-brand-accent-hover hover:brightness-95 active:scale-[0.98] sm:w-auto"
        >
          {t(locale, "confirm.manage")}
        </Link>
        <Link
          href={localePath("/", locale)}
          className="inline-flex h-12 w-full items-center justify-center rounded-full border border-border/80 bg-brand-surface px-6 text-sm font-bold text-brand shadow-xs transition-all hover:bg-muted active:scale-[0.98] sm:w-auto"
        >
          {t(locale, "confirm.bookAnother")}
        </Link>
      </div>
    </div>
  )
}

function TripSummary({
  booking,
  locale,
}: {
  booking: ConfirmationView
  locale: Locale
}) {
  const vehicleBits = [
    VEHICLE_LABELS[booking.vehicleType],
    booking.meetAndGreet ? t(locale, "confirm.meetGreet") : null,
    booking.isRoundTrip ? t(locale, "confirm.roundTrip") : null,
  ].filter(Boolean)

  const partyKey =
    booking.passengerCount === 1
      ? "confirm.partyValueOne"
      : "confirm.partyValue"

  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-brand-surface shadow-xs">
      <div className="p-6">
        <h2 className="font-brand text-base font-extrabold text-brand sm:text-lg">
          {t(locale, "confirm.tripSummary")}
        </h2>
        <dl className="mt-4 flex flex-col gap-3">
          <SummaryRow
            label={t(locale, "confirm.direction")}
            value={directionLabel(locale, booking.direction)}
          />
          <SummaryRow
            label={t(locale, "confirm.route")}
            value={`${booking.pickupAddress} → ${booking.dropoffAddress}`}
          />
          <SummaryRow
            label={t(locale, "confirm.pickup")}
            value={formatDateTime(booking.pickupDateTime)}
          />
          {booking.flightNumber ? (
            <SummaryRow
              label={t(locale, "confirm.flight")}
              value={booking.flightNumber}
            />
          ) : null}
          <SummaryRow
            label={t(locale, "confirm.vehicle")}
            value={vehicleBits.join(" · ")}
          />
          <SummaryRow
            label={t(locale, "confirm.party")}
            value={t(locale, partyKey, {
              passengers: booking.passengerCount,
              bags: booking.luggageCount,
            })}
          />
        </dl>
      </div>

      <div className="border-t border-border/80 bg-brand-page/50 px-6 py-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-brand/75 dark:text-muted-foreground">
            {t(locale, "confirm.tripTotal")}
          </span>
          <span className="font-bold text-brand tabular-nums">
            {formatMoney(booking.totalPrice, booking.currency)}
          </span>
        </div>
        {booking.cashOnArrival ? (
          <div className="mt-2 flex items-center justify-between gap-3 border-t border-border/60 pt-2 text-brand-accent">
            <span className="font-bold">
              {t(locale, "confirm.payOnArrival")}
            </span>
            <span className="font-extrabold text-base tabular-nums">
              {formatMoney(
                booking.balanceDue || booking.totalPrice,
                booking.currency,
              )}
            </span>
          </div>
        ) : booking.paymentStatus === "fully_paid" ||
          booking.paymentStatus === "paid" ? (
          <div className="mt-2 flex items-center justify-between gap-3 border-t border-border/60 pt-2 text-brand-accent">
            <span className="font-bold">
              {t(locale, "confirm.paidInFull")}
            </span>
            <span className="font-extrabold text-base tabular-nums">
              {formatMoney(
                booking.depositPaid || booking.totalPrice,
                booking.currency,
              )}
            </span>
          </div>
        ) : (
          <div className="mt-2 flex flex-col gap-1.5 border-t border-border/60 pt-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-brand/75 dark:text-muted-foreground">
                {booking.paymentSucceeded
                  ? t(locale, "confirm.depositPaid")
                  : t(locale, "confirm.depositDue")}
              </span>
              <span className="font-medium text-brand tabular-nums">
                {formatMoney(
                  booking.paymentSucceeded
                    ? booking.depositPaid || booking.depositAmount
                    : booking.depositAmount,
                  booking.currency,
                )}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 font-bold text-brand-accent">
              <span>{t(locale, "confirm.balanceAfter")}</span>
              <span className="font-extrabold text-base tabular-nums">
                {formatMoney(booking.balanceDue, booking.currency)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function WhatHappensNext({
  hasFlight,
  cashOnArrival,
  locale,
}: {
  hasFlight: boolean
  cashOnArrival: boolean
  locale: Locale
}) {
  const steps = [
    {
      icon: BellIcon,
      title: t(locale, "confirm.nextEmailTitle"),
      body: t(locale, "confirm.nextEmailBody"),
    },
    {
      icon: CarIcon,
      title: t(locale, "confirm.nextDriverTitle"),
      body: t(locale, "confirm.nextDriverBody"),
    },
    ...(hasFlight
      ? [
          {
            icon: PlaneIcon,
            title: t(locale, "confirm.nextFlightTitle"),
            body: t(locale, "confirm.nextFlightBody"),
          },
        ]
      : []),
    ...(!cashOnArrival
      ? [
          {
            icon: ShieldAlertIcon,
            title: t(locale, "confirm.nextCancelTitle"),
            body: t(locale, "confirm.nextCancelBody"),
          },
        ]
      : []),
  ]

  return (
    <div className="rounded-2xl border border-border/80 bg-brand-surface p-6 shadow-xs">
      <h2 className="font-brand text-base font-extrabold text-brand sm:text-lg">
        {t(locale, "confirm.whatNext")}
      </h2>
      <ol className="relative mt-5 flex flex-col gap-5 before:absolute before:left-4 before:top-4 before:bottom-4 before:w-0.5 before:bg-border/60">
        {steps.map((step) => (
          <li key={step.title} className="relative z-10 flex items-start gap-3.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-accent/10 text-brand-accent ring-4 ring-brand-surface">
              <step.icon className="size-4" strokeWidth={2.2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-brand">{step.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-brand/75 dark:text-muted-foreground sm:text-[13px]">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

export default async function Page({ params, searchParams }: PageProps) {
  const locale = await getRequestLocale()
  const { referenceCode: raw } = await params
  const referenceCode = raw?.trim().toUpperCase() || ""

  const booking = referenceCode
    ? await loadConfirmation(referenceCode, ((await searchParams).email ?? "").trim().toLowerCase())
    : null

  if (!booking) {
    return (
      <NotFoundState
        referenceCode={referenceCode || "—"}
        locale={locale}
      />
    )
  }

  if (!booking.paymentSucceeded && !booking.cashOnArrival) {
    return <PendingPaymentState booking={booking} locale={locale} />
  }

  return (
    <div className="mx-auto flex w-full max-w-lg animate-in fade-in-0 slide-in-from-bottom-2 flex-col gap-6 px-4 py-12 duration-500 md:max-w-xl md:px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-emerald-500/10 text-brand-accent ring-8 ring-emerald-500/5 sm:size-20">
          <CheckCircle2Icon className="size-9 sm:size-11" strokeWidth={2.2} />
        </div>
        <div>
          <h1 className="font-brand text-2xl font-extrabold tracking-tight text-brand sm:text-3xl">
            {t(locale, "confirm.title")}
          </h1>
          <p className="mt-2 text-sm text-brand/75 dark:text-muted-foreground sm:text-base">
            {booking.cashOnArrival
              ? t(locale, "confirm.cashBody")
              : t(locale, "confirm.depositBody")}
          </p>
        </div>
      </div>

      <CopyableReference
        referenceCode={booking.referenceCode}
        pickupPin={booking.pickupPin ?? undefined}
      />

      <TripSummary booking={booking} locale={locale} />

      <WhatHappensNext
        hasFlight={Boolean(booking.flightNumber)}
        cashOnArrival={booking.cashOnArrival}
        locale={locale}
      />

      {!booking.cashOnArrival ? (
        <p className="text-center text-xs text-brand/70 dark:text-muted-foreground">
          {t(locale, "confirm.cancelNote")}{" "}
          <Link
            href={localePath("/cancellation-policy", locale)}
            className="font-semibold text-brand underline underline-offset-4 hover:text-brand-accent"
          >
            {t(locale, "confirm.readPolicy")}
          </Link>
          .
        </p>
      ) : null}

      <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
        <Link
          href={localePath("/my-booking", locale)}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-accent px-7 text-sm font-extrabold text-white shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-accent-hover hover:brightness-95 active:scale-[0.98] sm:w-auto"
        >
          {t(locale, "confirm.manage")}
        </Link>
        <Link
          href={localePath("/", locale)}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-border/80 bg-brand-surface px-7 text-sm font-bold text-brand shadow-xs transition-all duration-200 hover:bg-muted active:scale-[0.98] sm:w-auto"
        >
          {t(locale, "confirm.bookAnother")}
        </Link>
      </div>
    </div>
  )
}
