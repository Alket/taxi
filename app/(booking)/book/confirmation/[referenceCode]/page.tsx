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
import type { Direction, VehicleType } from "@/lib/types"

type PageProps = {
  params: Promise<{ referenceCode: string }>
}

type ConfirmationView = {
  referenceCode: string
  pickupPin: string
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
    },
  })

  if (!booking) return null

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
    pickupPin: booking.pickupPin,
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
  return direction === "dest_to_airport"
    ? t(locale, "confirm.dirDestToAirport")
    : t(locale, "confirm.dirAirportToDest")
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[8rem_1fr] sm:gap-3">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="min-w-0 break-words text-sm text-foreground">{value}</dd>
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
    <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-5 px-4 py-16 text-center md:px-6">
      <AlertCircleIcon className="size-12 text-muted-foreground" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t(locale, "confirm.notFoundTitle")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t(locale, "confirm.notFoundBody", { code: referenceCode })}
        </p>
      </div>
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
        <Link
          href={localePath("/my-booking", locale)}
          className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80 sm:h-9 sm:w-auto"
        >
          {t(locale, "confirm.manage")}
        </Link>
        <Link
          href={localePath("/", locale)}
          className="inline-flex h-10 w-full items-center justify-center rounded-lg border px-3 text-sm font-medium hover:bg-muted sm:h-9 sm:w-auto"
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
        <ClockIcon className="size-12 text-amber-600" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t(locale, "confirm.pendingTitle")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(locale, "confirm.pendingBody", {
              amount: formatMoney(booking.depositAmount, booking.currency),
            })}
          </p>
        </div>
      </div>

      <CopyableReference
        referenceCode={booking.referenceCode}
        pickupPin={booking.pickupPin}
      />

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
        {t(locale, "confirm.depositDue")}:{" "}
        <span className="font-semibold tabular-nums">
          {formatMoney(booking.depositAmount, booking.currency)}
        </span>
      </div>

      <TripSummary booking={booking} locale={locale} />

      <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
        <Link
          href={localePath("/my-booking", locale)}
          className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80 sm:h-9 sm:w-auto"
        >
          {t(locale, "confirm.manage")}
        </Link>
        <Link
          href={localePath("/", locale)}
          className="inline-flex h-10 w-full items-center justify-center rounded-lg border px-3 text-sm font-medium hover:bg-muted sm:h-9 sm:w-auto"
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
    <div className="rounded-xl border bg-card p-5">
      <h2 className="text-sm font-semibold">
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

      <Separator className="my-4" />

      <div className="flex flex-col gap-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">
            {t(locale, "confirm.tripTotal")}
          </span>
          <span className="font-medium tabular-nums">
            {formatMoney(booking.totalPrice, booking.currency)}
          </span>
        </div>
        {booking.cashOnArrival ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">
              {t(locale, "confirm.payOnArrival")}
            </span>
            <span className="font-medium tabular-nums">
              {formatMoney(
                booking.balanceDue || booking.totalPrice,
                booking.currency,
              )}
            </span>
          </div>
        ) : booking.paymentStatus === "fully_paid" ||
          booking.paymentStatus === "paid" ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">
              {t(locale, "confirm.paidInFull")}
            </span>
            <span className="font-medium tabular-nums">
              {formatMoney(
                booking.depositPaid || booking.totalPrice,
                booking.currency,
              )}
            </span>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">
                {booking.paymentSucceeded
                  ? t(locale, "confirm.depositPaid")
                  : t(locale, "confirm.depositDue")}
              </span>
              <span className="font-medium tabular-nums">
                {formatMoney(
                  booking.paymentSucceeded
                    ? booking.depositPaid || booking.depositAmount
                    : booking.depositAmount,
                  booking.currency,
                )}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">
                {t(locale, "confirm.balanceAfter")}
              </span>
              <span className="font-semibold tabular-nums">
                {formatMoney(booking.balanceDue, booking.currency)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function WhatHappensNext({
  hasFlight,
  locale,
}: {
  hasFlight: boolean
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
    {
      icon: ShieldAlertIcon,
      title: t(locale, "confirm.nextCancelTitle"),
      body: t(locale, "confirm.nextCancelBody"),
    },
  ]

  return (
    <div className="rounded-xl border bg-card p-5">
      <h2 className="text-sm font-semibold">{t(locale, "confirm.whatNext")}</h2>
      <ol className="mt-4 flex flex-col gap-4">
        {steps.map((step) => (
          <li key={step.title} className="flex gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <step.icon className="size-4" />
            </span>
            <div>
              <p className="text-sm font-medium">{step.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

export default async function BookingConfirmationPage({ params }: PageProps) {
  const locale = await getRequestLocale()
  const { referenceCode: raw } = await params
  const referenceCode = raw?.trim().toUpperCase() || ""

  const booking = referenceCode
    ? await loadConfirmation(referenceCode)
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
    <div className="mx-auto flex w-full max-w-lg animate-in fade-in-0 slide-in-from-bottom-2 flex-col gap-6 px-4 py-10 duration-500 md:px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <CheckCircle2Icon className="size-12 text-emerald-600" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t(locale, "confirm.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {booking.cashOnArrival
              ? t(locale, "confirm.cashBody")
              : t(locale, "confirm.depositBody")}
          </p>
        </div>
      </div>

      <CopyableReference
        referenceCode={booking.referenceCode}
        pickupPin={booking.pickupPin}
      />

      <TripSummary booking={booking} locale={locale} />

      <WhatHappensNext
        hasFlight={Boolean(booking.flightNumber)}
        locale={locale}
      />

      <p className="text-center text-xs text-muted-foreground">
        {t(locale, "confirm.cancelNote")}{" "}
        <Link
          href={localePath("/cancellation-policy", locale)}
          className="underline underline-offset-2 hover:text-foreground"
        >
          {t(locale, "confirm.readPolicy")}
        </Link>
        .
      </p>

      <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
        <Link
          href={localePath("/my-booking", locale)}
          className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80 sm:h-9 sm:w-auto"
        >
          {t(locale, "confirm.manage")}
        </Link>
        <Link
          href={localePath("/", locale)}
          className="inline-flex h-10 w-full items-center justify-center rounded-lg border px-3 text-sm font-medium hover:bg-muted sm:h-9 sm:w-auto"
        >
          {t(locale, "confirm.bookAnother")}
        </Link>
      </div>
    </div>
  )
}
