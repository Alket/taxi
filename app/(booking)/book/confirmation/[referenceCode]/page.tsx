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

import { prisma } from "@/lib/db"
import {
  DIRECTION_LABELS,
  formatDateTime,
  formatMoney,
  VEHICLE_LABELS,
} from "@/lib/format"
import type { Direction, VehicleType } from "@/lib/types"
import { CopyableReference } from "@/components/booking/copyable-reference"
import { Separator } from "@/components/ui/separator"

type PageProps = {
  params: Promise<{ referenceCode: string }>
}

type ConfirmationView = {
  referenceCode: string
  pickupPin: string
  directionLabel: string
  pickupAddress: string
  dropoffAddress: string
  pickupDateTime: string
  flightNumber: string | null
  vehicleLabel: string
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
    directionLabel: DIRECTION_LABELS[booking.direction as Direction],
    pickupAddress: booking.pickupAddress,
    dropoffAddress: booking.dropoffAddress,
    pickupDateTime: booking.pickupDateTime.toISOString(),
    flightNumber: booking.flightNumber || null,
    vehicleLabel: VEHICLE_LABELS[booking.vehicleType as VehicleType],
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

function NotFoundState({ referenceCode }: { referenceCode: string }) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-5 px-4 py-16 text-center md:px-6">
      <AlertCircleIcon className="size-12 text-muted-foreground" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Booking not found
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We couldn&apos;t find a booking with reference{" "}
          <span className="font-mono text-foreground">{referenceCode}</span>.
          Check the code and try again, or look up your trip below.
        </p>
      </div>
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
        <Link
          href="/my-booking"
          className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80 sm:h-9 sm:w-auto"
        >
          Look up my booking
        </Link>
        <Link
          href="/"
          className="inline-flex h-10 w-full items-center justify-center rounded-lg border px-3 text-sm font-medium hover:bg-muted sm:h-9 sm:w-auto"
        >
          Book a transfer
        </Link>
      </div>
    </div>
  )
}

function PendingPaymentState({ booking }: { booking: ConfirmationView }) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-10 md:px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <ClockIcon className="size-12 text-amber-600" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Payment pending
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            We have your booking, but the deposit hasn&apos;t been confirmed
            yet. If you just paid, this usually updates within a minute.
          </p>
        </div>
      </div>

      <CopyableReference
        referenceCode={booking.referenceCode}
        pickupPin={booking.pickupPin}
      />

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
        Deposit due:{" "}
        <span className="font-semibold tabular-nums">
          {formatMoney(booking.depositAmount, booking.currency)}
        </span>
        . Keep your PIN and reference code — you&apos;ll need them to manage the
        trip.
      </div>

      <TripSummary booking={booking} />

      <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
        <Link
          href="/my-booking"
          className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80 sm:h-9 sm:w-auto"
        >
          Manage my booking
        </Link>
        <Link
          href="/"
          className="inline-flex h-10 w-full items-center justify-center rounded-lg border px-3 text-sm font-medium hover:bg-muted sm:h-9 sm:w-auto"
        >
          Book another transfer
        </Link>
      </div>
    </div>
  )
}

function TripSummary({ booking }: { booking: ConfirmationView }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <h2 className="text-sm font-semibold">Trip summary</h2>
      <dl className="mt-4 flex flex-col gap-3">
        <SummaryRow label="Direction" value={booking.directionLabel} />
        <SummaryRow
          label="Route"
          value={`${booking.pickupAddress} → ${booking.dropoffAddress}`}
        />
        <SummaryRow
          label="Pickup"
          value={formatDateTime(booking.pickupDateTime)}
        />
        {booking.flightNumber && (
          <SummaryRow label="Flight" value={booking.flightNumber} />
        )}
        <SummaryRow
          label="Vehicle"
          value={`${booking.vehicleLabel}${booking.meetAndGreet ? " · Meet & greet" : ""}${booking.isRoundTrip ? " · Round trip" : ""}`}
        />
        <SummaryRow
          label="Party"
          value={`${booking.passengerCount} passenger${booking.passengerCount === 1 ? "" : "s"}, ${booking.luggageCount} bag${booking.luggageCount === 1 ? "" : "s"}`}
        />
      </dl>

      <Separator className="my-4" />

      <div className="flex flex-col gap-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Trip total</span>
          <span className="font-medium tabular-nums">
            {formatMoney(booking.totalPrice, booking.currency)}
          </span>
        </div>
        {booking.cashOnArrival ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Pay on arrival</span>
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
            <span className="text-muted-foreground">Paid in full</span>
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
                {booking.paymentSucceeded ? "Deposit paid" : "Deposit due"}
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
              <span className="text-muted-foreground">Balance after trip</span>
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

function WhatHappensNext({ hasFlight }: { hasFlight: boolean }) {
  const steps = [
    {
      icon: BellIcon,
      title: "Confirmation on the way",
      body: "You'll get an email with your PIN, reference code, and trip details.",
    },
    {
      icon: CarIcon,
      title: "Driver assignment",
      body: "We'll assign a vetted driver before pickup and share their name, phone, and vehicle plate. Show your PIN at pickup.",
    },
    ...(hasFlight
      ? [
        {
          icon: PlaneIcon,
          title: "Flight tracking",
          body: "We monitor your flight and adjust pickup if it lands early or late.",
        },
      ]
      : []),
    {
      icon: ShieldAlertIcon,
      title: "Cancellation policy",
      body: "Cancelling forfeits the deposit paid — it is not refunded. The remaining balance is never charged.",
    },
  ]

  return (
    <div className="rounded-xl border bg-card p-5">
      <h2 className="text-sm font-semibold">What happens next</h2>
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
  const { referenceCode: raw } = await params
  const referenceCode = raw?.trim().toUpperCase() || ""

  const booking = referenceCode
    ? await loadConfirmation(referenceCode)
    : null

  if (!booking) {
    return <NotFoundState referenceCode={referenceCode || "—"} />
  }

  if (!booking.paymentSucceeded && !booking.cashOnArrival) {
    return <PendingPaymentState booking={booking} />
  }

  return (
    <div className="mx-auto flex w-full max-w-lg animate-in fade-in-0 slide-in-from-bottom-2 flex-col gap-6 px-4 py-10 duration-500 md:px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <CheckCircle2Icon className="size-12 text-emerald-600" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Booking confirmed
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {booking.cashOnArrival
              ? "Trip reserved. Save your unique PIN and show it to your driver at pickup. Pay the full amount in cash on arrival."
              : "Deposit received. Save your unique PIN and show it to your driver at pickup."}
          </p>
        </div>
      </div>

      <CopyableReference
        referenceCode={booking.referenceCode}
        pickupPin={booking.pickupPin}
      />

      <TripSummary booking={booking} />

      <WhatHappensNext hasFlight={Boolean(booking.flightNumber)} />

      <p className="text-center text-xs text-muted-foreground">
        Cancelling forfeits your deposit.{" "}
        <Link
          href="/cancellation-policy"
          className="underline underline-offset-2 hover:text-foreground"
        >
          Read the cancellation policy
        </Link>
        .
      </p>

      <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
        <Link
          href="/my-booking"
          className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80 sm:h-9 sm:w-auto"
        >
          Manage my booking
        </Link>
        <Link
          href="/"
          className="inline-flex h-10 w-full items-center justify-center rounded-lg border px-3 text-sm font-medium hover:bg-muted sm:h-9 sm:w-auto"
        >
          Book another transfer
        </Link>
      </div>
    </div>
  )
}
