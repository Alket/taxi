"use client"

import * as React from "react"
import {
  BanknoteIcon,
  CalendarClockIcon,
  KeyRoundIcon,
  LuggageIcon,
  MapPinIcon,
  MessageSquareIcon,
  PhoneIcon,
  PlaneIcon,
  UsersIcon,
} from "lucide-react"

import {
  formatDriverDateTime,
  useDriverLocale,
  useDriverT,
} from "@/lib/i18n/driver"
import type { BookingStatus, PaymentStatus } from "@/lib/types"
import { cn } from "@/lib/utils"
import { CopyBookingInfoButton } from "@/components/driver/copy-booking-info-button"
import { buttonVariants } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

/** Full trip payload returned by GET /api/driver/bookings (calendar + list). */
export type DriverTripDetail = {
  id: string
  referenceCode: string
  pickupPin: string
  pickupAddress: string
  dropoffAddress: string
  pickupDateTime: string
  pickupLabel?: string
  passengerCount: number
  luggageCount: number
  flightNumber: string | null
  childSeats: string | null
  driverNotes: string | null
  meetAndGreet: boolean
  status: BookingStatus
  statusLabel: string
  customerName: string
  contactName: string
  contactPhone: string
  contactWhatsappUrl: string | null
  totalPriceLabel: string
  cashToCollect: number
  cashToCollectLabel: string
  cashCollected: boolean
  hadOnlineDeposit: boolean
  cashHint: string
  paymentStatus: PaymentStatus
}

function cashHintLabel(
  t: (key: string) => string,
  cashAmount: number,
  paymentStatus: PaymentStatus,
  cashCollected: boolean,
) {
  if (cashAmount <= 0) {
    return cashCollected ? t("cash.collected") : t("cash.nothing")
  }
  if (paymentStatus === "deposit_paid") return t("cash.balance")
  return t("cash.full")
}

function SectionLabel({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
      <Icon className="size-3.5" />
      {children}
    </span>
  )
}

/**
 * Admin-style right sheet for a driver trip — layout only (read-only).
 * Used from /driver/calendar; no admin APIs or internal notes.
 */
export function DriverTripDetailSheet({
  trip,
  open,
  onOpenChange,
}: {
  trip: DriverTripDetail | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useDriverT()
  const locale = useDriverLocale()
  const pickupLabel = trip
    ? formatDriverDateTime(trip.pickupDateTime, locale)
    : ""
  const cashHint = trip
    ? cashHintLabel(
        t,
        trip.cashToCollect,
        trip.paymentStatus,
        trip.cashCollected,
      )
    : ""
  const statusLabel = trip ? t(`status.${trip.status}`) : ""

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="h-dvh max-w-none gap-0 rounded-none border-0 p-0 sm:max-w-lg sm:border-l sm:data-[side=right]:max-w-lg"
      >
        {trip ? (
          <>
            <SheetHeader className="border-b p-4 pr-12">
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle className="font-mono text-sm">
                  {trip.referenceCode}
                </SheetTitle>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
                  {statusLabel || trip.statusLabel}
                </span>
              </div>
              <SheetDescription>
                {pickupLabel}
              </SheetDescription>
            </SheetHeader>

            <ScrollArea className="min-h-0 flex-1">
              <div className="flex flex-col gap-6 p-4">
                {/* Route — same structure as admin RouteBlock */}
                <section className="flex flex-col gap-3">
                  {trip.flightNumber ? (
                    <span className="font-mono text-xs text-muted-foreground">
                      {trip.flightNumber}
                    </span>
                  ) : null}
                  <ol className="flex flex-col gap-3">
                    <li className="flex gap-3">
                      <div className="flex flex-col items-center pt-1">
                        <span className="size-2.5 rounded-full border-2 border-primary" />
                        <span className="my-1 w-0.5 flex-1 bg-border" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">
                          {t("trips.pickup")}
                        </span>
                        <span className="text-sm font-medium">
                          {trip.pickupAddress}
                        </span>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <div className="flex flex-col items-center pt-1">
                        <MapPinIcon className="size-3 text-success" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">
                          {t("trips.dropoff")}
                        </span>
                        <span className="text-sm font-medium">
                          {trip.dropoffAddress}
                        </span>
                      </div>
                    </li>
                  </ol>
                </section>

                {/* Trip facts — admin-style muted cards */}
                <section className="grid grid-cols-2 gap-3">
                  {(
                    [
                      {
                        icon: CalendarClockIcon,
                        label: t("calendar.sheetPickupTime"),
                        value: pickupLabel,
                        fullRow: true,
                      },
                      {
                        icon: PlaneIcon,
                        label: t("calendar.sheetFlight"),
                        value: trip.flightNumber,
                        fullRow: true,
                      },
                      {
                        icon: UsersIcon,
                        label: t("calendar.sheetPassengers"),
                        value: String(trip.passengerCount),
                        fullRow: false,
                      },
                      {
                        icon: LuggageIcon,
                        label: t("calendar.sheetLuggage"),
                        value: String(trip.luggageCount),
                        fullRow: false,
                      },
                    ] as const
                  )
                    .filter((f) => f.value)
                    .map((f) => (
                      <div
                        key={f.label}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg border bg-muted/30 p-2.5",
                          f.fullRow && "col-span-2",
                        )}
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground">
                          <f.icon className="size-4" />
                        </span>
                        <div className="flex min-w-0 flex-col">
                          <span className="text-xs text-muted-foreground">
                            {f.label}
                          </span>
                          <span className="truncate text-sm font-medium">
                            {f.value}
                          </span>
                        </div>
                      </div>
                    ))}
                  {trip.meetAndGreet ? (
                    <div className="col-span-2 rounded-lg border bg-muted/30 px-2.5 py-2 text-sm font-medium">
                      {t("trips.meetGreet")}
                    </div>
                  ) : null}
                </section>

                <Separator />

                {/* Pickup PIN */}
                <section className="flex flex-col gap-3">
                  <SectionLabel icon={KeyRoundIcon}>
                    {t("trips.pickupPin")}
                  </SectionLabel>
                  <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 px-3 py-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <KeyRoundIcon className="size-5" />
                    </div>
                    <p className="font-mono text-2xl font-bold tracking-[0.2em] tabular-nums text-foreground sm:text-3xl">
                      {trip.pickupPin}
                    </p>
                  </div>
                </section>

                <Separator />

                {/* Passenger / contact */}
                <section className="flex flex-col gap-3">
                  <SectionLabel icon={UsersIcon}>
                    {t("calendar.sheetPassenger")}
                  </SectionLabel>
                  <p className="text-sm font-medium">{trip.contactName}</p>
                  {trip.contactPhone ? (
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={`tel:${trip.contactPhone}`}
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "h-9 flex-1 touch-manipulation sm:flex-none",
                        )}
                      >
                        <PhoneIcon data-icon="inline-start" />
                        {t("trips.phone")}
                      </a>
                      {trip.contactWhatsappUrl ? (
                        <a
                          href={trip.contactWhatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                            "h-9 flex-1 touch-manipulation sm:flex-none",
                          )}
                        >
                          <MessageSquareIcon data-icon="inline-start" />
                          {t("trips.whatsapp")}
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                  <CopyBookingInfoButton
                    trip={trip}
                    className="w-full sm:w-auto"
                  />
                </section>

                <Separator />

                {/* Cash / total */}
                <section className="flex flex-col gap-3">
                  <SectionLabel icon={BanknoteIcon}>
                    {t("calendar.sheetPayment")}
                  </SectionLabel>
                  <div
                    className={
                      trip.cashToCollect > 0
                        ? "flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2"
                        : "flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2"
                    }
                  >
                    <BanknoteIcon className="mt-0.5 size-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">
                        {cashHint}
                      </p>
                      <p className="text-base font-semibold tabular-nums">
                        {trip.cashToCollectLabel}
                      </p>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {t("trips.tripTotalLabel")}
                        {trip.hadOnlineDeposit
                          ? ` · ${t("trips.depositPaid")}`
                          : ""}
                      </p>
                      <p className="text-base font-semibold tabular-nums">
                        {trip.totalPriceLabel}
                      </p>
                    </div>
                  </div>
                </section>

                {trip.childSeats || trip.driverNotes ? (
                  <>
                    <Separator />
                    <section className="flex flex-col gap-2">
                      {trip.childSeats ? (
                        <div className="rounded-lg border bg-muted/40 px-3 py-2">
                          <p className="text-xs text-muted-foreground">
                            {t("trips.childSeats")}
                          </p>
                          <p className="text-sm font-medium break-words">
                            {trip.childSeats}
                          </p>
                        </div>
                      ) : null}
                      {trip.driverNotes ? (
                        <div className="rounded-lg border border-sky-500/25 bg-sky-500/10 px-3 py-2">
                          <p className="text-xs text-muted-foreground">
                            {t("trips.passengerComment")}
                          </p>
                          <p className="text-sm font-medium break-words">
                            {trip.driverNotes}
                          </p>
                        </div>
                      ) : null}
                    </section>
                  </>
                ) : null}
              </div>
            </ScrollArea>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
